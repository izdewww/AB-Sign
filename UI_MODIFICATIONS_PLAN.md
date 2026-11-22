# A-B Sign! – UI Modifications & Fullscreen Responsive Implementation Plan

**Scope:** Front-end UI modifications, fluid fullscreen/multi-resolution scaling architecture, and redesigned Lesson & Camera Practice stages.  
**Constraint:** Purely client-side presentation layer (`src/renderer/`). **Zero modifications** to the existing backend (`src/main/`).

---

## 1. Executive Summary & Problem Diagnosis

### Problem Statement
In the initial implementation, main content containers used fixed maximum width clamps (e.g., `width: min(100%, 1260px)` and `.shell-top .content { width: min(100%, 1170px) }`). When the desktop window is maximized on standard Full HD monitors (1920×1080) or ultra-wide displays, the UI does not expand to use the available screen estate, resulting in large empty margins on both sides and constrained element sizing.

### Objectives
1. **Fluid Fullscreen Scaling Engine:** Redesign container and grid sizing so that all screens (Dashboard, Activities, Progress, Camera Calibration, and Lessons) scale smoothly to fill full-screen desktop viewports while preserving proportion, visual hierarchy, and readability down to tablet and mobile screens.
2. **Redesigned Lesson Stage (Look at A):** High-polish 7/5 split layout featuring a sticky top progress bar, warm amber Voice Tip button, 4:3 dark-framed demonstration card, plain-language 3-step signing guide, and tactile 3D action buttons.
3. **Redesigned Camera Practice Stage (Look at B):** High-polish 5/7 split layout featuring a live recognition header, collapsible hint drawer, embedded viewport controls, and a dedicated bottom step navigation bar.

---

## 2. Architecture & File Inventory

All modifications stay strictly within `src/renderer/`:

```
src/renderer/
├── lesson-stage.tsx                # Redesigned Lesson Demonstration & Camera Practice Stage
├── course.tsx                      # Integration into LessonView and LessonStep
├── icons.tsx                       # Added volume_up, replay, and speech icons
├── style.css                       # Fullscreen fluid grid, 7/5 & 5/7 split stages, tactile 3D buttons
├── UI_UX_IMPLEMENTATION_PLAN.md    # Master UI/UX architecture document
└── UI_MODIFICATIONS_PLAN.md        # This dedicated modifications and scaling specification
```

---

## 3. Fluid Fullscreen & Multi-Resolution Responsive Engine

To eliminate awkward whitespace when maximized and ensure fluid scaling across all resolutions, we implement a flexible CSS grid and fluid container layout:

### 3.1. Fluid Container & Viewport Rules

```css
/* Fluid Main Content Container */
.shell-with-sidebar {
  display: grid;
  grid-template-columns: 256px minmax(0, 1fr);
  min-height: 100vh;
  width: 100vw;
  background: var(--bg-app);
}

.shell-with-sidebar .content {
  width: 100%;
  max-width: min(100%, 1680px); /* Expands naturally on 1080p and 1440p */
  margin: 0 auto;
  padding: clamp(20px, 2.5vw, 42px) clamp(24px, 3vw, 48px);
  box-sizing: border-box;
}

/* Fluid Multi-Column Layouts */
.dashboard-columns-grid,
.progress-content-grid,
.camera-setup-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: clamp(18px, 2vw, 32px);
  width: 100%;
}

.lesson-stage-7-5-grid {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
  gap: clamp(20px, 2.4vw, 36px);
  width: 100%;
  align-items: start;
}

.camera-stage-5-7-grid {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  gap: clamp(20px, 2.4vw, 36px);
  width: 100%;
  align-items: start;
}
```

### 3.2. Resolution Breakpoints Matrix

