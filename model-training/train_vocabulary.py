"""Train isolated Filipino Sign Language signs and prepare editable lesson demos."""

import csv
import hashlib
import json
import os
import random
import shutil
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import local
from zipfile import ZipFile

from train_abc import ROOT, WORK, SEED

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
os.environ.setdefault("MPLCONFIGDIR", str(WORK / "matplotlib"))
os.environ.setdefault("GLOG_minloglevel", "2")
import cv2
import numpy as np

SOURCE = WORK / "fsl105"
POSE_HASH = "59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a"
ZIP_HASH = "c048c0820be1621101dfedeabb76a9fbfca76ed2868eebe23b4cb90d5c748463"
METADATA_HASHES = {
    "labels.csv": "6074947fc905eecf20a341388551aeab0b32341928778a1f87d6c3bca073b630",
    "train.csv": "861a76cae835e284ac76ef37dc077ae0b6c793beb9c378eda1fce5f408dc609f",
    "test.csv": "3dd8e83294a63b7c02fd1ee3ebd1d179aa4b0437ff9cfb3febab5d0e1da0ccf7",
}
FRAMES = 16
FPS = 4
FEATURES = 149
POSE = (0, 11, 12, 13, 14, 15, 16)
CONFIDENCE = .65
MIN_HAND_FRAMES = 5
GROUPS = [
    ("numbers", "Numbers 1–5", [20, 21, 22, 23, 24]),
    ("numbers", "Numbers 6–10", [25, 26, 27, 28, 29]),
    ("greetings", "Hello and thank you", [3, 7, 8, 0]),
    ("family", "My family", [52, 53, 54, 55]),
    ("food", "Food and colors", [72, 74, 78, 85, 86, 91]),
    ("words", "Everyday signs", [14, 15, 16, 17, 18, 19]),
]
IDS = tuple(str(key) for _, _, keys in GROUPS for key in keys)
worker = local()
cv2.setNumThreads(1)


def digest(path):
    with path.open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest() if hasattr(hashlib, "file_digest") else hash_chunks(file)


def hash_chunks(file):
    result = hashlib.sha256()
    for block in iter(lambda: file.read(1024 * 1024), b""):
        result.update(block)
    return result.hexdigest()


def vector(pose, both, aspect):
    if len(pose) < 33:
        return np.zeros(FEATURES, np.float32), False
    left, right = pose[11], pose[12]
    x, y, z = ((left.x + right.x) / 2, (left.y + right.y) / 2, (left.z + right.z) / 2)
    scale = max(.04, np.hypot((left.x - right.x) * aspect, left.y - right.y))
    def coords(points):
        return [np.clip(value, -5, 5) for p in points for value in ((p.x - x) * aspect / scale, (p.y - y) / scale, (p.z - z) / scale)]
    output = coords([pose[idx] for idx in POSE])
    for hand in both:
        present = len(hand) == 21
        output += [float(present)] + (coords(hand) if present else [0] * 63)
    return np.asarray(output, np.float32), any(len(hand) == 21 for hand in both)


def encode(record):
    import mediapipe as mp
    split, label, path = record
    if not hasattr(worker, "pose"):
        pose_config = mp.tasks.vision.PoseLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=str(SOURCE / "pose_landmarker_lite.task")),
            min_pose_detection_confidence=.3, min_pose_presence_confidence=.3,
        )
        hand_config = mp.tasks.vision.HandLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=str(SOURCE / "vocabulary-hands.task")),
            num_hands=2, min_hand_detection_confidence=.3, min_hand_presence_confidence=.3,
        )
        worker.pose = mp.tasks.vision.PoseLandmarker.create_from_options(pose_config)
        worker.hands = mp.tasks.vision.HandLandmarker.create_from_options(hand_config)
    video = cv2.VideoCapture(str(path))
    length = max(1, int(video.get(cv2.CAP_PROP_FRAME_COUNT)))
    indices = np.linspace(0, length - 1, FRAMES, dtype=int)
    frames, seen = [], 0
    current = -1
    picture = None
    try:
        for index in indices:
            while current < index:
                if not video.grab():
                    break
                current += 1
                if current == index:
                    ok, decoded = video.retrieve()
                    picture = decoded if ok else None
            if picture is None:
                frames.append(np.zeros(FEATURES, np.float32))
                continue
            height, width = picture.shape[:2]
            picture_rgb = cv2.cvtColor(picture, cv2.COLOR_BGR2RGB)
            frame = mp.Image(image_format=mp.ImageFormat.SRGB, data=picture_rgb)
            poses = worker.pose.detect(frame).pose_landmarks
            result = worker.hands.detect(frame)
            both = [[], []]
            for points, category in zip(result.hand_landmarks, result.handedness):
                both[0 if category[0].category_name == "Left" else 1] = points
            values, hands = vector(poses[0] if poses else [], both, width / height)
            frames.append(values)
            seen += hands
    finally:
        video.release()
    return split, label, str(path.relative_to(SOURCE)).replace("\\", "/"), np.stack(frames), seen


