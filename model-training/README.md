# Train the FSL models

## Numbers and words

The vocabulary trainer uses the publisher’s FSL-105 v2 split for 30 signs. It downloads or extracts 608 source clips and keeps 121 test clips out of training, including any clips with missed hand detections. The word model uses hand and pose movement across 16 frames. The number model uses hand shapes across the same frames and uses word clips as examples of other signs. [FSL-105 v2](https://data.mendeley.com/datasets/48y2y99mb9/2) · [Per-sign results](artifacts/fsl-vocabulary-v1-benchmark.json)

Prepare the Windows Python environment below. Save `train.csv`, `test.csv`, `labels.csv`, and `clips.zip` from FSL-105 v2 to `model-training/.work/fsl105/`. Download the official Pose Landmarker Lite model as `pose_landmarker_lite.task` in the same folder. [Pose Landmarker Lite model](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task)

```powershell
$trainingPython = './model-training/.work/venv/Scripts/python.exe'
uv pip install --python $trainingPython 'imageio-ffmpeg==0.6.0'
& $trainingPython -B -u './model-training/train_vocabulary.py'
```

For a smaller download, put the version’s Mendeley file manifest in `.work/fsl105/files.json` and run `download_fsl105_subset.py` with the same Python environment in place of downloading `clips.zip`. It validates the selected ZIP entries against the original checksums. The trainer writes local models and a report under `artifacts/`, then exports the demo clips and lesson catalog under `src/renderer/`.

Camera availability requires at least 90% precision and recall and at least three examples for the sign in the publisher’s test set. These numbers and words have four or five test recordings each. The same test split was reviewed during development. It lacks signer identities and examples of resting hands. Run a separate classroom webcam evaluation to measure performance with new signers.

### Full vocabulary retraining

Save the complete FSL-105 v2 video archive in `.work/fsl105/fsl105-complete.zip` alongside the CSV files and pose model. Save the [Transactional FSL v2 ZIP](https://data.mendeley.com/datasets/jdyrr7cm4z/2) as `.work/fsl105/transactional-complete.zip` to include the second number training run.

```powershell
& './model-training/.work/venv/Scripts/python.exe' -B -u './model-training/train_vocabulary_full.py'
```

The script saves candidate weights and scores under `model-training/.work/fsl105/`. It selects the models using validation clips from FSL-105. It then scores the candidates and the desktop’s existing model on the same 426 publisher test clips. The number scores count other FSL-105 signs that the camera could incorrectly accept as numbers. The Transactional FSL clips are used only during training.

The selected candidate cleared the cutoff for **54 words and phrases** and **four numbers (1, 2, 5, and 9)**. Adding 426 number examples and 681 other signs from Transactional FSL reduced the number of passing signs from six to four on validation and from four to three on the test. The candidate training and the desktop bundle use separate model files. [Full per-sign comparison](artifacts/fsl-vocabulary-v2-benchmark.json)

### Expanded word model

With both datasets and the full vocabulary run above available, run:

```powershell
& './model-training/.work/venv/Scripts/python.exe' -B -u './model-training/train_words_expanded.py'
```

The expanded model trains on **107 words and phrases** plus 10 numbers as examples of signs outside word lessons. It keeps the dataset labels `WELCOME` and `YOURE WELCOME` separate. The trainer aligns hand and pose landmarks from the two sources, compares versions with and without depth on validation, and exports `fsl-words-v3.json` to `.work/fsl105/`.

The report scores the two test sets separately and together. FSL-105 uses its publisher split. Transactional FSL keeps matching hand sequences together and splits files by filename order. The datasets lack signer IDs and the source IDs of all augmented clips, so these are recording-level results. [FSL-105 v2](https://data.mendeley.com/datasets/48y2y99mb9/2) · [Transactional FSL v2](https://data.mendeley.com/datasets/jdyrr7cm4z/2)

The expanded model used 2,150 training recordings. It met the cutoff for 50 words and phrases on 603 test recordings, including seven of the added labels. On the same 426 FSL-105 test recordings, 42 words cleared the cutoff, down from 54 for the FSL-105-only model. [Expanded word benchmark](artifacts/fsl-words-v3-benchmark.json)

To update the desktop assets after a new run, copy the validated `.work/fsl105/fsl-words-v3-benchmark.json` to `artifacts/` and run `export_word_lessons.py` with the same Python environment. It checks the model against the report, updates the lesson catalog, and generates any missing FSL-105 videos. The app loads the expanded word weights separately from the existing number weights.

## Alphabet

The desktop build uses the v3 landmark classifier for the 24 camera letters and the MediaPipe hand detector from the v2 task. The earlier v2 classifier can be reproduced from the repository root after preparing the Windows environment below.

```powershell
& './model-training/.work/venv/Scripts/python.exe' -B -u './model-training/train_alphabet.py' --candidate
```

The script saves the trial model and report in `.work/`. It starts with numeric filenames for training, letter-prefixed filenames for validation, and `Image_` filenames for testing. J, Q, and Z have no `Image_` family, so their letter-prefixed source groups are separated between validation and test first. Expanded training moves whole groups from the remaining validation pool to training and keeps the original test photos. Unknown filename patterns and exact duplicate files are skipped. Evaluation uses one photo per recognizable source group. [Bundled v2 task](artifacts/fsl-az-v2.task) · [v2 results](artifacts/fsl-az-v2.json)

The score includes missed hand detections and uncertain answers. Signer identities are unavailable, so the test does not establish accuracy on independent signers. J and Z use still hand shapes. The archive has no labeled non-sign hands to measure false accepts.

### Per-letter camera benchmark

The app offers camera practice for 24 letters. v2 got **1,613/1,770 (91.13%)** correct on those letters, compared with **1,632/1,770 (92.20%)** for v1. Both models reached 90% recall on 18 letters. v2 improved D and Q, while M, N, R, S, U, and Y fell below 90%. MediaPipe admitted 7,892 training photos and 578 validation photos when training v2. [Per-letter benchmark chart](../docs/images/alphabet-results.png) · [Earlier v1 results](artifacts/fsl-az-v1.json)

### Raw landmarks and hand crops

```powershell
& './model-training/.work/venv/Scripts/python.exe' -B -u './model-training/train_hand_models.py'
```

This experiment compares raw hand landmarks, a cropped-hand image classifier, and their average. It uses the original 1,770 test photos for the 24 camera letters and selects a candidate by the lowest per-letter validation score. The training log, saved classifiers, and `alphabet-retrain.json` report stay in `.work/`. Use `--reuse-geometry` to retry the image model with an existing geometry classifier.

The archive has 11,700 photos, with 450 per letter. For the 24 camera letters, 7,139 photos were assigned to training and 7,056 yielded usable landmarks. Validation had 824 photos and the fixed test had 1,770. Those test photos were kept out of training.

The first landmark classifier got **1,667/1,770 (94.18%)** correct and reached 90% on 19 of 24 letters. B, M, N, U, and Y fell below 90%.

After the feature cache is built, run `train_recovered.py` with the same Python environment to recover filename variants for training. It added 283 usable training photos while preserving the original held-out test. Run `export_geometry.py` to export the resulting classifier for Electron. It got **1,679/1,770 (94.86%)** correct and reached 90% on 19 of 24 letters. M, N, R, U, and Y remained below target. [Bundled v3 results](artifacts/fsl-geometry-v3-benchmark.json)

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