| Breakpoint Tier | Viewport Width | Sidebar Behavior | Layout Behavior | Media Aspect |
| :--- | :--- | :--- | :--- | :--- |
| **Ultra-Wide / 4K** | `> 1920px` | Fixed 256px Rail | 2-Column Expansive (max 1680px) | Full 4:3 / 16:10 |
| **Full HD Desktop** | `1920 × 1080` | Fixed 256px Rail | 2-Column Fluid Fill | Full 4:3 / 16:10 |
| **Standard Desktop** | `1280 × 900` | Fixed 256px Rail | 2-Column Standard | Responsive Fit |
| **Tablet Landscape** | `1024 × 768` | Fixed 256px Rail | 2-Column Compact | Responsive Fit |
| **Tablet Portrait** | `< 960px` | Horizontal Top Rail | 1-Column Vertical Stack | 100% Width |
| **Mobile / Compact** | `< 640px` | Compact Top Strip | 1-Column Single Stack | Mobile Aspect |

---

## 4. Screen Specification: Lesson Stage (Look at A)

A structured lesson demonstration view that presents the sign before camera practice.

```
+-------------------------------------------------------------------------------+
|  TOP PROGRESS HEADER (Sticky)                                                 |
|  [ < Back ]        Letters A, B, C   [ 1 of 3 ]            [ 🔊 Voice Tip ]   |
|                    [======== Progress Bar 33% ========]                       |
+---------------------------------------------+---------------------------------+
|  LEFT COLUMN (7/12)                         |  RIGHT COLUMN (5/12)            |
|  Sign Demonstration Card                    |  Target Letter, Steps & Actions |
|                                             |                                 |
|  [🤟] Sign Demonstration  [Clear Front View]|  [ Step 1 of 3 ]        +-----+ |
|  +---------------------------------------+  |  Look at A              |  A  | |
|  |                                       |  |  Watch the hand shape   +-----+ |
|  |         [ 4:3 Dark Media Box ]        |  |  carefully before               |
|  |       (Sign Demonstration Image)      |  |  trying it on camera.           |
|  |                                       |  |                                 |
|  | [ Letter A Handshape Pill ]           |  |  +---------------------------+  |
|  +---------------------------------------+  |  | 💡 How to Sign A          |  |
|  Hold your hand steady at chest level.      |  |  1. Make a gentle fist.   |  |
|  [ 🔄 Replay Demo ]                         |  |  2. Keep 4 fingers down.  |  |
|                                             |  |  3. Rest thumb along side.|  |
|                                             |  +---------------------------+  |
|                                             |                                 |
|                                             |  [ 📹 Try on Camera (3D)  ]     |
|                                             |  [ ➡️ Next Step (3D)      ]     |
+---------------------------------------------+---------------------------------+
|  A-B-Sign! Teaching Mode • Up next: Letter B Demonstration                     |
+-------------------------------------------------------------------------------+
```

### 4.1. Top Progress Header (Sticky)
- **Placement:** Sticky at the top of the viewport (`position: sticky; top: 0; z-index: 40; background: #ffffff; border-bottom: 2px solid #e2e8f0;`).
- **Left Element:** Rounded tactile back button (`<Icon name="back" />`) with 3D bottom bevel, linking back to Lesson Overview (`#lesson/[id]`).
- **Center Element:**
  - Lesson Title: `"Letters A, B, C"` (Fredoka Variable, 1.25rem).
  - Step Counter Pill: `"1 of 3"`.
  - Full-Width Progress Track: Smooth fill bar set to **33%** (`background: #16a34a; height: 10px; border-radius: 9999px;`).
- **Right Element:**
  - Rounded **Voice Tip** button (`<Icon name="sound" />` / volume icon) in warm amber (`background: #fef3c7; color: #b45309; border: 1.5px solid #fde68a; box-shadow: 0 3px 0 #d97706;`).
  - Triggers audio narration of the handshape instruction using Web Speech synthesis (`window.speechSynthesis.speak(...)`).

### 4.2. Main 2-Column Stage (7 / 5 Desktop Split)

