"""Train the desktop number model with FSL-105 and Transactional FSL."""

import json

import numpy as np

from train_vocabulary import CONFIDENCE, FRAMES, digest, export_layers
from train_vocabulary_full import ARTIFACTS, IDS, dense, load_corpus, measure, predict_export
from train_words_expanded import transactional


LABELS = np.array([*IDS[:10], 'other'])


def hand_summary(sequence):
    shapes = []
    for start in (21, 85):
        points = sequence[:, start + 1:start + 64].reshape(-1, 21, 3)
        relative = points - points[:, :1]
        if start == 21:
            relative[:, :, 0] *= -1
        size = np.linalg.norm(relative, axis=-1).max(axis=-1)
        usable = size > 1e-5
        shapes.extend(relative[usable] / size[usable, None, None])
    if not shapes:
        return np.zeros(252, dtype=np.float32)
    shape = np.asarray(shapes)
    return np.concatenate([shape.mean(0).ravel(), shape.std(0).ravel(),
                           np.quantile(shape, .2, axis=0).ravel(), np.quantile(shape, .8, axis=0).ravel()]).astype(np.float32)


def targets(labels):
    return np.array([int(label) - 20 if label in IDS[:10] else 10 for label in labels])


def main():
    import tensorflow as tf

    tf.config.threading.set_intra_op_parallelism_threads(5)
    tf.config.threading.set_inter_op_parallelism_threads(2)
    split, labels, vectors, hands = load_corpus()
    extra_split, extra_labels, extra_vectors, extra_hands = transactional()
    features = np.stack([hand_summary(vector) for vector in vectors])
    extra_features = np.stack([hand_summary(vector) for vector in extra_vectors])
    classes, extra_classes = targets(labels), targets(extra_labels)
    training = (split == 'train') & (hands >= 2)
    extra = (extra_split == 'train') & (extra_hands >= 2)
    validation, test = split == 'validation', split == 'test'
    candidates = []
    for mixed in (False, True):
        x, y = features[training], classes[training]
        weights = np.where(y == 10, .075, 1.)
        if mixed:
            x, y = np.r_[x, extra_features[extra]], np.r_[y, extra_classes[extra]]
            weights = np.r_[weights, np.where(extra_classes[extra] == 10, .045, .45)]
        rng = np.random.default_rng(431)
        augmented = np.tile(x, (5, 1))
        augmented += rng.normal(0, .023, augmented.shape).astype(np.float32)
        model = dense(tf, augmented, np.tile(y, 5), (features[validation], classes[validation]), 128, 431, np.tile(weights, 5))
        probability = model.predict(features, verbose=0)
        stats = measure(probability[validation], LABELS, labels[validation], hands[validation], CONFIDENCE)
        correct = sum(stats[label]['correct'] for label in LABELS[:10])
        print('Mixed training' if mixed else 'FSL-105 training', correct, 'of 30 validation digits correct', flush=True)
        candidates.append((correct, mixed, model, probability))
    _, mixed, model, probability = max(candidates, key=lambda run: run[0])

    bundle = dict(labels=LABELS.tolist(), layers=export_layers(tf, model), threshold=CONFIDENCE, frames=FRAMES, fps=4, minHands=2)
    np.testing.assert_allclose(predict_export(bundle, features[test]), probability[test], atol=2e-5)
    fsl_test = measure(probability[test], LABELS, labels[test], hands[test], CONFIDENCE)
    extra_test = extra_split == 'test'
    transaction_test = measure(model.predict(extra_features[extra_test], verbose=0), LABELS, extra_labels[extra_test], extra_hands[extra_test], CONFIDENCE)
    per_number = {label: fsl_test[label] for label in LABELS[:10]}
    if any(not row['correct'] for row in per_number.values()):
        raise ValueError('A number has no correct held-out FSL-105 prediction.')
    output = ARTIFACTS / 'fsl-numbers-v3.json'
    output.write_bytes((json.dumps(bundle, separators=(',', ':')) + '\n').encode())
    report = dict(model_sha256=digest(output), model=output.name, labels=LABELS[:10].tolist(),
                  fsl_training_clips=int(training.sum()), transactional_training_clips=int(extra.sum()) if mixed else 0,
                  fsl_test_clips=int(test.sum()), transactional_test_clips=int(extra_test.sum()),
                  fsl105=per_number, transactional={label: transaction_test[label] for label in LABELS[:10]},
                  evaluation='FSL-105 publisher test and Transactional filename block test. Signer IDs unavailable. Number practice includes all ten trained labels. Per-label cutoff is reported separately.')
    (ARTIFACTS / 'fsl-numbers-v3-benchmark.json').write_bytes((json.dumps(report, indent=2) + '\n').encode())
    print('FSL-105 number test:', sum(row['correct'] for row in per_number.values()), 'of 40 correct', flush=True)


if __name__ == '__main__':
    main()
