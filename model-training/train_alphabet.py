"""Train and benchmark an A–Z FSL Gesture Recognizer from still images."""

import argparse
import hashlib
import importlib.metadata
import json
import os
import random
import re
import string
import tempfile
import zipfile
from collections import defaultdict
from pathlib import Path, PurePosixPath

from train_abc import (
    ARCHIVE, ARCHIVE_HASH, ROOT, SEED, V2_HAND_OPTIONS, V2_MARGIN, WORK,
    add_frame_margin, load_model_maker, one_per_source, sample_group, sha256,
)

LABELS = tuple(string.ascii_uppercase)
MODEL = "fsl-az-v1.task"
SCORE_THRESHOLD = 0.5
CAMERA_LABELS = tuple(letter for letter in LABELS if letter not in {"J", "Z"})


def prepare(destination, *, holdout_fraction=None, recover_variants=False):
    if sha256(ARCHIVE) != ARCHIVE_HASH:
        raise ValueError("Expected the verified Kaggle v1 archive")

    import cv2
    import numpy as np

    raw = {split: defaultdict(list) for split in ("train", "validation", "test")}
    exact = set()
    total = 0
    ungrouped = 0
    duplicates = 0
    variants = []
    with zipfile.ZipFile(ARCHIVE) as archive:
        for name in sorted(archive.namelist()):
            path = PurePosixPath(name)
            if len(path.parts) != 3 or path.parts[0] != "Collated" or path.suffix.lower() != ".jpg" or path.parent.name not in LABELS:
                continue
            total += 1
            group = sample_group(path)
            if not group:
                ungrouped += 1
                if recover_variants:
                    stem = re.sub(r"_jpg\.rf\.[a-f0-9]+$", "", path.stem, flags=re.I)
                    stem = re.sub(r"(?: ?- ?Copy| \(\d+\))+$", "", stem, flags=re.I)
                    normalized = re.fullmatch(rf"{path.parent.name}(\d+)", stem, flags=re.I)
                    if normalized:
                        variants.append(("validation", path.parent.name.lower() + "_" + normalized[1], path, archive.read(name)))
                    elif stem.isdigit():
                        variants.append(("train", stem, path, archive.read(name)))
                continue
            split, source_id = group
            data = archive.read(name)
            digest = hashlib.sha256(data).digest()
            if digest in exact:
                duplicates += 1
                continue
            exact.add(digest)
            raw[split][path.parent.name].append((source_id, name, data))

    test_fallback = []
    for letter in LABELS:
        if raw["test"][letter]:
            continue
        # Keep entire source groups together for classes without an Image_ family.
        groups = sorted({record[0] for record in raw["validation"][letter]})
        random.Random(f"{SEED}-{letter}").shuffle(groups)
        held_out = set(groups[:max(1, len(groups) // 2)])
        records = raw["validation"][letter]
        raw["test"][letter] = [row for row in records if row[0] in held_out]
        raw["validation"][letter] = [row for row in records if row[0] not in held_out]
        test_fallback.append(letter)

    comparison_hash = hashlib.sha256()
    for letter in LABELS:
        for _, name, data in one_per_source(raw["test"][letter]):
            comparison_hash.update(name.encode("utf-8") + b"\0" + hashlib.sha256(data).digest())

    if holdout_fraction is not None:
        for letter in LABELS:
            records = raw["validation"][letter]
            groups = sorted({record[0] for record in records})
            random.Random(f"validation-{SEED}-{letter}").shuffle(groups)
            kept = set(groups[:max(1, round(len(groups) * holdout_fraction))])
            raw["validation"][letter] = [row for row in records if row[0] in kept]
            raw["train"][letter].extend(row for row in records if row[0] not in kept)

    original_training_counts = {letter: len(raw["train"][letter]) for letter in LABELS}
    reserved = {
        letter: {entry[0] for split in ("validation", "test") for entry in raw[split][letter]}
        for letter in LABELS
    }
    known_training = {letter: {entry[0] for entry in raw["train"][letter]} for letter in LABELS}
    recovered = 0
    for family, source_id, path, data in variants:
        letter = path.parent.name
        if source_id in reserved[letter] or (family == "validation" and letter in test_fallback and source_id not in known_training[letter]):
            continue
        digest = hashlib.sha256(data).digest()
        if digest in exact:
            continue
        exact.add(digest)
        raw["train"][letter].append((source_id, str(path), data))
        recovered += 1

    counts = {}
    for split, by_letter in raw.items():
        counts[split] = {}
        for letter in LABELS:
            records = by_letter[letter] if split == "train" else one_per_source(by_letter[letter])
            if not records:
                raise ValueError(f"No images for {split}/{letter}")
            folder = destination / split / letter
            folder.mkdir(parents=True)
            for index, (_, name, data) in enumerate(records):
                image = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
                if image is None or not cv2.imwrite(str(folder / f"{index:04d}.jpg"), add_frame_margin(image, V2_MARGIN)):
                    raise ValueError(f"Could not decode or prepare {name}")
            counts[split][letter] = len(records)

    return dict(archive_images=total, ungrouped_excluded=ungrouped, exact_duplicates_skipped=duplicates,
                image_counts=counts, test_from_validation_family=test_fallback,
                test_samples_sha256=comparison_hash.hexdigest(), validation_family_holdout_fraction=holdout_fraction,
                original_training_counts=original_training_counts, recovered_training_variants=recovered)


def evaluate(recognizer, source):
    import mediapipe as mp

    confusion = {letter: dict.fromkeys((*LABELS, "uncertain", "no_hand"), 0) for letter in LABELS}
    for letter in LABELS:
        for image in sorted((source / letter).glob("*.jpg")):
            result = recognizer.recognize(mp.Image.create_from_file(str(image)))
            prediction = "no_hand" if not result.hand_landmarks else "uncertain"
            if result.gestures and result.gestures[0]:
                best = result.gestures[0][0]
                if best.category_name in LABELS and best.score >= SCORE_THRESHOLD:
                    prediction = best.category_name
            confusion[letter][prediction] += 1

    per_letter = {}
    for letter, row in confusion.items():
        actual = sum(row.values())
        predicted = sum(other[letter] for other in confusion.values())
        per_letter[letter] = dict(
            support=actual, correct=row[letter], recall=row[letter] / actual,
            precision=row[letter] / predicted if predicted else 0.0,
            uncertain=row["uncertain"], no_hand=row["no_hand"],
        )
    correct = sum(row["correct"] for row in per_letter.values())
    total = sum(row["support"] for row in per_letter.values())
    return dict(correct=correct, images=total, accuracy=correct / total, per_letter=per_letter, confusion=confusion)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidate", action="store_true", help="Train an expanded candidate without changing the shipped model")
    candidate = parser.parse_args().candidate
    os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
    os.environ.setdefault("MPLCONFIGDIR", str(WORK / "matplotlib"))
    tempfile.tempdir = str(WORK / "tmp")

    import tensorflow as tf

    maker = load_model_maker()
    tf.config.threading.set_intra_op_parallelism_threads(2)
    tf.config.threading.set_inter_op_parallelism_threads(2)
    tf.keras.utils.set_random_seed(SEED)

    with tempfile.TemporaryDirectory(dir=WORK) as directory:
        work = Path(directory)
        images = work / "photos"
        source = prepare(images, holdout_fraction=0.2 if candidate else None)
        print("Prepared image counts:", {k: sum(v.values()) for k, v in source["image_counts"].items()}, flush=True)

        datasets = []
        admitted = {}
        for split in ("train", "validation"):
            folder = images / split
            # Model Maker expects the reserved none label. This archive has no
            # labeled non-sign hands, so no alphabet images are labeled as none.
            (folder / "none").mkdir()
            params = maker.HandDataPreprocessingParams(min_detection_confidence=V2_HAND_OPTIONS["min_hand_detection_confidence"])
            raw = maker.Dataset.from_folder(str(folder), params)
            features = raw.gen_tf_dataset(batch_size=64).unbatch().cache()
            counts = tf.zeros(len(raw.label_names), dtype=tf.int32)
            for _, batch in features.batch(256):
                counts += tf.reduce_sum(tf.cast(batch, tf.int32), axis=0)
            usable_by_letter = dict(zip(raw.label_names, counts.numpy().tolist()))
            if any(usable_by_letter.get(letter, 0) == 0 for letter in LABELS):
                raise ValueError(f"Hand detection missed an entire class in {split}: {usable_by_letter}")
            admitted[split] = raw.size
            datasets.append(maker.Dataset(dataset=features, label_names=raw.label_names, size=raw.size))
            print(f"Usable images in {split}: {raw.size}", flush=True)

        export = work / "export"
        model_name = "fsl-az-v2.task" if candidate else MODEL
        options = maker.GestureRecognizerOptions(
            hparams=maker.HParams(export_dir=str(export), epochs=75 if candidate else 45, batch_size=64),
            model_options=maker.ModelOptions(layer_widths=[256, 128, 64] if candidate else [128, 64]),
        )
        model = maker.GestureRecognizer.create(*datasets, options)
        model.export_model(model_name)
        task = export / model_name
        write_artifacts(task, images, source, admitted, WORK if candidate else ROOT / "artifacts")


def write_artifacts(task, images, source, admitted, artifacts):
    import mediapipe as mp

    bundle = task.read_bytes()
    config = mp.tasks.vision.GestureRecognizerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_buffer=bundle), **V2_HAND_OPTIONS,
    )
    with mp.tasks.vision.GestureRecognizer.create_from_options(config) as recognizer:
        result = evaluate(recognizer, images / "test")

    if any(result["per_letter"][letter]["support"] != source["image_counts"]["test"][letter] for letter in LABELS):
        raise ValueError("Test counts do not match the prepared split")

    camera_rows = {letter: result["per_letter"][letter] for letter in CAMERA_LABELS}
    report = dict(
        model=task.name, model_sha256=sha256(task), labels=list(LABELS), seed=SEED,
        dataset="japorton/fsl-dataset/versions/1", archive_sha256=ARCHIVE_HASH,
        versions={name: importlib.metadata.version(name) for name in ("mediapipe", "mediapipe-model-maker", "tensorflow")},
        runtime=dict(hand_options=V2_HAND_OPTIONS, frame_margin=V2_MARGIN, score_threshold=SCORE_THRESHOLD),
        usable_images=admitted, **source, test=result,
        camera_benchmark=dict(
            minimum_required_recall=0.9,
            below_target={letter: row["recall"] for letter, row in camera_rows.items() if row["recall"] < 0.9},
        ),
        limitations=[
            "Cropped photos only. Signer identities are unavailable.",
            "J and Z predictions classify poses, not the full motion.",
            "No labeled non-sign hands for measuring false accepts.",
        ],
    )
    (artifacts / task.name).write_bytes(bundle)
    (artifacts / task.name).with_suffix(".json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Exported {task.name}: {result['correct']}/{result['images']} correct ({result['accuracy']:.2%})", flush=True)
    print("Recall by letter:", {letter: round(row["recall"], 3) for letter, row in result["per_letter"].items()}, flush=True)
    print("Camera letters below 90%:", report["camera_benchmark"]["below_target"], flush=True)


if __name__ == "__main__":
    main()