#### Left Column (7/12) — Sign Demonstration Card
- **Header:** Sign language icon (`hand`), label **`Sign Demonstration`**, and badge **`Clear Front View`**.
- **Media Frame:**
  - 4:3 dark-framed container (`aspect-ratio: 4 / 3; background: #0f172a; border-radius: 20px; overflow: hidden;`).
  - High-resolution demonstration photo or video.
  - Floating badge (bottom-left): **`Letter A Handshape`**.
- **Guidance Strip:**
  - Instructions: *"Hold your hand steady at chest level."*
  - Interactive **Replay** button (`<Icon name="retry" /> Replay`) to re-trigger video or preview animation.

#### Right Column (5/12) — Target Letter, Steps & Actions
- **Target Card:**
  - Badge: `Step 1 of 3`.
  - Heading: **`Look at A`** (Fredoka Variable, bold 2rem).
  - Subtitle: *"Watch the hand shape carefully before trying it on camera."*
  - Letter Tile: Large prominent letter block on the right (`width: 64px; height: 64px; background: #ecfdf5; color: #15803d; font-size: 2.2rem; font-weight: 700; border-radius: 16px; border: 2px solid #a7f3d0;`).
- **How to Sign Box:**
  - Soft green container (`background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 18px; padding: 18px;`).
  - Header: Lightbulb icon (`💡`) + **`How to Sign A`**.
  - 3 Numbered Plain-Language Steps:
    1. *Make a relaxed fist with your dominant hand.*
    2. *Keep your four fingers curled in tight.*
    3. *Rest your thumb straight up against the side of your index finger.*
- **Action Stack:**
  - Two full-width tactile 3D push-buttons (`border-radius: 16px; min-height: 52px; font-size: 1.1rem;`):
    - **Secondary Button:** **`Try on camera`** (`<Icon name="camera" />`) -> toggles camera practice.
    - **Primary Button:** **`Next step`** (`<Icon name="arrow" />`) -> advances to the next sign.

### 4.3. Footer Notice Bar
- Subtle bottom strip: *"A-B-Sign! Teaching Mode • Up next: Letter B Demonstration"*.

---

## 5. Screen Specification: Camera Practice Stage (Look at B)

An interactive camera training stage with real-time hand-positioning feedback, 16px-rounded tactile controls, and collapsible hints.

```
+-------------------------------------------------------------------------------+
|  TOP PROGRESS HEADER (Sticky, Full Width)                                     |
|  [ < Back to Demo ]     Letters A, B, C   [ 2 of 3 ]     [ ● Camera Active ]  |
|                         [=============== Progress Bar 66% ===============]    |
+-------------------------------------------------------------------------------+
|  PAGE TITLE ROW                                                               |
|  Look at B  [ Camera Practice Badge ]            [ 🔄 Back to demonstration ] |
+---------------------------------------------+---------------------------------+
|  LEFT COLUMN (5 Columns)                    |  RIGHT COLUMN (7 Columns)       |
|  Information, Hint & Camera Controls        |  Live Camera Stage              |
|                                             |                                 |
|  Target Sign Info Card:                     |  Stage Header:                  |
|  [Target Sign Eyebrow]                      |  [📹] Your Camera Preview [Live]|
|  Sign B                             +-----+ |  +----------------------------+ |
|  Bring your whole hand into view.   |  B  | |  |                            | |
|                                     +-----+ |  |    +------------------+    | |
|  Collapsible Hint Section:                  |  |    |     ( ✋ )       |    | |
|  Need a hint?          [ Show / Hide hint ] |  |    | Align Hand Here  |    | |
|  (✋) Hold 4 fingers straight up together   |  |    +------------------+    | |
|  and tuck your thumb across your palm.      |  |                            | |
|                                             |  | [Bring your whole hand...] | |
|  Camera Controls & Privacy:                 |  +----------------------------+ |
|  [ ⏹ Stop camera ]  [ 🪞 Mirror view ]       |  💡 Good lighting helps     FSL B|
|  🔒 Your camera stays on this device.       |  detection                      |
+---------------------------------------------+---------------------------------+
|  BOTTOM STEP NAVIGATION BAR (Full Width)                                      |
|  [ < Previous step ]                                       [ Next step > ]    |
+-------------------------------------------------------------------------------+
```

