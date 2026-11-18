"""Train and evaluate an experimental FSL A/B/C Gesture Recognizer task."""

import argparse
import hashlib
import importlib.metadata
import importlib.util
import json
import os
import random
import re
import sys
import tempfile
import types
import zipfile
from collections import Counter, defaultdict, deque
from pathlib import Path, PurePosixPath


ROOT = Path(__file__).resolve().parent
WORK = ROOT / ".work"
ARCHIVE = WORK / "fsl-dataset-v1.zip"
ARCHIVE_HASH = "cddcc7e896ac1a1427f0fa5c2aefb321b6f0b715b9b8072d775f3047b075a15f"
LABELS = ("A", "B", "C", "none")
SEED = 2718
V2_MARGIN = 0.20
V2_HAND_OPTIONS = {
    "min_hand_detection_confidence": 0.25,
    "min_hand_presence_confidence": 0.25,
}


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for block in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def sample_group(path):
    stem = re.sub(r"_jpg\.rf\.[a-f0-9]+$", "", path.stem, flags=re.I)
    stem = re.sub(r"(?: \(\d+\)| - Copy|-\d+-)$", "", stem, flags=re.I)
    if re.fullmatch(r"\d+", stem):
        return "train", stem
    if re.fullmatch(rf"{path.parent.name}_\d+", stem, flags=re.I):
        return "validation", stem.lower()
    if re.fullmatch(r"Image_\d+\.\d+", stem, flags=re.I):
        return "test", stem.lower()
    return None


def prepare(archive, destination):
    if sha256(archive) != ARCHIVE_HASH:
        raise ValueError("Expected the verified Kaggle v1 archive")

    splits = {name: defaultdict(list) for name in ("train", "validation", "test")}
    seen_bytes = set()
    duplicates = 0
    with zipfile.ZipFile(archive) as images:
        for name in sorted(images.namelist()):
            path = PurePosixPath(name)
            if len(path.parts) != 3 or path.parts[0] != "Collated" or path.suffix != ".jpg":
                continue
            letter = path.parent.name
            if letter in {"J", "Z"} or not re.fullmatch(r"[A-Z]", letter):
                continue
            group = sample_group(path)
            if group is None:
                continue
            split, stem = group
            data = images.read(name)
            digest = hashlib.sha256(data).digest()
            if digest in seen_bytes:
                duplicates += 1
                continue
            seen_bytes.add(digest)
            splits[split][letter].append((stem, name, data))

        counts = {}
        for split, by_letter in splits.items():
            selected = {letter: by_letter[letter] for letter in LABELS[:-1]}
            if split != "train":
                for letter, records in selected.items():
                    selected[letter] = one_per_source(records)
            rng = random.Random(SEED)
            negatives = []
            for letter in sorted(set(by_letter) - set(selected)):
                records = one_per_source(by_letter[letter])
                rng.shuffle(records)
                negatives.append(deque(records))
            target = sum(map(len, selected.values())) // 3
            selected["none"] = []
            while len(selected["none"]) < target:
                if not any(negatives):
                    raise ValueError(f"Insufficient negative samples for {split}")
                for records in negatives:
                    if records and len(selected["none"]) < target:
                        selected["none"].append(records.popleft())
            counts[split] = {}
            for label, records in selected.items():
                if not records:
                    raise ValueError(f"No images for {split}/{label}")
                folder = destination / split / label
                folder.mkdir(parents=True)
                for index, (_, name, data) in enumerate(records):
                    source_label = PurePosixPath(name).parent.name
                    (folder / f"{source_label}-{index:04d}.jpg").write_bytes(data)
                counts[split][label] = len(records)
    return counts, duplicates


def one_per_source(records):
    unique = {}
    for stem, name, data in sorted(records, key=lambda record: (len(record[1]), record[1])):
        unique.setdefault(stem, (stem, name, data))
    return list(unique.values())


