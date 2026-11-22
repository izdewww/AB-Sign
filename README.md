<p align="center">
  <img src="docs/images/logo.jpg" width="160" alt="Illustrated hands inside a pastel rainbow">
</p>

# A-B Sign!

A Windows desktop app for teaching children Filipino Sign Language (FSL) through video demonstrations, sign-matching quizzes, and webcam practice. Accounts, lessons, and progress stay on the device.

![Windows x64](https://img.shields.io/badge/target-Windows%20x64-2563eb)
![Electron](https://img.shields.io/badge/Electron-desktop-47848f)
![React](https://img.shields.io/badge/React-UI-087ea4)
![TypeScript](https://img.shields.io/badge/TypeScript-typed-3178c6)
![MediaPipe](https://img.shields.io/badge/MediaPipe-vision-00897b)

[Quick start](#quick-start) · [Architecture](docs/ARCHITECTURE.md) · [Model results](#model-results) · [Implementation plan](IMPLEMENTATION_PLAN.md) · [Issues](https://github.com/izdewww/AB-Sign/issues)

## Project status

**Learn** includes nine editable alphabet lessons with one dataset photo per letter. Lessons group three letters at a time, with Y and Z in the last lesson. Learners can open any lesson and take its optional quiz.

Learners watch the demonstrations, then practice each sign in a shuffled round. The lesson library follows the client’s four categories.

| Category | Ready to learn | Teacher drafts | Webcam practice |
| --- | --- | --- | --- |
| Alphabet | A–Z photos | Optional videos for A–Z | 24 letters |
| Numbers | Videos for 1–10 | 11–100 | 1–10 |
| Greetings & Expression | 10 videos | 20 signs | — |
| Names of People | 7 videos | 23 signs | — |

Teachers can add a picture or video to a draft, then publish it for learners. Older lessons outside these categories are available under **Previous lessons** in the teacher library. [Lesson catalog](src/renderer/vocabulary.json)

![The learning path shows nine pastel lesson cards covering A through Z.](docs/images/lesson-library.png)

## Local accounts

- **Students** add a name or choose it from the list. Each student keeps their own lesson progress, quiz results, and badges.
- **Teachers** select **Teacher sign-in**. The built-in account starts with the password `TeacherStart24!`. Replace it at first sign-in. To change it again, open **Account** and enter the current and new passwords.
- Open **Students** to view progress, edit a name, or remove an account and its progress. The app asks before removing an account.
- Progress from older versions was shared and stays separate from the new student accounts.

## Camera challenge

Open **Challenge** as a student to try 20 random signs. Choose **Letters only** or **Letters + numbers**. The mixed round draws 16 letters and four numbers from 1, 2, 5, 8, 9, and 10. Each round has its own classroom leaderboard. The app saves each student’s latest and best scores on this device.

## For teachers

1. Open **Lessons** and create a blank lesson or edit a bundled lesson. Use **Hide alphabet lessons** to hide the letter lessons.
2. Add signs, replace pictures, and upload optional MP4 or WebM videos. The alphabet lessons start with empty video slots. Add a fingerspelling step to reveal a word one sign at a time.
3. Add a quiz if you want one. Choose the signs, question types, and number of questions. Each round shuffles the questions and answer choices using signs from that lesson.
4. Preview your work and select **Use on this device** when it is ready for learners.

Picture matching covers A–Z. Webcam practice covers 24 letters. J and Z are available in lessons and picture quizzes, and teachers can upload videos to show the movement.

Bundled lessons show the demonstrations first, then shuffle one question per sign. Alphabet and number rounds can include camera questions with **Use matching** as a fallback. Learners can also select **Try on camera** from a supported sign’s demonstration. Greetings and people lessons use matching throughout.

![The Numbers category shows two starter lessons covering 1–10.](docs/images/number-lessons.png)

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
| `npm run smoke` | Checks account permissions and persistence, student progress, lessons, quizzes, and synthetic camera recognition in Electron |
| `npm run make` | Builds a Windows x64 ZIP under `out/make/` |

The [Windows workflow](.github/workflows/desktop.yml) runs these checks and attaches the ZIP to successful runs. [GitHub Actions](https://github.com/izdewww/AB-Sign/actions/workflows/desktop.yml)

## Architecture

![Electron serves the React window and local assets. The webcam worker processes frames on the device.](docs/images/architecture.png)

[Desktop components and build pipeline](docs/ARCHITECTURE.md) · [Screen and feature inventory](IMPLEMENTATION_PLAN.md#desktop-screens)

## Model results

The bundled **v3 model** got **1,679 of 1,770 held-out photos correct (94.86%)** across the 24 camera letters, up from 91.13% for v2 on the same photos. V3 reached 90% on 19 letters. M, N, R, U, and Y remain below 90%. Classroom webcam accuracy on independent signers remains unverified. [Training guide](model-training/README.md) · [v3 evaluation](model-training/artifacts/fsl-geometry-v3-benchmark.json) · [v2 evaluation](model-training/artifacts/fsl-az-v2.json)

![Held-out photo accuracy for each of the 24 letters available in camera practice.](docs/images/alphabet-results.png)

The **number model** recognized all ten numbers in held-out FSL-105 recordings, scoring **35 of 40 (87.5%)**. Numbers 1, 2, 5, 8, 9, and 10 each reached 90% precision and recall. On the held-out Transactional FSL number clips it scored 68 of 68. These are recording-level results. The datasets lack signer IDs for an independent classroom accuracy check. [Number benchmark](model-training/artifacts/fsl-numbers-v3-benchmark.json) · [Training guide](model-training/README.md)

## Credits

The alphabet uses John Gabriel Porton’s FSL alphabet dataset. The lesson videos use Isaiah Jassen Tupal’s FSL-105 dataset. The number model uses FSL-105 and Transactional FSL landmarks by Franz Columna and Angela Cardano. [Alphabet dataset](https://www.kaggle.com/datasets/japorton/fsl-dataset) · [FSL-105](https://data.mendeley.com/datasets/48y2y99mb9/2) · [Transactional FSL](https://data.mendeley.com/datasets/jdyrr7cm4z/2) · [Third-party credits](docs/THIRD_PARTY.md)