### 5.1. Top Header & Title Row (Full Width)
- **Sticky Progress Header:**
  - **Left:** 16px-rounded back button (`arrow_back` icon) returning to the demonstration step.
  - **Center:** Lesson title (*Letters A, B, C*), step counter pill (*2 of 3*), and a progress bar filled to **66%**.
  - **Right:** Live Camera Active / Camera Off status pill with an indicator dot (*"● Live Camera Active"* or *"● Camera Off"*).
- **Page Title Row:**
  - **Left:** *Look at B* headline paired with a *Camera Practice* pill badge.
  - **Right:** 16px-rounded *Back to demonstration* button with replay icon (`<Icon name="retry" />`).

### 5.2. Two-Column Main Workspace (12-Column Desktop Grid)

#### Left Column (5 Columns) — Information, Hint & Camera Controls
All learner guidance, target sign info, and camera controls live in this left card:
1. **Target Sign Info Card:**
   - **Eyebrow:** `Target Sign`.
   - **Heading:** `Sign B`.
   - **Dynamic Status Line:**
     - Active: *"Bring your whole hand into view."*
     - Off: *"Start the camera when you're ready."*
   - **Letter Tile:** Large prominent B letter tile on the right side of the card for instant visual reference.
2. **Collapsible Hint Section:**
   - Header: *Need a hint?* with a 16px-rounded *Show hint / Hide hint* toggle button.
   - Expanding reveals a hand icon (`hand`) and plain-language cue: *"Hold 4 fingers straight up together and tuck your thumb across your palm."*
3. **Camera Control Buttons & Privacy Note:**
   - Two side-by-side 16px-rounded tactile buttons:
     - *Stop camera / Start camera* (`videocam_off` / `videocam` icon).
     - *Mirror view / Mirrored* (`flip` icon).
   - Centered privacy line underneath with a lock icon: *"Your camera stays on this device."*

#### Right Column (7 Columns) — Live Camera Stage
The right card is dedicated entirely to the camera feed and real-time hand-alignment feedback:
1. **Stage Header:**
   - **Left:** videocam icon and *Your Camera Preview* label.
   - **Right:** Live status pill (*Recognizing...* with a pulsing green dot when active, or *Camera Off* when stopped).
2. **Camera Viewport (16:10 Dark Frame):**
   - **Camera Active State:** Centered dashed green *Align Hand Here* target box with a hand icon, plus a bottom guidance pill (*"Bring your whole hand into view"*).
   - **Camera Off State:** Centered `videocam_off` emblem, Camera off message (*"Start the camera when you're ready."*), and a 16px-rounded primary *Start camera* button directly inside the viewport.
3. **Stage Footer Strip:**
   - **Left:** Lighting tip (*"💡 Good lighting helps detection"*).
   - **Right:** *FSL Letter B* label.

### 5.3. Bottom Step Navigation Bar (Full Width)
- **Left:** 16px-rounded secondary *Previous step* button (`arrow_back` icon).
- **Right:** 16px-rounded primary *Next step* button (`arrow_forward` icon) advancing to the sign detection success state.

---

## 6. Screen Specification: Camera Quiz

A balanced two-column stage for interactive camera-based question rounds in quizzes.