def load_model_maker():
    # Model Maker 0.2.1.4 eagerly imports unrelated NLP tasks with Linux-only
    # dependencies. On Windows, load its installed vision package directly.
    if os.name == "nt":
        spec = importlib.util.find_spec("mediapipe_model_maker")
        package = types.ModuleType(spec.name)
        package.__path__ = spec.submodule_search_locations
        sys.modules[spec.name] = package
    from mediapipe_model_maker.python.vision import gesture_recognizer

    return gesture_recognizer


def add_frame_margin(image, margin):
    import cv2
    import numpy as np

    vertical, horizontal = (round(size * margin) for size in image.shape[:2])
    corner_size = min(8, *image.shape[:2])
    corners = np.stack([
        image[:corner_size, :corner_size], image[:corner_size, -corner_size:],
        image[-corner_size:, :corner_size], image[-corner_size:, -corner_size:],
    ])
    background = tuple(map(float, np.median(corners, axis=(0, 1, 2))))
    return cv2.copyMakeBorder(
        image, vertical, vertical, horizontal, horizontal,
        cv2.BORDER_CONSTANT, value=background,
    )


def pad_training_split(source, destination, margin):
    import cv2

    for label in LABELS:
        folder = destination / label
        folder.mkdir(parents=True)
        for path in sorted((source / label).glob("*.jpg")):
            image = cv2.imread(str(path))
            if image is None or not cv2.imwrite(str(folder / (path.stem + ".png")), add_frame_margin(image, margin)):
                raise ValueError(f"Could not prepare padded frame {path.name}")
    return destination


