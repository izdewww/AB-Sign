"""Export the recovered landmark classifier and an optional runtime-parity fixture."""

import argparse
import hashlib
import json

import numpy as np

from train_hand_models import CAMERA_LABELS, ROOT, WORK, features

MODEL = "fsl-geometry-v3.json"
BENCHMARK = "fsl-geometry-v3-benchmark.json"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify-runtime", action="store_true")
    args = parser.parse_args()
    import tensorflow as tf

    net = tf.keras.models.load_model(WORK / "alphabet-recovered.keras", compile=False)
    layers = [
        {"weights": kernel.T.flatten().tolist(), "biases": bias.tolist()}
        for layer in net.layers if isinstance(layer, tf.keras.layers.Dense)
        for kernel, bias in [layer.get_weights()]
    ]
    corpus, baseline = features()
    test = corpus["names"] == "test"
    features_for_test = corpus["coords"][test]
    valid = corpus["valid"][test]
    letters = corpus["classes"][test]
    probabilities = tf.nn.softmax(net.predict(features_for_test, verbose=0)).numpy()
    model = {"labels": list(CAMERA_LABELS), "threshold": 0.5, "layers": layers}
    bundle = json.dumps(model, separators=(",", ":")).encode("utf-8") + b"\n"
    report = json.loads((WORK / "alphabet-recovered.json").read_text())
    if report["test_samples_sha256"] != baseline["test_samples_sha256"]:
        raise ValueError("The recovered model uses a different test split.")
    predictions = [CAMERA_LABELS[row.argmax()] if present and row.max() >= .5 else None
                   for row, present in zip(probabilities, valid)]
    for letter in CAMERA_LABELS:
        hits = sum(answer == letter and truth == letter for answer, truth in zip(predictions, letters))
        if hits != report["per_letter"][letter]["correct"]:
            raise ValueError(f"Trained weights do not reproduce the report for {letter}")
    report.update(model=MODEL, model_sha256=hashlib.sha256(bundle).hexdigest(),
                  detector=baseline["model"], detector_sha256=baseline["model_sha256"], labels=list(CAMERA_LABELS))
    artifacts = ROOT / "artifacts"
    (artifacts / MODEL).write_bytes(bundle)
    (artifacts / BENCHMARK).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    if args.verify_runtime:
        fixture = {"features": features_for_test.tolist(), "valid": valid.tolist(), "predictions": predictions,
                   "labels": letters.tolist()}
        (WORK / "geometry-runtime-parity.json").write_text(json.dumps(fixture), encoding="utf-8")
    print("Exported and verified", report["correct"], "/", report["images"], "correct.")


if __name__ == "__main__":
    main()
