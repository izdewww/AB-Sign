"""Train all FSL-105 signs and compare against the bundled models on the same clips."""

import csv
import io
import json
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import PurePosixPath
from zipfile import ZipFile

import numpy as np

from train_vocabulary import (
    CONFIDENCE, FEATURES, FRAMES, MIN_HAND_FRAMES, ROOT, SEED, SOURCE, ZIP_HASH,
    METADATA_HASHES, POSE_HASH, digest, encode, export_layers, number_features, records,
)


IDS = tuple(str(i) for i in [*range(20, 30), *range(20), *range(30, 105)])
ARTIFACTS = ROOT / 'artifacts'
NUMBER_NAMES = 'ONE TWO THREE FOUR FIVE SIX SEVEN EIGHT NINE TEN'.split()
NUMBER_LABELS = np.array([*IDS[:10], 'other'])


def load_corpus():
    archive = SOURCE / 'fsl105-complete.zip'
    if digest(archive) != ZIP_HASH or any(digest(SOURCE / name) != checksum for name, checksum in METADATA_HASHES.items()):
        raise ValueError('The FSL-105 source files differ from the published checksums.')
    if digest(SOURCE / 'pose_landmarker_lite.task') != POSE_HASH:
        raise ValueError('The pose detector differs from the vocabulary detector.')

    paths = SOURCE / 'features-full-v2.npz'
    if not paths.is_file():
        with ZipFile(ARTIFACTS / 'fsl-az-v2.task') as alphabet:
            (SOURCE / 'vocabulary-hands.task').write_bytes(alphabet.read('hand_landmarker.task'))
        seeds = np.load(SOURCE / 'features-v1.npz') if (SOURCE / 'features-v1.npz').is_file() else None
        previous = {} if seeds is None else {path: (part, label, path, vector, hands)
            for part, label, path, vector, hands in zip(*(seeds[field] for field in ('splits', 'labels', 'paths', 'vectors', 'hands')))}
        rows = records(archive, IDS)
        ready, missing = [], []
        for row in rows:
            cached = previous.get(row[2].relative_to(SOURCE).as_posix())
            if cached is None:
                missing.append(row)
            else:
                if tuple(cached[:2]) != row[:2]:
                    raise ValueError('Cached clip split differs from the full split.')
                ready.append(cached)
        print(f'Extracting {len(missing)} new clips. Reusing {len(ready)} existing clips.', flush=True)
        with ThreadPoolExecutor(max_workers=6) as pool:
            for index, result in enumerate(pool.map(encode, missing), 1):
                ready.append(result)
                if index % 100 == 0:
                    print(f'Extracted {index}/{len(missing)}', flush=True)
        splits, labels, names, vectors, hands = zip(*ready)
        np.savez(paths, splits=splits, labels=labels, paths=names, vectors=vectors, hands=hands)
    corpus = np.load(paths)
    splits, labels, names, vectors, hands = (corpus[key] for key in ('splits', 'labels', 'paths', 'vectors', 'hands'))
    if len(set(names)) != 2130 or Counter(splits) != {'train': 1389, 'validation': 315, 'test': 426}:
        raise ValueError('The cached full corpus differs from the expected split.')
    return splits, labels, vectors, hands