def evaluate_task(model_path, test_dir, *, hand_options=None, frame_margin=0.0):
    import mediapipe as mp

    options = mp.tasks.vision.GestureRecognizerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(model_path)),
        **(hand_options or {}),
    )
    columns = (*LABELS, "no_hand")
    confusion = {label: dict.fromkeys(columns, 0) for label in LABELS}
    with mp.tasks.vision.GestureRecognizer.create_from_options(options) as recognizer:
        for current in LABELS:
            for image in sorted((test_dir / current).glob("*.jpg")):
                frame = mp.Image.create_from_file(str(image))
                if frame_margin:
                    frame = mp.Image(
                        image_format=mp.ImageFormat.SRGB,
                        data=add_frame_margin(frame.numpy_view(), frame_margin),
                    )
                result = recognizer.recognize(frame)
                predicted = "no_hand"
                if result.hand_landmarks:
                    predicted = "none"
                    if result.gestures and result.gestures[0]:
                        best = result.gestures[0][0].category_name
                        if best in LABELS[:-1]:
                            predicted = best
                confusion[current][predicted] += 1
    support = {label: sum(confusion[label].values()) for label in LABELS}
    if not all(support.values()):
        raise ValueError("The task evaluation requires test examples for every label")
    total = sum(support.values())
    per_label = {}
    for label, actual in support.items():
        matches = confusion[label][label]
        predictions = sum(row[label] for row in confusion.values())
        per_label[label] = {
            "precision": matches / predictions if predictions else 0.0,
            "recall": matches / actual,
            "f1": 2 * matches / (actual + predictions),
        }
    return {
        "images": total,
        "accuracy_including_no_hand_as_miss": sum(confusion[c][c] for c in LABELS) / total,
        "negative_false_accept_rate": sum(confusion["none"][c] for c in LABELS[:-1]) / support["none"],
        "per_label": per_label,
        "confusion": confusion,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", choices=("v1", "v2"), default="v1")
    version = parser.parse_args().version

    os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
    os.environ.setdefault("MPLCONFIGDIR", str(WORK / "matplotlib"))
    assets = WORK / "tmp"
    if not (assets / "model_maker" / "gesture_recognizer" / "gesture_embedder" / "saved_model.pb").is_file():
        raise FileNotFoundError("Prepare the Google pretrained files as described in README.md")
    tempfile.tempdir = str(assets)

    import tensorflow as tf

    maker = load_model_maker()
    tf.config.threading.set_intra_op_parallelism_threads(2)
    tf.config.threading.set_inter_op_parallelism_threads(2)
    tf.keras.utils.set_random_seed(SEED)

    artifacts = ROOT / "artifacts"
    artifacts.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=WORK) as work_dir:
        workspace = Path(work_dir)
        photos = workspace / "photos"
        export = workspace / "export"
        counts, duplicates = prepare(ARCHIVE, photos)
        print("Prepared images:", counts, "Exact duplicate files skipped:", duplicates, flush=True)
        train_dir, validation_dir = photos / "train", photos / "validation"
        hand_preprocessing = maker.HandDataPreprocessingParams()
        if version == "v2":
            train_dir = pad_training_split(train_dir, workspace / "padded-train", V2_MARGIN)
            validation_dir = pad_training_split(validation_dir, workspace / "padded-validation", V2_MARGIN)
            hand_preprocessing.min_detection_confidence = V2_HAND_OPTIONS["min_hand_detection_confidence"]
        train = maker.Dataset.from_folder(str(train_dir), hand_preprocessing)
        validation = maker.Dataset.from_folder(str(validation_dir), hand_preprocessing)
        if train.label_names != validation.label_names or set(train.label_names) != set(LABELS):
            raise ValueError("Model Maker label order or coverage differs across splits")
        print(f"Usable images after hand detection: {train.size} train, {validation.size} validation", flush=True)
        options = maker.GestureRecognizerOptions(
            hparams=maker.HParams(export_dir=str(export), epochs=30, batch_size=32),
            model_options=maker.ModelOptions(layer_widths=[64]),
        )
        recognizer = maker.GestureRecognizer.create(train, validation, options)
        model_name = f"fsl-abc-{version}.task"
        recognizer.export_model(model_name)
        model = export / model_name
        report = {
            "model": model_name,
            "model_sha256": sha256(model),
            "dataset": "japorton/fsl-dataset/versions/1",
            "dataset_license": "CC0-1.0 (listed by Kaggle)",
            "archive_sha256": ARCHIVE_HASH,
            "split": {"train": "numeric", "validation": "letter-prefixed", "test": "Image_"},
            "validation_limit": "Filename-family split only. Signer identities are unavailable. Cropped still images only.",
            "seed": SEED,
            "versions": {name: importlib.metadata.version(name) for name in ("mediapipe", "mediapipe-model-maker", "tensorflow")},
            "labels": train.label_names,
            "image_counts": counts,
            "exact_duplicates_skipped": duplicates,
            "usable_train": train.size,
            "usable_validation": validation.size,
        }
        if version == "v2":
            runtime = {"hand_options": V2_HAND_OPTIONS, "frame_margin": V2_MARGIN}
            previous_model = artifacts / "fsl-abc-v1.task"
            report["runtime"] = runtime
            report["validation_limit"] += " The v1 test split is reused as a regression comparison."
            report["validation"] = {
                "v1_defaults": evaluate_task(previous_model, photos / "validation"),
                "v1_with_v2_runtime": evaluate_task(previous_model, photos / "validation", **runtime),
                "v2_with_v2_runtime": evaluate_task(model, photos / "validation", **runtime),
            }
            report["test_comparison"] = {
                "v1_defaults": evaluate_task(previous_model, photos / "test"),
                "v1_with_v2_runtime": evaluate_task(previous_model, photos / "test", **runtime),
                "v2_defaults": evaluate_task(model, photos / "test"),
            }
            report["test"] = evaluate_task(model, photos / "test", **runtime)
        else:
            report["test"] = evaluate_task(model, photos / "test")
        model.replace(artifacts / model_name)
        (artifacts / Path(model_name).with_suffix(".json")).write_text(
            json.dumps(report, indent=2) + "\n", encoding="utf-8",
        )
        print(json.dumps(report["test"], indent=2), flush=True)


if __name__ == "__main__":
    main()