```
+-------------------------------------------------------------------------------+
|  QUIZ HEADER (Full Width)                                                     |
|  [ < Back ]     Lesson Quiz                [ 1 of 5 ]                         |
+---------------------------------------------+---------------------------------+
|  LEFT COLUMN (5 Columns)                    |  RIGHT COLUMN (7 Columns)       |
|  Sign Prompt, Hint & Alternate Input        |  Interactive Camera Viewport    |
|                                             |                                 |
|  +---------------------------------------+  |  Stage Header:                  |
|  | Target Sign Eyebrow                   |  |  [📹] Your Camera Preview [Live]|
|  | Sign A                        +-----+ |  +-------------------------------+ |
|  | Bring your whole hand into    |  A  | |  |                               | |
|  | view.                         +-----+ |  |      +-----------------+      | |
|  +---------------------------------------+  |  |      |   ( ✋ )        |      | |
|                                             |  |      | Align Hand Here |      | |
|  Need a hint?          [ Show / Hide hint ] |  |      +-----------------+      | |
|  (✋) Make a relaxed fist with your thumb    |  |                               | |
|  resting along your index finger.           |  | [ Guidance: Keep hand steady] | |
|                                             |  +-------------------------------+ |
|  [ 📹 Start camera ]  [ 🖼️ Use pictures ]    |  💡 Good lighting helps     FSL A|
|  🔒 Your camera stays on this device.       |  detection                      |
+---------------------------------------------+---------------------------------+
|  BOTTOM BAR: [ Skip question ]                                                |
+-------------------------------------------------------------------------------+
```

- **Left Column:**
  - *Sign A* prompt card with large A letter tile.
  - Collapsible *Show hint* drawer with hand icon and handshape cues.
  - Side-by-side 16px-rounded tactile buttons: *Start camera* / *Stop camera* and *Use pictures*.
  - Centered privacy line: *"Your camera stays on this device."*
- **Right Column:**
  - Interactive *Camera Off / Recognizing...* 16:10 stage with an inline *Start camera* button when off.
- **Full-Width Bottom Bar:**
  - Docked footer with 16px-rounded *Skip question* button.

---

## 7. Screen Specification: Matching Quiz

A high-contrast 2-column layout replacing oversized wrappers with tactile 3D interactive cards.

```
+-------------------------------------------------------------------------------+
|  QUIZ HEADER                                                                  |
|  [ < Back ]     Letters A, B, C Quiz       [ 2 of 5 ]                         |
+---------------------------------------------+---------------------------------+
|  LEFT COLUMN (Clean 4:3 Photo Card)         |  RIGHT COLUMN (3D Choice Cards) |
|                                             |                                 |
|  +---------------------------------------+  |  Which letter is this?          |
|  |                                       |  |                                 |
|  |      [ Clean 4:3 Hand-Sign Photo ]    |  |  +-------+ +-------+ +-------+  |
|  |            (Letter C Photo)           |  |  |   A   | |   B   | |   C   |  |
|  |                                       |  |  +-------+ +-------+ +-------+  |
|  +---------------------------------------+  |                                 |
|                                             |  Select a card, then check.     |
+---------------------------------------------+---------------------------------+
|  BOTTOM FEEDBACK BAR                                                          |
|  (✓) That's right! This is C.                         [ See my result > ]     |
+-------------------------------------------------------------------------------+
```

- **Left Column:** Clean 4:3 hand-sign photo card (`aspect-ratio: 4 / 3`) with card border, subtle shadow, and centered hand photo.
- **Right Column:** Large tactile 3D A / B / C choice cards (`.choice`) with bottom shadow bevel (`box-shadow: 0 4px 0 ...`).
- **Interactive State Flow:**
  - Tapping any card selects it and enables the *Check answer* button in the bottom bar.
  - Checking the correct answer (e.g., **C**) highlights the selected card and bottom feedback bar in success green (`#dcfce7` / `#16a34a`).
  - Displays *"That's right! This is C."* and advances via *"See my result"* (on final question) or *"Next question"*.

---

## 8. Implementation Phases & Milestones

