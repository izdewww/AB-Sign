# Architecture and pipelines

[README](../README.md) · [Implementation plan](../IMPLEMENTATION_PLAN.md) · [Training guide](../model-training/README.md)

![Desktop architecture from renderer through local assets and webcam processing.](images/architecture.png)

| Location | Responsibility |
| --- | --- |
| `src/main/` | Electron window, local asset protocol, camera permission checks, and app smoke test |
| `src/renderer/` | React pages, local progress, teacher lesson storage, and webcam worker |
| `scripts/` | Model checksum verification and local build asset preparation |
| `model-training/` | Dataset preparation, training, and benchmark reports |
| `.github/workflows/` | Windows verification and ZIP build |
| `docs/` | Architecture, results, images, and credits |

## Build and training

![Build pipeline from npm install through checks and ZIP packaging, and model pipeline from Kaggle images to packaged MediaPipe task.](images/pipelines.png)

The build verifies the model checksum and copies the model and MediaPipe WASM files. Camera practice runs in a worker and stops when the learner leaves. The app keeps camera frames in memory. Electron keeps the teacher password hash, roster, and student progress in a local classroom file. The preload exposes account actions to the app, and Electron checks the current role before teacher actions. IndexedDB holds drafts, learner versions, teacher pictures and videos, and quiz settings.

`npm run smoke` uses a fake camera, a generated WebM clip, labeled photos, and bundled sign videos to check the main flows and local model inference. Classroom camera behavior and recognition on new signers require separate validation.

Training is a separate development task. Follow the [training guide](../model-training/README.md) for the dataset, Python environment, and export commands.

The alphabet worker uses MediaPipe to locate the hand and v3 to classify landmarks for 24 letters. A separate number worker classifies 1–10 by summarizing hand shapes across 16 frames. The lesson catalog uses matching for greetings and people. Camera questions offer a matching fallback. [Alphabet evaluation](../model-training/artifacts/fsl-geometry-v3-benchmark.json) · [Number evaluation](../model-training/artifacts/fsl-numbers-v3-benchmark.json)

The implementation plan tracks the desktop screens, lesson content, camera behavior, and verification. Classroom validation requires full webcam frames from independent signers. [Implementation plan](../IMPLEMENTATION_PLAN.md)
