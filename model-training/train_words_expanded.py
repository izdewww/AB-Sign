"""Train one vocabulary model on the union of FSL-105 and Transactional FSL."""

import csv
import hashlib
import io
import json
from collections import Counter, defaultdict
from pathlib import PurePosixPath
from zipfile import ZipFile

import numpy as np

from train_vocabulary import CONFIDENCE, FEATURES, FRAMES, SEED, SOURCE, digest, export_layers
from train_vocabulary_full import IDS, NUMBER_NAMES, dense, load_corpus, measure, predict_export


TRANSACTIONAL_SHA = '99be19d3b71a703b6c5a82d0b25587134fe2ede37dfb160896b79c46fed61788'
ALIASES = {'HELLO': '3', 'THANK_YOU': '7', 'NO': '14', 'YES': '15'}
POSE = (0, 11, 12, 13, 14, 15, 16)


def align_transactional(data):
    active = data[np.any(data != 0, axis=1)]
    vectors = np.zeros((FRAMES, FEATURES), dtype=np.float32)
    if not len(active):
        return vectors, 0
    frames = active[np.linspace(0, len(active) - 1, FRAMES, dtype=int)]
    pose = frames[:, :99].reshape(FRAMES, 33, 3)
    hands = frames[:, 99:].reshape(FRAMES, 2, 21, 3)
    aspect = np.array([4 / 3, 1., 1.])
    center = (pose[:, 11] + pose[:, 12]) / 2
    span = np.linalg.norm((pose[:, 11, :2] - pose[:, 12, :2]) * aspect[:2], axis=1)
    present = np.any(pose != 0, axis=(1, 2)) & (span >= .04)

    def align(points):
        return np.clip((points - center[:, None]) * aspect / np.maximum(.04, span[:, None, None]), -5, 5)

    vectors[:, :21] = np.where(present[:, None], align(pose[:, POSE]).reshape(FRAMES, -1), 0)
    has_hand = np.any(hands != 0, axis=(2, 3)) & present[:, None]
    for slot, start in enumerate((21, 85)):
        vectors[:, start] = has_hand[:, slot]
        vectors[:, start + 1:start + 64] = np.where(has_hand[:, slot, None], align(hands[:, slot]).reshape(FRAMES, -1), 0)
    return vectors, int(has_hand.any(axis=1).sum())


def hand_signature(data):
    """Group exact and mirror/scale copies when their hand sequences agree."""
    hands = data[:, 99:].reshape(-1, 2, 21, 3).copy()
    present = np.any(hands != 0, axis=(2, 3))
    if not present.any():
        return None
    points = hands[present]
    center = points.mean(axis=(0, 1))
    span = max(1e-6, np.linalg.norm(points - center, axis=-1).max())
    hands[present] = (points - center) / span
    mirror = hands[:, ::-1].copy()
    mirror[..., 0] *= -1
    return min(hashlib.sha256(np.rint(sample * 2000).astype('<i2').tobytes()).hexdigest() for sample in (hands, mirror))


def transactional():
    path = SOURCE / 'transactional-complete.zip'
    if digest(path) != TRANSACTIONAL_SHA:
        raise ValueError('Unexpected Transactional FSL archive checksum.')
    entries = defaultdict(list)
    with ZipFile(path) as archive:
        for name in sorted(archive.namelist()):
            clip = PurePosixPath(name)
            if clip.suffix != '.npy' or clip.parent.parent.name != 'recorded_data':
                continue
            word = clip.parent.name
            label = str(20 + NUMBER_NAMES.index(word)) if word in NUMBER_NAMES else ALIASES.get(word, 'txn-' + word.lower().replace('_', '-'))
            data = np.load(io.BytesIO(archive.read(name)), allow_pickle=False)
            if data.shape != (75, 225) or not np.isfinite(data).all():
                raise ValueError(f'Unexpected landmarks in {clip.name}.')
            number = int(clip.stem.rsplit('_', 1)[-1])
            entries[label].append((number, *align_transactional(data), hand_signature(data)))
    if sum(map(len, entries.values())) != 1107:
        raise ValueError('Transactional FSL recordings are missing.')

    rows = []
    for label, examples in entries.items():
        groups = {}
        examples.sort(key=lambda x: x[0])
        for index, (number, _, _, signature) in enumerate(examples):
            part = 0 if index < int(.70 * len(examples)) else 1 if index < int(.85 * len(examples)) else 2
            key = signature or number
            groups[key] = max(part, groups.get(key, 0))
        for number, vectors, hands, signature in examples:
            rows.append((('train', 'validation', 'test')[groups[signature or number]], label, vectors, hands))
    splits, labels, vectors, hands = zip(*rows)
    return np.array(splits), np.array(labels), np.stack(vectors), np.array(hands)


def without_depth(vectors):
    result = vectors.copy()
    for start, stop in ((0, 21), (22, 85), (86, 149)):
        result[:, :, start + 2:stop:3] = 0
    return result


def evaluate(model, data, ids, part, transform):
    splits, labels, vectors, hands = data
    mask = splits == part
    values = transform(vectors[mask]).reshape(mask.sum(), FRAMES * FEATURES)
    probability = model.predict(values, verbose=0)
    return score(probability, labels[mask], hands[mask], ids)