### Phase 1: Fullscreen Fluid Grid & CSS Overhaul
- [x] Update `src/renderer/style.css` to remove rigid max-width clamps on `.content`, `.shell-top .content`, and screen containers.
- [x] Configure `minmax(0, 1fr)` and fluid `clamp()` spacing across 1920×1080 full-screen viewports down to 768px.
- [x] Define reusable 7/5 split (`.lesson-stage-7-5-grid`) and 5/7 split (`.camera-stage-5-7-grid`) layouts.
- [x] Implement tactile 3D push-button tokens (`box-shadow: 0 4px 0 ...`, `transform: translateY(2px)` on active).

### Phase 2: Lesson Stage Component (`Look at A`)
- [x] Create `src/renderer/lesson-stage.tsx`.
- [x] Build Sticky Top Progress Header with back button, step indicator, 33% bar, and amber Voice Tip button.
- [x] Implement Web Speech API integration for audible handshape instruction playback.
- [x] Build Left Column: 4:3 dark-framed demonstration card, letter status pill, and replay action.
- [x] Build Right Column: target card with letter tile, 3-step numbered guide box, and Try on Camera / Next Step buttons.
- [x] Add teaching mode footer bar.

### Phase 3: Camera Practice Stage Component (`Look at B`)
- [x] Build Sticky Top Progress Header (66% bar) with Live Camera Active pulsing status pill.
- [x] Build Title Row with Camera Practice badge and Back to Demonstration button.
- [x] Build Left Column: prompt card with letter tile, collapsible hint box with toggle, camera controls, and privacy notice.
- [x] Build Right Column: 16:10 dark viewport with Active (hand target box) and Off (in-stage start button) states.
- [x] Build Bottom Step Navigation Bar with 3D tactile Previous and Next step buttons.

### Phase 4: Course Integration & Shell Router
- [x] Connect `LessonStage` inside `src/renderer/course.tsx` (`LessonView` and `LessonStep`).
- [x] Ensure hash navigation between demonstration (`#lesson/[id]/demo/[step]`) and camera practice states works smoothly.
- [x] Preserve existing teacher builder and quiz flows without regression.

### Phase 5: Verification & Accessibility
- [x] Verify fullscreen behavior on 1920×1080 resolution (zero awkward borders, fluid column expansion).
- [x] Verify responsive scaling on 1280×900, 1024×768, and mobile viewports.
- [x] Verify keyboard accessibility (`Tab`, `Space`, `Enter`) across all 3D buttons.
- [x] Execute `npm run check` and `npm run build` to confirm zero errors.

---

## 7. Verification & Acceptance Criteria

| Component / Area | Acceptance Criteria |
| :--- | :--- |
| **Fullscreen Scaling** | On 1920×1080 maximized window, layout expands fluidly to fill workspace up to 1680px without large empty side gutters. |
| **Lesson Sticky Header**| Sticky at top; back button returns to lesson overview; step pill and 33% progress bar display accurately. |
| **Voice Tip Button** | Warm amber rounded button triggers audible spoken instructions via Web Speech API. |
| **Sign Demonstration** | 4:3 dark media container with Letter A Handshape pill; guidance footer with working replay button. |
| **3-Step Guide Box** | Soft green box displays 3 numbered, plain-language handshape steps with lightbulb icon. |
| **Action Stack** | Two full-width 3D push-buttons (`Try on camera` and `Next step`) navigate to respective states. |
| **Camera Practice Header**| Sticky at top; 66% progress bar; live pulsing green dot when camera is active. |
| **Hint Box Drawer** | Toggles smoothly between hidden and expanded handshape tip on button click. |
| **Camera Viewport States**| Supports Active (alignment target box) and Off (centered in-stage start button) states seamlessly. |
| **Bottom Navigation Bar**| Docked full-width bar with 16px-rounded 3D `Previous step` and `Next step` buttons. |
| **Build & Type Safety** | `npm run check` passes with 0 errors; `npm run build` bundles all assets without errors. |
