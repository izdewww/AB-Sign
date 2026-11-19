# A-B Sign! desktop implementation plan

A-B Sign! helps children practice Filipino Sign Language with an instructor or student-teacher. The Windows desktop app uses Electron, React, TypeScript, and MediaPipe. Lessons, media, settings, and progress stay on the device.

## Lessons and quizzes

- Open the library on first launch. Learners can choose any available lesson and finish it at their own pace.
- Include one Porton dataset photo for each letter A–Z. Group three letters per editable lesson, with Y and Z together in the last lesson. Give each sign an empty video slot.
- Include editable FSL-105 video lessons for numbers 1–10 and 95 vocabulary signs, grouped by topic. Keep Numbers 11–20 and the Everyday Errands lessons as teacher drafts with blank media.
- Start new teacher lessons with an empty title and no steps or quiz. Teachers choose signs, reorder steps, and upload their own pictures and videos. The picture is available when there is no playable video.
- Store drafts and learner versions separately. Keep existing teacher lessons when updating the library. Allow teachers to hide and restore the bundled alphabet lessons.
- A teacher can add one optional quiz per lesson. The teacher picks the sign and format for each prompt and the number of questions in a round. Draw without repeating a sign-and-format pair. Shuffle the round and the answer choices independently, using only lesson signs as choices. Include both formats when the teacher chooses both and the round has room.
- Show a score and the signs to practice after the quiz. Finishing the lesson is independent of the quiz.

## Desktop screens

| Screen | Main action |
| --- | --- |
| Welcome | See lessons or create a lesson |
| Home | Open the lesson library or resume a lesson |
| Learning path | Pick any published lesson |
| Lesson | View steps, watch teacher videos, or open the optional quiz |
| Quiz | Match a picture or try a sign on camera |
| Result | See answers to practice and start another round |
| Play | Find available lesson quizzes or choose a letter for camera practice |
| Progress | Review finished lessons and recent practice |
| For teachers | Manage the lesson library and show or hide alphabet examples |
| Lesson editor | Add steps and media, set up a quiz, preview, and make the lesson available |

## Camera and model

The app bundles the A–Z MediaPipe model and runs recognition locally in a worker. Teachers can add picture prompts for all 26 letters and camera prompts for 24. Camera practice offers picture matching as an alternative. The camera begins after a button press and stops when the learner leaves the camera view.

J and Z remain available in lessons and picture quizzes. Teachers can add their own videos to show the movement. Saved J or Z camera quiz prompts open as picture matches. Test full webcam frames from independent signers and non-sign hand poses to establish classroom accuracy.

Number and word camera practice uses four seconds of hand and pose landmarks. Offer it only for approved signs in the lesson catalog. Keep matching with a video or picture available for every published number and word lesson.

[Model research](MODEL_RESEARCH.md) · [Training and evaluation](model-training/README.md) · [Desktop architecture](docs/ARCHITECTURE.md)

## Verification

- Check all 26 photos load, learners can enter any lesson, and teachers can hide the bundled lessons independently of their own.
- Exercise creating a blank lesson, replacing a sample photo, adding a playable video, reloading the draft, and saving it for learners.
- Verify quiz questions and options vary, options come from lesson letters, and scores survive a reload.
- Check keyboard controls, reduced motion, the compact desktop layout, and that the Windows package runs locally.
- Verify packaged recognition with a known synthetic camera input. Evaluate classroom accuracy separately with independent signers.
