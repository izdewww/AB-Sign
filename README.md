<p align="center">
  <img src="docs/images/logo.jpg" width="160" alt="Illustrated hands inside a pastel rainbow">
</p>

# A-B Sign!

A desktop app in development for teaching children Filipino Sign Language (FSL) through video demonstrations, sign-matching quizzes, and webcam practice. It is designed for instructors and student-teachers to use offline, without accounts.

![Windows x64](https://img.shields.io/badge/target-Windows%20x64-2563eb)
![Electron](https://img.shields.io/badge/Electron-desktop-47848f)
![React](https://img.shields.io/badge/React-UI-087ea4)
![TypeScript](https://img.shields.io/badge/TypeScript-typed-3178c6)
![MediaPipe](https://img.shields.io/badge/MediaPipe-vision-00897b)

[Quick start](#quick-start) · [Architecture](docs/ARCHITECTURE.md) · [Model results](#model-results) · [Implementation plan](IMPLEMENTATION_PLAN.md) · [Issues](https://github.com/izdewww/AB-Sign/issues)

## Project status

**Learn** includes nine editable alphabet lessons with one dataset photo per letter. Lessons group three letters at a time, with Y and Z in the last lesson. Learners can open any lesson and take its optional quiz.

![The learning path shows nine pastel lesson cards covering A through Z.](docs/images/lesson-library.png)

## For teachers

1. Open **For teachers** and create a blank lesson or edit an alphabet lesson. Use **Hide alphabet lessons** for an empty learner library.
2. Add signs, replace pictures, and upload optional MP4 or WebM videos. The alphabet lessons start with empty video slots.
3. Add a quiz if you want one. Choose the signs, question types, and number of questions. Each round shuffles the questions and answer choices using letters from that lesson.
4. Preview your work and select **Use on this device** when it is ready for learners.

Picture matching covers A–Z. Webcam practice covers 24 letters. J and Z are available in lessons and picture quizzes, and teachers can upload videos to show the movement.

## Quick start

Use Windows x64 with Node.js 24 and npm. Run these commands from the repository root.

```powershell
npm ci
npm start
```

| Command | What it does |
| --- | --- |
| `npm run check` | Type-checks the desktop and React code |
| `node --test scripts/test-quiz.mjs` | Checks question and answer randomization |
| `npm run build` | Compiles the app and copies local model and WASM assets |
| `npm run smoke` | Checks the alphabet library, teacher uploads, mixed quizzes, and synthetic camera recognition in Electron |
| `npm run make` | Builds a Windows x64 ZIP under `out/make/` |

The [Windows workflow](.github/workflows/desktop.yml) runs these checks and attaches the ZIP to successful runs. [GitHub Actions](https://github.com/izdewww/AB-Sign/actions/workflows/desktop.yml)

## Architecture

![Electron serves the React window and local assets. The webcam worker processes frames on the device.](docs/images/architecture.png)

[Desktop components and build pipeline](docs/ARCHITECTURE.md) · [Screen and feature inventory](IMPLEMENTATION_PLAN.md#desktop-screens)

## Model results

The bundled model got **1,723 of 1,933 held-out photos correct (89.14%)** across all 26 trained labels. The app offers webcam practice for 24 of them. J and Z require motion and are excluded from camera practice. Classroom webcam accuracy on independent signers remains unverified. [Training guide](model-training/README.md) · [Alphabet evaluation](model-training/artifacts/fsl-az-v1.json) · [Earlier A/B/C benchmark](docs/images/results.png)

![Held-out photo accuracy by letter for the A–Z model.](docs/images/alphabet-results.png)

## Credits

The model was trained on John Gabriel Porton’s FSL alphabet dataset, listed as CC0. [Kaggle dataset](https://www.kaggle.com/datasets/japorton/fsl-dataset) · [Third-party credits](docs/THIRD_PARTY.md)
