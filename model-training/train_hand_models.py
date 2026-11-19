"""Compare hand geometry and hand-crop models on the original alphabet test split."""

import argparse
import json
import os
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import local
from zipfile import ZipFile

import cv2
import numpy as np

from train_alphabet import CAMERA_LABELS, SEED, ROOT, WORK, prepare

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
os.environ.setdefault("MPLCONFIGDIR", str(WORK / "matplotlib"))
SIZE = 64
CACHE = WORK / "alphabet-hand-features.npz"
BASELINE = ROOT / "artifacts" / "fsl-az-v2"
worker = local()
cv2.setNumThreads(1)


def detect(item):
    import mediapipe as mp

    split, label, path = item
    if not hasattr(worker, "detector"):
        with ZipFile(BASELINE.with_suffix(".task")) as outer:
            task = outer.read("hand_landmarker.task")
        config = mp.tasks.vision.HandLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_buffer=task),
            min_hand_detection_confidence=.25, min_hand_presence_confidence=.25,
        )
        worker.detector = mp.tasks.vision.HandLandmarker.create_from_options(config)
    image = mp.Image.create_from_file(str(path))
    result = worker.detector.detect(image)
    if not result.hand_landmarks:
        return split, label, np.zeros(126, np.float32), np.zeros((SIZE, SIZE, 3), np.uint8), False
    points = np.array([[p.x, p.y, p.z] for p in result.hand_landmarks[0]], np.float32)
    world = np.array([[p.x, p.y, p.z] for p in result.hand_world_landmarks[0]], np.float32)
    rgb = image.numpy_view()
    height, width = rgb.shape[:2]
    xy = points[:, :2] * (width, height)
    low, high = xy.min(axis=0), xy.max(axis=0)
    center = (low + high) / 2
    side = max(2, 1.22 * max(high - low))
    factor = SIZE / side
    transform = np.array([[factor, 0, SIZE / 2 - center[0] * factor],
                          [0, factor, SIZE / 2 - center[1] * factor]], np.float32)
    crop = cv2.warpAffine(rgb, transform, (SIZE, SIZE), borderMode=cv2.BORDER_REPLICATE)
    left = result.handedness[0][0].category_name == "Left"
    if left:
        crop = cv2.flip(crop, 1)
        points[:, 0] *= -1
        world[:, 0] *= -1
    points[:, 0] *= width / height
    points -= points[0]
    world -= world[0]
    vector = np.concatenate([coords.flatten() / max(1e-5, np.linalg.norm(coords, axis=1).max())
                             for coords in (points, world)])
    return split, label, vector, crop, True


def features():
    original = json.loads(BASELINE.with_suffix(".json").read_text(encoding="utf-8"))
    if not CACHE.exists():
        with tempfile.TemporaryDirectory(dir=WORK) as directory:
            images = Path(directory)
            split = prepare(images, holdout_fraction=.30)
            if split["test_samples_sha256"] != original["test_samples_sha256"]:
                raise ValueError("The held-out test split changed.")
            items = [(name, label, file) for name in ("train", "validation", "test") for label in CAMERA_LABELS
                     for file in sorted((images / name / label).glob("*.jpg"))]
            print("Extracting landmarks and hand crops from", len(items), "photos", flush=True)
            with ThreadPoolExecutor(max_workers=4) as executor:
                samples = []
                for index, row in enumerate(executor.map(detect, items), start=1):
                    samples.append(row)
                    if index % 1000 == 0:
                        print("Extracted", index, flush=True)
            names, classes, coords, crops, valid = zip(*samples)
            np.savez(CACHE, names=names, classes=classes, coords=coords, crops=crops, valid=valid,
                     test_hash=split["test_samples_sha256"])
    arrays = np.load(CACHE)
    if arrays["test_hash"].item() != original["test_samples_sha256"]:
        raise ValueError("Cached test split differs.")
    return arrays, original