def score(probability, expected, hands, ids):
    correct = int((ids[probability.argmax(axis=1)] == expected).sum())
    rows = measure(probability, ids, expected, hands, CONFIDENCE)
    return dict(clips=len(expected), top1_correct=correct, per_sign=rows,
                passing=[label for label, row in rows.items() if label not in IDS[:10] and row['camera']])


def train():
    import tensorflow as tf

    tf.config.threading.set_intra_op_parallelism_threads(5)
    tf.config.threading.set_inter_op_parallelism_threads(2)
    fsl, extra = load_corpus(), transactional()
    joined = tuple(np.concatenate((left, right)) for left, right in zip(fsl, extra))
    splits, labels, vectors, hands = joined
    new = sorted(set(extra[1]) - set(IDS))
    ids = np.array([*IDS, *new])
    train_mask = (splits == 'train') & (hands > 0)
    valid = splits == 'validation'
    if len(new) != 12 or set(labels[train_mask]) != set(ids):
        raise ValueError('A vocabulary label is missing from the training split.')
    print(f'{len(ids)-10} words and phrases, 10 number distractors. Split counts:', Counter(splits), flush=True)
    original = np.arange(len(labels)) < len(fsl[1])
    indices = {label: index for index, label in enumerate(ids)}
    target = np.array([indices[label] for label in labels])
    candidates = []
    for layout, transform in [('xyz', lambda x: x), ('xy', without_depth)]:
        points = transform(vectors)
        windows = np.concatenate([np.take(points[train_mask], np.clip(np.arange(FRAMES) + shift, 0, FRAMES - 1), axis=1)
                                  for shift in (-2, -1, 0, 1, 2)])
        rng = np.random.default_rng(SEED)
        windows += rng.normal(0, .012, windows.shape).astype(np.float32)
        weights = np.where(original[train_mask], 1., .75)
        model = dense(tf, windows.reshape(-1, FRAMES * FEATURES), np.tile(target[train_mask], 5),
                      (points[valid].reshape(-1, FRAMES * FEATURES), target[valid]), 128, SEED, np.tile(weights, 5))
        a = evaluate(model, fsl, ids, 'validation', transform)
        b = evaluate(model, extra, ids, 'validation', transform)
        new_pass = sum(label in new for label in b['passing'])
        rank = (len(a['passing']) + new_pass, a['top1_correct'] + b['top1_correct'])
        print(layout, 'validation:', len(a['passing']), 'FSL-105,', new_pass, 'new signs', flush=True)
        candidates.append((rank, layout, transform, model))

    _, layout, transform, model = max(candidates, key=lambda entry: entry[0])
    baseline = json.loads((SOURCE / 'fsl-vocabulary-v2.json').read_text())
    bundle = dict(labels=ids.tolist(), threshold=CONFIDENCE, minHands=2, fps=4, frames=FRAMES,
                  layout=layout, layers=export_layers(tf, model))
    output = SOURCE / 'fsl-words-v3.json'
    output.write_text(json.dumps(bundle, separators=(',', ':')) + '\n')

    primary, secondary, combined = (evaluate(model, data, ids, 'test', transform) for data in (fsl, extra, joined))
    baseline_mask = fsl[0] == 'test'
    baseline_rows = score(predict_export(baseline, fsl[2][baseline_mask].reshape(-1, FRAMES * FEATURES)),
                          fsl[1][baseline_mask], fsl[3][baseline_mask], np.array(baseline['labels']))
    names = dict(zip(new, [label.removeprefix('txn-').replace('-', ' ').title() for label in new]))
    with (SOURCE / 'labels.csv').open(encoding='utf-8-sig', newline='') as file:
        names.update({row['id']: row['label'].strip().title() for row in csv.DictReader(file)})
    report = dict(model_sha256=digest(output), datasets={'fsl105': '10.17632/48y2y99mb9.2', 'transactional': '10.17632/jdyrr7cm4z.2'},
                  layout=layout, words=len(ids) - 10, number_distractors=10, new_labels=new, labels=names,
                  fsl105_split=dict(Counter(fsl[0])), transactional_split=dict(Counter(extra[0])),
                  usable_training=dict(fsl105=int((train_mask & original).sum()), transactional=int((train_mask & ~original).sum())),
                  fsl105=primary, transactional=secondary, combined=combined, fsl105_v2_word_head=baseline_rows,
                  new_passing=[label for label in combined['passing'] if label in new],
                  evaluation='FSL-105 publisher split. Transactional FSL grouped by matching hand signatures and split by filename order. Signer IDs and augmentation provenance are unavailable.')
    (SOURCE / 'fsl-words-v3-benchmark.json').write_text(json.dumps(report, indent=2) + '\n')
    for data in (fsl, extra):
        mask = data[0] == 'test'
        features = transform(data[2][mask]).reshape(-1, FRAMES * FEATURES)
        probability = model.predict(features, verbose=0)
        np.testing.assert_allclose(predict_export(bundle, features), probability, atol=2e-5)
    print('FSL-105 passing:', len(primary['passing']), 'combined passing:', len(combined['passing']),
          'new passing:', [names[label] for label in report['new_passing']], flush=True)


if __name__ == '__main__':
    train()
