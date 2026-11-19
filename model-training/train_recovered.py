"""Recover overlooked training filename variants while preserving the test split."""

import json
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

from train_hand_models import CAMERA_LABELS, SEED, WORK, detect, features, model_for, prepare, scores


def main():
    import tensorflow as tf

    corpus, baseline = features()
    expected_hash = baseline["test_samples_sha256"]
    extra = []
    with tempfile.TemporaryDirectory(dir=WORK) as directory:
        root = Path(directory)
        split = prepare(root, holdout_fraction=.30, recover_variants=True)
        if split["test_samples_sha256"] != expected_hash:
            raise ValueError("Test fingerprint changed.")
        inputs = [
            ("train", letter, photo) for letter in CAMERA_LABELS
            for photo in sorted((root / "train" / letter).glob("*.jpg"))
            if int(photo.stem) >= split["original_training_counts"][letter]
        ]
        print("Recovered camera-letter training files:", len(inputs), flush=True)
        with ThreadPoolExecutor(max_workers=4) as pool:
            extra = [row for row in pool.map(detect, inputs) if row[-1]]
    if not extra:
        raise ValueError("No additional usable training images.")

    tf.config.threading.set_intra_op_parallelism_threads(6)
    tf.config.threading.set_inter_op_parallelism_threads(2)
    tf.keras.utils.set_random_seed(SEED)
    targets = np.array([CAMERA_LABELS.index(label) for label in corpus["classes"]])
    valid = corpus["valid"]
    training = (corpus["names"] == "train") & valid
    validation = (corpus["names"] == "validation") & valid
    test = corpus["names"] == "test"
    values = corpus["coords"]
    x = np.vstack([values[training], [row[2] for row in extra]])
    y = np.concatenate([targets[training], [CAMERA_LABELS.index(row[1]) for row in extra]])
    weights = np.bincount(y)
    print("Training images after hand detection:", len(y), flush=True)
    net = model_for("geometry", tf)
    net.compile(optimizer="adam", loss=tf.keras.losses.SparseCategoricalCrossentropy(from_logits=True), metrics=["accuracy"])
    net.fit(x, y, validation_data=(values[validation], targets[validation]), batch_size=96, epochs=65, verbose=2,
            class_weight={index: weights.mean() / count for index, count in enumerate(weights)},
            callbacks=[tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=7, restore_best_weights=True)])
    probabilities = tf.nn.softmax(net.predict(values[test], verbose=0)).numpy()
    result = scores(probabilities.argmax(axis=1), targets[test], valid[test], probabilities.max(axis=1) >= .5)
    failing = {letter: row["recall"] for letter, row in result.items() if row["recall"] < .90}
    expected = {label: baseline["test"]["per_letter"][label]["support"] for label in CAMERA_LABELS}
    if {label: row["support"] for label, row in result.items()} != expected:
        raise ValueError("Test counts changed.")
    report = dict(training_images=len(y), recovered_training_files=len(inputs), recovered_usable=len(extra),
                  test_samples_sha256=expected_hash, per_letter=result, images=int(test.sum()),
                  correct=sum(row["correct"] for row in result.values()), below_90=failing)
    net.save(WORK / "alphabet-recovered.keras")
    (WORK / "alphabet-recovered.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print({key: value for key, value in report.items() if key != "per_letter"}, flush=True)


if __name__ == "__main__":
    main()