def model_for(kind, tf):
    nn = tf.keras.layers
    if kind == "geometry":
        return tf.keras.Sequential([
            nn.Input((126,)), nn.GaussianNoise(.012), nn.Dense(256, activation="relu"),
            nn.Dropout(.12), nn.Dense(128, activation="relu"), nn.Dense(len(CAMERA_LABELS)),
        ])
    inputs = nn.Input((SIZE, SIZE, 3), dtype="uint8")
    x = nn.Rescaling(1 / 255)(inputs)
    x = nn.RandomRotation(.045)(x)
    x = nn.RandomTranslation(.07, .07)(x)
    x = nn.RandomContrast(.15)(x)
    for channels in (24, 40, 64):
        x = nn.Conv2D(channels, 3, padding="same", use_bias=False)(x)
        x = nn.BatchNormalization()(x)
        x = nn.Activation("relu")(x)
        x = nn.SeparableConv2D(channels, 3, padding="same", use_bias=False)(x)
        x = nn.BatchNormalization()(x)
        x = nn.Activation("relu")(x)
        x = nn.MaxPooling2D()(x)
    x = nn.Flatten()(x)
    x = nn.Dense(128, activation="relu")(x)
    x = nn.Dropout(.2)(x)
    return tf.keras.Model(inputs, nn.Dense(len(CAMERA_LABELS))(x))


def scores(predicted, target, valid, eligible):
    counts = {}
    for index, label in enumerate(CAMERA_LABELS):
        subset = target == index
        hit = int(((predicted == index) & valid & eligible & subset).sum())
        support = int(subset.sum())
        counts[label] = {"correct": hit, "support": support, "recall": hit / support}
    return counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reuse-geometry", action="store_true", help="Reuse the geometry model from a completed run")
    reuse = parser.parse_args().reuse_geometry
    arrays, original = features()
    import tensorflow as tf
    tf.config.threading.set_intra_op_parallelism_threads(6)
    tf.config.threading.set_inter_op_parallelism_threads(2)
    tf.keras.utils.set_random_seed(SEED)
    target = np.array([CAMERA_LABELS.index(label) for label in arrays["classes"]])
    names, valid = arrays["names"], arrays["valid"]
    train = (names == "train") & valid
    validation = names == "validation"
    test = names == "test"
    outputs = {}
    confidence = .5
    for kind, feature, epochs, batch_size in (("geometry", "coords", 65, 96), ("vision", "crops", 24, 96)):
        values = arrays[feature]
        if kind == "geometry" and reuse:
            model = tf.keras.models.load_model(WORK / "alphabet-geometry.keras", compile=False)
            outputs[kind] = tf.nn.softmax(model.predict(values, batch_size=batch_size, verbose=0)).numpy()
            continue
        model = model_for(kind, tf)
        model.compile(optimizer="adam", loss=tf.keras.losses.SparseCategoricalCrossentropy(from_logits=True),
                      metrics=["accuracy"])
        weight = np.bincount(target[train])
        weights = {index: weight.mean() / count for index, count in enumerate(weight)}
        model.fit(values[train], target[train], validation_data=(values[validation & valid], target[validation & valid]),
                  class_weight=weights, epochs=epochs, batch_size=batch_size, verbose=2,
                  callbacks=[tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=7, restore_best_weights=True)])
        outputs[kind] = tf.nn.softmax(model.predict(values, batch_size=batch_size, verbose=0)).numpy()
        model.save(WORK / f"alphabet-{kind}.keras")
        print(kind, "training completed", flush=True)

    variants = {**outputs, "ensemble": (outputs["geometry"] + outputs["vision"]) / 2}

    def grade(output, mask):
        return scores(output[mask].argmax(axis=1), target[mask], valid[mask], output[mask].max(axis=1) >= confidence)

    def rank(rows):
        return min(value["recall"] for value in rows.values()), np.mean([value["recall"] for value in rows.values()])

    validation_rows = {name: grade(output, validation) for name, output in variants.items()}
    selected = max(validation_rows, key=lambda name: rank(validation_rows[name]))
    print("Selected using validation:", selected, rank(validation_rows[selected]), flush=True)
    report = {"selected_on_validation": selected, "test_samples_sha256": arrays["test_hash"].item(),
              "score_threshold": confidence, "validation": validation_rows, "benchmark": {}}
    expected = {label: original["test"]["per_letter"][label]["support"] for label in CAMERA_LABELS}
    for name, output in variants.items():
        rows = grade(output, test)
        if {label: row["support"] for label, row in rows.items()} != expected:
            raise ValueError("Held-out support changed.")
        misses = {label: row["recall"] for label, row in rows.items() if row["recall"] < .90}
        report["benchmark"][name] = {"per_letter": rows, "below_90": misses,
                                      "correct": sum(row["correct"] for row in rows.values()), "images": int(test.sum())}
        print(name, report["benchmark"][name]["correct"], "/", int(test.sum()), "below 90%:", misses, flush=True)
    (WORK / "alphabet-retrain.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