def records(archive_path, ids=IDS):
    video_dir = SOURCE / "videos"
    video_dir.mkdir(exist_ok=True)
    rows = []
    with ZipFile(archive_path) as archive:
        locations = {name.replace("\\", "/").lower(): name for name in archive.namelist() if not name.endswith("/")}
        for split in ("train", "test"):
            with (SOURCE / (split + ".csv")).open(encoding="utf-8-sig", newline="") as stream:
                source = list(csv.DictReader(stream))
            chosen = []
            for label in ids:
                items = sorted({row["vid_path"].replace("\\", "/") for row in source if row["id_label"] == label})
                if split == "train":
                    random.Random(f"{SEED}-{label}").shuffle(items)
                chosen.extend((("validation" if i < 3 else "train") if split == "train" else "test", label, name)
                              for i, name in enumerate(items))
            for part, label, name in chosen:
                path = video_dir.joinpath(*Path(name).parts)
                if not path.is_file():
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_bytes(archive.read(locations[name.lower()]))
                rows.append((part, label, path))
    paths = [row[2] for row in rows]
    if len(set(paths)) != len(paths):
        raise ValueError("Dataset clip paths overlap across splits")
    return rows


def number_features(sequence):
    shapes = []
    for frame in sequence:
        for start in (21, 85):
            if not frame[start]:
                continue
            points = frame[start + 1:start + 64].reshape(21, 3)
            shape = points - points[0]
            if start == 21:
                shape[:, 0] *= -1
            size = np.linalg.norm(shape, axis=1).max()
            if size > 1e-5:
                shapes.append(shape / size)
    if not shapes:
        return np.zeros(126, np.float32)
    return np.concatenate([np.median(shapes, axis=0).flatten(), np.std(shapes, axis=0).flatten()])


def train_numbers(tf, split, labels, vectors, hands):
    tf.keras.utils.set_random_seed(123)
    features = np.stack([number_features(sequence) for sequence in vectors])
    other = 10
    classes = np.minimum(labels, other)
    training = (split == 'train') & (hands >= 2)
    validation = (split == 'validation') & (hands >= 2)
    rng = np.random.default_rng(123)
    examples = np.tile(features[training], (6, 1))
    examples += rng.normal(0, .025, examples.shape)
    targets = np.tile(classes[training], 6)
    net = tf.keras.Sequential([
        tf.keras.Input((126,)), tf.keras.layers.Dense(96, activation='relu'),
        tf.keras.layers.Dropout(.2), tf.keras.layers.Dense(11, activation='softmax'),
    ])
    net.compile('adam', 'sparse_categorical_crossentropy')
    net.fit(examples, targets, sample_weight=np.where(targets == other, .15, 1), epochs=120,
            validation_data=(features[validation], classes[validation]), verbose=0,
            callbacks=[tf.keras.callbacks.EarlyStopping(patience=12, restore_best_weights=True)])
    probabilities = net.predict(features, verbose=0)
    predictions = np.where((hands >= 2) & (probabilities.max(axis=1) >= CONFIDENCE), probabilities.argmax(axis=1), -1)
    return net, probabilities, predictions, int(training.sum()), int(validation.sum())