def dense(tf, vectors, targets, validation, width, seed, weights=None):
    tf.keras.utils.set_random_seed(seed)
    model = tf.keras.Sequential([
        tf.keras.Input(vectors.shape[1:]),
        tf.keras.layers.Dense(width, activation='relu'), tf.keras.layers.Dropout(.25),
        tf.keras.layers.Dense(width // 2, activation='relu'), tf.keras.layers.Dropout(.15),
        tf.keras.layers.Dense(int(targets.max()) + 1, activation='softmax'),
    ])
    model.compile('adam', 'sparse_categorical_crossentropy')
    model.fit(vectors, targets, sample_weight=weights, validation_data=validation, epochs=100, batch_size=48, verbose=0,
              callbacks=[tf.keras.callbacks.EarlyStopping(patience=12, restore_best_weights=True)])
    return model


def measure(probability, labels, expected, hands, threshold, min_hands=2):
    predicted = labels[probability.argmax(axis=1)]
    predicted[(hands < min_hands) | (probability.max(axis=1) < threshold)] = ''
    scores = {}
    for label in sorted(set(expected), key=lambda label: (0, int(label)) if label.isdigit() else (1, label)):
        actual = expected == label
        accepted = predicted == label
        right = int((actual & accepted).sum())
        total = int(actual.sum())
        precision = right / max(1, int(accepted.sum()))
        scores[label] = dict(correct=right, clips=total, accepted=int(accepted.sum()), precision=precision,
                             recall=right / total, camera=total >= 3 and right / total >= .90 and precision >= .90)
    return scores


def qualified(scores, ids):
    return [label for label in ids if scores[label]['camera']]


def predict_export(model, data):
    for index, layer in enumerate(model['layers']):
        bias = np.array(layer['biases'], dtype=np.float32)
        matrix = np.array(layer['weights'], dtype=np.float32).reshape(len(bias), -1)
        data = data @ matrix.T + bias
        if index + 1 < len(model['layers']):
            data = np.maximum(data, 0)
    exp = np.exp(data - data.max(axis=1, keepdims=True))
    return exp / exp.sum(axis=1, keepdims=True)


def word_candidates(tf, splits, labels, vectors, hands):
    numerical = np.array([IDS.index(label) for label in labels])
    train = (splits == 'train') & (hands >= 1)
    valid = splits == 'validation'
    if set(numerical[train]) != set(range(len(IDS))):
        raise ValueError('At least one sign has zero detectable training clips.')
    flat = vectors.reshape(-1, FRAMES * FEATURES)
    shifts = np.concatenate([np.take(vectors[train], np.clip(np.arange(FRAMES) + shift, 0, FRAMES - 1), axis=1)
                             for shift in (-2, -1, 0, 1, 2)])
    rng = np.random.default_rng(SEED)
    shifts += rng.normal(0, .012, shifts.shape).astype(np.float32)
    runs = []
    for width in (128, 256):
        net = dense(tf, shifts.reshape(-1, FRAMES * FEATURES), np.tile(numerical[train], 5),
                    (flat[valid], numerical[valid]), width, SEED)
        probs = net.predict(flat, verbose=0)
        scores = measure(probs[valid], np.array(IDS), labels[valid], hands[valid], CONFIDENCE)
        runs.append((len(qualified(scores, IDS)), sum(row['correct'] for row in scores.values()), net, probs, width))
        print(f'Word width {width}: {runs[-1][0]} validation signs clear the cutoff, {runs[-1][1]} correct', flush=True)
    _, _, network, probability, width = max(runs, key=lambda run: run[:2])
    print(f'Selected word width {width}.', flush=True)
    return network, probability, int(train.sum())


def number_candidate(tf, splits, labels, features, hands, external=None):
    numerical = np.array([IDS.index(label) if label in IDS[:10] else 10 for label in labels])
    train = (splits == 'train') & (hands >= 2)
    valid = (splits == 'validation') & (hands >= 2)
    vectors, targets = features[train], numerical[train]
    weights = np.where(targets == 10, .065, 1.)
    if external is not None:
        extra, target = external
        vectors, targets = np.concatenate([vectors, extra]), np.concatenate([targets, target])
        weights = np.concatenate([weights, np.where(target == 10, .035, .5)])
    rng = np.random.default_rng(123)
    examples = np.tile(vectors, (5, 1))
    examples += rng.normal(0, .023, examples.shape)
    network = dense(tf, examples, np.tile(targets, 5), (features[valid], numerical[valid]), 96, 123, np.tile(weights, 5))
    return network, network.predict(features, verbose=0), int(train.sum())


def transactional_numbers(path):
    examples, targets = [], []
    checksum = digest(path)
    if checksum != '99be19d3b71a703b6c5a82d0b25587134fe2ede37dfb160896b79c46fed61788':
        raise ValueError('Unexpected Transactional FSL ZIP checksum.')
    with ZipFile(path) as archive:
        for name in sorted(archive.namelist()):
            clip = PurePosixPath(name)
            if clip.suffix != '.npy' or clip.parent.parent.name != 'recorded_data':
                continue
            data = np.load(io.BytesIO(archive.read(name)), allow_pickle=False)
            if data.shape != (75, 225) or not np.isfinite(data).all():
                raise ValueError(f'Unexpected landmark layout in {clip.name}.')
            active = data[np.any(data != 0, axis=1)]
            if not len(active):
                continue
            # The last 126 values are two 21-joint XYZ hands. Wrist normalization
            # in number_features removes the different pose origin and scale.
            hands = active[np.linspace(0, len(active) - 1, FRAMES, dtype=int), -126:].reshape(FRAMES, 2, 21, 3).copy()
            hands[..., 0] *= 4 / 3
            has_hand = np.any(hands != 0, axis=(2, 3))
            if has_hand.any(axis=1).sum() < 2:
                continue
            vector = np.zeros((FRAMES, FEATURES), dtype=np.float32)
            for slot, start in enumerate((21, 85)):
                vector[:, start] = has_hand[:, slot]
                vector[:, start + 1:start + 64] = hands[:, slot].reshape(FRAMES, 63)
            examples.append(number_features(vector))
            targets.append(NUMBER_NAMES.index(clip.parent.name) if clip.parent.name in NUMBER_NAMES else 10)
    if set(targets) != set(range(11)):
        raise ValueError('One or more number classes were missing from Transactional FSL.')
    return np.stack(examples), np.array(targets)


def compare_numbers(tf, splits, labels, features, hands):
    valid = splits == 'validation'
    test = splits == 'test'
    path = SOURCE / 'transactional-complete.zip'
    external = transactional_numbers(path) if path.is_file() else None
    runs = []
    for name, dataset in [('FSL-105', None), ('FSL-105 + Transactional FSL', external)]:
        if name != 'FSL-105' and dataset is None:
            continue
        net, probability, clips = number_candidate(tf, splits, labels, features, hands, dataset)
        stats = measure(probability[valid], NUMBER_LABELS, labels[valid], hands[valid], CONFIDENCE)
        validation = qualified(stats, IDS[:10])
        correct = sum(stats[label]['correct'] for label in IDS[:10])
        scores = measure(probability[test], NUMBER_LABELS, labels[test], hands[test], CONFIDENCE)
        runs.append((len(validation), correct, name, net, probability, clips, dict(validation=validation,
                    validation_correct=correct, passed=qualified(scores, IDS[:10]), per_number={label: scores[label] for label in IDS[:10]})))
        print(f'{name}: {len(validation)} numbers qualify on validation.', flush=True)
    _, _, name, network, probability, clips, _ = max(runs, key=lambda run: run[:2])
    print('Selected number model:', name, flush=True)
    report = {entry[2]: entry[-1] for entry in runs}
    if external is not None:
        report['transactional_clips'] = len(external[1])
        report['transactional_number_clips'] = int((external[1] < 10).sum())
    return network, probability, clips, name, report


def run():
    import tensorflow as tf

    tf.config.threading.set_intra_op_parallelism_threads(5)
    tf.config.threading.set_inter_op_parallelism_threads(2)
    splits, labels, vectors, hands = load_corpus()
    np.savez(SOURCE / 'number-features-v2.npz', data=np.stack([number_features(row) for row in vectors]))
    train_models(tf, splits, labels, vectors, hands)


def train_models(tf, splits, labels, vectors, hands):
    test = splits == 'test'
    features = np.load(SOURCE / 'number-features-v2.npz')['data']
    old = json.loads((ARTIFACTS / 'fsl-vocabulary-v1.json').read_text())
    old_word = predict_export(old, vectors[test].reshape(-1, FRAMES * FEATURES))
    old_number = predict_export(old['numbers'], features[test])
    baseline_words = measure(old_word, np.array(old['labels']), labels[test], hands[test], old['threshold'], MIN_HAND_FRAMES)
    baseline_numbers = measure(old_number, NUMBER_LABELS, labels[test], hands[test], old['numbers']['threshold'])
    print('Baseline results on all 426 clips recorded.', flush=True)

    net, prediction, word_clips = word_candidates(tf, splits, labels, vectors, hands)
    count, count_prediction, number_clips, number_source, number_comparison = compare_numbers(tf, splits, labels, features, hands)
    words = measure(prediction[test], np.array(IDS), labels[test], hands[test], CONFIDENCE)
    numeric = measure(count_prediction[test], NUMBER_LABELS, labels[test], hands[test], CONFIDENCE)
    scores = {label: numeric[label] if label in IDS[:10] else words[label] for label in IDS}
    baseline = {label: baseline_numbers[label] if label in IDS[:10] else baseline_words[label] for label in IDS}
    benchmark = dict(dataset='10.17632/48y2y99mb9.2', extracted_clips=len(labels), training_clips=word_clips,
                     number_training_clips=number_clips, validation_clips=int((splits == 'validation').sum()),
                     test_clips=int(test.sum()), camera=qualified(scores, IDS), baseline_camera=qualified(baseline, IDS),
                     per_sign=scores, baseline=baseline, number_source=number_source, number_comparison=number_comparison,
                     evaluation='Publisher split. Signer IDs and resting-hand clips unavailable. Prior subset results reviewed during development.')
    with (SOURCE / 'labels.csv').open(encoding='utf-8-sig', newline='') as file:
        benchmark['labels'] = {row['id']: row['label'].strip().title() for row in csv.DictReader(file)}
    bundle = dict(labels=list(IDS), threshold=CONFIDENCE, layers=export_layers(tf, net), frames=FRAMES, fps=4, minHands=2,
                  numbers=dict(labels=list(NUMBER_LABELS), threshold=CONFIDENCE, layers=export_layers(tf, count), minHands=2))
    np.testing.assert_allclose(predict_export(bundle, vectors[test].reshape(-1, FRAMES * FEATURES)), prediction[test], atol=2e-5)
    np.testing.assert_allclose(predict_export(bundle['numbers'], features[test]), count_prediction[test], atol=2e-5)
    output = SOURCE / 'fsl-vocabulary-v2.json'
    output.write_text(json.dumps(bundle, separators=(',', ':')) + '\n')
    benchmark['model_sha256'] = digest(output)
    (SOURCE / 'fsl-vocabulary-v2-benchmark.json').write_text(json.dumps(benchmark, indent=2) + '\n')
    print(f'Completed evaluation. Camera signs: {benchmark["camera"]}', flush=True)


if __name__ == '__main__':
    run()
