# Train the FSL alphabet model

The desktop build uses the A–Z MediaPipe task trained on John Gabriel Porton’s Kaggle photos. From the repository root, run this command after preparing the Windows environment below.

```powershell
& './model-training/.work/venv/Scripts/python.exe' -B -u './model-training/train_alphabet.py'
```

The script exports [the alphabet task](artifacts/fsl-az-v1.task) and [results for each letter](artifacts/fsl-az-v1.json). It uses numeric filenames for training, letter-prefixed filenames for validation, and `Image_` filenames for testing. J, Q, and Z have no `Image_` family, so their letter-prefixed source groups are separated between validation and test. Unknown filename patterns are excluded. Exact duplicate files are skipped, and evaluation uses one photo per recognizable source group.

The score includes missed hand detections and uncertain answers. Signer identities are unavailable, so the test does not establish accuracy on independent signers. J and Z use still hand shapes. The archive has no labeled non-sign hands to measure false accepts.

The exported task classified **1,723 of 1,933 held-out photos correctly (89.14%)**. MediaPipe admitted 4,921 training photos and 2,887 validation photos after hand detection. [Per-letter benchmark chart](../docs/images/alphabet-results.png)

## Earlier A/B/C pilot

This workflow trains a MediaPipe Gesture Recognizer task using version 1 of John Gabriel Porton's FSL alphabet dataset. Kaggle lists the archive under CC0. A, B, and C are the target labels. The `none` examples come from other static letter classes. The model learns from cropped still images. [Kaggle dataset](https://www.kaggle.com/datasets/japorton/fsl-dataset) · [Kaggle metadata](https://www.kaggle.com/api/v1/datasets/view/japorton/fsl-dataset) · [Google training notebook](https://github.com/google-ai-edge/mediapipe-samples/blob/main/examples/customization/gesture_recognizer.ipynb)

## Rerun on the prepared machine

Run this command from the workspace root in PowerShell.

```powershell
& './model-training/.work/venv/Scripts/python.exe' -B -u './model-training/train_abc.py'
```

The script verifies the source archive checksum, prepares the image folders, fits the classifier, exports `artifacts/fsl-abc-v1.task`, and evaluates that exported bundle with MediaPipe. It writes the confusion matrix, no-hand outcomes, dataset details, and model checksum to `artifacts/fsl-abc-v1.json`.

Keep the saved v1 artifact available for comparison and run this command to reproduce the accuracy iteration.

```powershell
& './model-training/.work/venv/Scripts/python.exe' -B -u './model-training/train_abc.py' --version v2
```

The v2 run trains on padded images and writes its own task and report. It compares both sets of weights at the same runtime settings. The v2 runtime adds a border equal to 20% of the image width on each horizontal side and 20% of the image height on each vertical side. For the border color, take the median per channel of the pixels in the four 8×8 corner patches. Set MediaPipe's `minHandDetectionConfidence` and `minHandPresenceConfidence` to `0.25`. The runtime profile is recorded in the JSON report. Electron should reproduce these inputs when comparing results with this benchmark.

### Accuracy comparison

| Weights | Runtime | Correct on the same 289 images |
| --- | --- | --- |
| v1 | Defaults | 217 (75.1%) |
| v1 | Border and 0.25 thresholds | 287 (99.3%) |
| v2 | Defaults | 216 (74.7%) |
| v2 | Border and 0.25 thresholds | 287 (99.3%) |

Use [the original task](artifacts/fsl-abc-v1.task) with the updated runtime profile for the next prototype experiment. It matched the retrained model on the test split and correctly classified one more validation image (535/545 versus 534/545). The [retrained task](artifacts/fsl-abc-v2.task) and [comparison report](artifacts/fsl-abc-v2.json) remain available. This benchmark reuses the original cropped-image test split. Full-frame webcam performance on independent signers remains unverified.

## Prepare another Windows machine

Run the following from the workspace root with `uv`, `curl.exe`, and `tar.exe` available. The Python runtime, package cache, dataset, and Google's original model files go under the ignored `.work` directory.

```powershell
$trainingWork = (New-Item -ItemType Directory -Force 'model-training/.work').FullName
$env:UV_CACHE_DIR = Join-Path $trainingWork 'uv-cache'
$env:UV_PYTHON_INSTALL_DIR = Join-Path $trainingWork 'python'
uv python install 3.10.20 --no-bin
uv venv (Join-Path $trainingWork 'venv') --python 3.10.20 --managed-python
$trainingPython = Join-Path $trainingWork 'venv/Scripts/python.exe'

uv pip install --python $trainingPython 'mediapipe==0.10.21' 'tensorflow==2.15.1' `
  'tensorflow-model-optimization==0.7.5' 'numpy==1.26.4' 'opencv-contrib-python==4.11.0.86' `
  'protobuf==4.25.8' 'jax==0.4.30' 'jaxlib==0.4.30'
uv pip install --python $trainingPython --no-deps 'mediapipe-model-maker==0.2.1.4' `
  'tf-models-official==2.15.0' 'pyyaml==6.0.3'

curl.exe --fail --location --output (Join-Path $trainingWork 'fsl-dataset-v1.zip') `
  'https://www.kaggle.com/api/v1/datasets/download/japorton/fsl-dataset?datasetVersionNumber=1'
$assetDir = (New-Item -ItemType Directory -Force (Join-Path $trainingWork 'tmp/model_maker/gesture_recognizer')).FullName
foreach ($asset in @('gesture_embedder.tflite', 'palm_detection_full.tflite', `
  'hand_landmark_full.tflite', 'canned_gesture_classifier.tflite', 'gesture_embedder.tar.gz')) {
  curl.exe --fail --location --output (Join-Path $assetDir $asset) "https://storage.googleapis.com/mediapipe-assets/$asset"
  if ($LASTEXITCODE -ne 0) { throw "Failed to download $asset" }
}
tar.exe -xf (Join-Path $assetDir 'gesture_embedder.tar.gz') -C $assetDir
& $trainingPython -B -u './model-training/train_abc.py'
```

The gesture script imports Model Maker's vision package directly on Windows. The published package's default initializer eagerly imports unrelated trainers whose TensorFlow dependencies lack compatible Windows wheels. The FSL workflow uses the official gesture trainer and exporter.

## Interpret the evaluation

Numeric-name images train the model, letter-prefixed images validate it, and `Image_`-prefixed images test the exported task. Recognizable variants stay in the same partition, validation and test keep one file per normalized source ID, and exact-byte duplicates are skipped. Filename families are a proxy for capture sources. Signer identities are unavailable, so the reported results measure this dataset split. The build plan calls for a separate webcam test on unseen signers, with resting hands, transitions, unfamiliar gestures, and classroom framing before enabling scoring in lessons.

The saved bundle achieved **217/289 correct (75.1%)** with no-hand outcomes counted as misses. Per-letter recall was 62.1% for A, 100% for B, and 60.5% for C. The hand detector returned no hand on 21 of 58 A images and 32 of 81 C images. The task accepted zero of 72 off-target letters as A/B/C. See the [machine-readable report](artifacts/fsl-abc-v1.json) and the [exported model](artifacts/fsl-abc-v1.task).