def export_layers(tf, model):
    return [dict(weights=weight.T.flatten().tolist(), biases=bias.tolist())
            for layer in model.layers if isinstance(layer, tf.keras.layers.Dense)
            for weight, bias in [layer.get_weights()]]


def train():
    import tensorflow as tf
    import imageio_ffmpeg

    tf.config.threading.set_intra_op_parallelism_threads(4)
    tf.config.threading.set_inter_op_parallelism_threads(2)
    tf.keras.utils.set_random_seed(SEED)
    weights_path = SOURCE / "pose_landmarker_lite.task"
    with ZipFile(ROOT / "artifacts" / "fsl-az-v2.task") as letter_model:
        (SOURCE / "vocabulary-hands.task").write_bytes(letter_model.read("hand_landmarker.task"))
    archive_path = SOURCE / "clips.zip"
    subset = SOURCE / "manifest-clips.json"
    if subset.is_file():
        manifest = json.loads(subset.read_text())
        archive_path = SOURCE / "fsl105-selected-source.zip"
        archive_ok = manifest["archive_sha256"] == ZIP_HASH and digest(archive_path) == manifest["subset_sha256"]
    else:
        archive_ok = archive_path.is_file() and digest(archive_path) == ZIP_HASH
    if digest(weights_path) != POSE_HASH or not archive_ok:
        raise ValueError("Download verification failed.")
    for name, checksum in METADATA_HASHES.items():
        if digest(SOURCE / name) != checksum:
            raise ValueError(f"{name} differs from the FSL-105 v2 metadata.")
    cache = SOURCE / "features-v1.npz"
    if not cache.is_file():
        rows = records(archive_path)
        print("Extracting sequences from", len(rows), "clips", flush=True)
        with ThreadPoolExecutor(max_workers=4) as pool:
            encoded = []
            for index, row in enumerate(pool.map(encode, rows), 1):
                encoded.append(row)
                if index % 50 == 0:
                    print("Extracted", index, flush=True)
        splits, labels, paths, vectors, hands = zip(*encoded)
        np.savez(cache, splits=splits, labels=labels, paths=paths, vectors=vectors, hands=hands)
    data = np.load(cache)
    split, labels, paths, vectors, hands = (data[key] for key in ("splits", "labels", "paths", "vectors", "hands"))
    labels = np.array([IDS.index(label) for label in labels])
    training = (split == "train") & (hands >= MIN_HAND_FRAMES)
    validation = (split == "validation") & (hands >= MIN_HAND_FRAMES)
    test = split == "test"
    flat = vectors.reshape(-1, FRAMES * FEATURES)
    if set(labels[training]) != set(range(len(IDS))):
        raise ValueError("At least one label has no usable training clips")
    print("Usable training:", int(training.sum()), "validation:", int(validation.sum()), "held-out:", int(test.sum()), flush=True)
    rng = np.random.default_rng(SEED)
    train_vectors = vectors[training]
    augmented = np.concatenate([train_vectors,
        np.take(train_vectors, np.clip(np.arange(FRAMES) - 1, 0, FRAMES - 1), axis=1),
        np.take(train_vectors, np.clip(np.arange(FRAMES) + 1, 0, FRAMES - 1), axis=1)])
    augmented += rng.normal(0, .012, augmented.shape).astype(np.float32)
    net = tf.keras.Sequential([
        tf.keras.Input((FRAMES * FEATURES,)),
        tf.keras.layers.Dense(96, activation="relu"), tf.keras.layers.Dropout(.30),
        tf.keras.layers.Dense(48, activation="relu"),
        tf.keras.layers.Dense(len(IDS), activation="softmax"),
    ])
    net.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    net.fit(augmented.reshape(-1, FRAMES * FEATURES), np.tile(labels[training], 3),
            validation_data=(flat[validation], labels[validation]), epochs=95, batch_size=32, verbose=2,
            callbacks=[tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=12, restore_best_weights=True)])
    probability = net.predict(flat, verbose=0)
    predictions = np.where((hands >= MIN_HAND_FRAMES) & (probability.max(axis=1) >= CONFIDENCE), probability.argmax(axis=1), -1)
    number_net, number_probability, number_predictions, number_training, number_validation = train_numbers(tf, split, labels, vectors, hands)
    per_sign = {}
    for index, key in enumerate(IDS):
        candidate = number_predictions if index < 10 else predictions
        actual, guessed = test & (labels == index), test & (candidate == index)
        correct, total, accepted = int((actual & guessed).sum()), int(actual.sum()), int(guessed.sum())
        per_sign[key] = dict(correct=correct, clips=total, precision=correct / max(1, accepted),
                             camera=total >= 3 and correct / total >= .90 and correct / max(1, accepted) >= .90)
    with (SOURCE / "labels.csv").open(encoding="utf-8-sig", newline="") as file:
        names = {row["id"]: row["label"].strip().title() for row in csv.DictReader(file)}
    names["8"] = "You're Welcome"
    public = ROOT.parent / "src" / "renderer" / "public" / "vocabulary"
    public.mkdir(parents=True, exist_ok=True)
    catalog = []
    for position, (category, title, keys) in enumerate(GROUPS):
        terms = []
        for raw in keys:
            key = str(raw)
            index = IDS.index(key)
            scores = number_probability if index < 10 else probability
            eligible = ((split == "train") & (hands >= 2)) if index < 10 else training
            candidates = np.flatnonzero(eligible & (labels == index))
            best = int(max(candidates, key=lambda item: scores[item, index]))
            clip = SOURCE / paths[best]
            destination = public / f"fsl-{key}.webm"
            subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-i", str(clip),
                            "-an", "-c:v", "libvpx-vp9", "-b:v", "170k", "-pix_fmt", "yuv420p", "-vf", "scale=480:-2",
                            str(destination)], check=True)
            term = str(raw - 19) if category == "numbers" else names[key]
            terms.append(dict(id=key, term=term, camera=per_sign[key]["camera"], source=str(paths[best])))
        catalog.append(dict(id=f"vocabulary-{position+1}", category=category, title=title, terms=terms))
    catalog.append(dict(id="numbers-11-20", category="numbers", title="Numbers 11–20",
                        terms=[dict(term=str(n), camera=False) for n in range(11, 21)]))
    artifacts = ROOT / "artifacts"
    bundle = dict(labels=list(IDS), threshold=CONFIDENCE, layers=export_layers(tf, net), frames=FRAMES, fps=FPS,
                  minHands=MIN_HAND_FRAMES, numbers=dict(labels=[*IDS[:10], "other"], threshold=CONFIDENCE,
                  layers=export_layers(tf, number_net), minHands=2))
    (artifacts / "fsl-vocabulary-v1.json").write_text(json.dumps(bundle, separators=(",", ":")) + "\n", encoding="utf8")
    (ROOT.parent / "src" / "renderer" / "vocabulary.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf8")
    shutil.copyfile(weights_path, artifacts / "vocabulary-pose.task")
    shutil.copyfile(SOURCE / "vocabulary-hands.task", artifacts / "vocabulary-hands.task")
    report = dict(dataset="10.17632/48y2y99mb9.2", pose_sha256=POSE_HASH,
                  hands_sha256=digest(artifacts / "vocabulary-hands.task"), archive_sha256=ZIP_HASH,
                  model_sha256=digest(artifacts / "fsl-vocabulary-v1.json"), train_clips=int(training.sum()),
                  validation_clips=int(validation.sum()), test_clips=int(test.sum()), per_sign=per_sign,
                  number_train_clips=number_training, number_validation_clips=number_validation,
                  camera=[dict(id=key, label=names[key]) for key in IDS if per_sign[key]["camera"]],
                  evaluation="Publisher-provided test split. Signer identities and non-sign clips were unavailable.")
    (artifacts / "fsl-vocabulary-v1-benchmark.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf8")
    print("Camera enabled:", report["camera"], flush=True)


if __name__ == "__main__":
    train()
