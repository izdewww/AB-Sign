# Architecture and pipelines

[README](../README.md) · [Implementation plan](../IMPLEMENTATION_PLAN.md) · [Training guide](../model-training/README.md)

![Desktop architecture from renderer through local assets and planned webcam processing.](images/architecture.png)

| Location | Responsibility |
| --- | --- |
| `src/main/` | Electron lifecycle, window, local asset protocol, and permission defaults |
| `src/renderer/` | React desktop starter and styling |
| `scripts/` | Model checksum verification and local build asset preparation |
| `model-training/` | Dataset preparation, training, and benchmark reports |
| `.github/workflows/` | Windows verification and ZIP build |
| `docs/` | Architecture, results, images, and credits |

## Build and training

![Build pipeline from npm install through checks and ZIP packaging, and model pipeline from Kaggle images to packaged MediaPipe task.](images/pipelines.png)

The build verifies the selected model’s checksum and copies the model and MediaPipe WASM files into the local renderer output. `npm run smoke` checks that Electron can load the renderer and read the model file.

Training is a separate development task. Follow the [training guide](../model-training/README.md) for the dataset, Python environment, and export commands.

![Measured accuracy for the original and updated runtime on the same cropped-image benchmark.](images/results.png)

The [implementation plan](../IMPLEMENTATION_PLAN.md) tracks the 18 prototype screens, lesson content, local progress, camera behavior, and release checks. Classroom validation requires full webcam frames from independent signers.
