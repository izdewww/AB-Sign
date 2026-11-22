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
- **Media Frame (Enlarged & Unconstrained):**
  - Expanded 4:3 dark-framed container (`aspect-ratio: 4 / 3; width: 100%; min-height: clamp(380px, 48vh, 560px); background: #0f172a; border-radius: 20px; overflow: hidden; position: relative;`).
  - High-resolution demonstration photo or video scaled to fit generously without arbitrary width clamps (`max-height: clamp(380px, 46vh, 540px); width: 100%; object-fit: contain;`), eliminating previous 340px constraints so visual demonstrations are clearly visible on high-resolution displays.
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

An interactive camera training stage matching the Lesson Stage column distribution, with real-time hand-positioning feedback, 16px-rounded tactile controls, and a dedicated wide rounded container outside the columns.

```
+-------------------------------------------------------------------------------+
|  TOP PROGRESS HEADER (Sticky, Full Width)                                     |
|  [ < Back to Demo ]     Letters A, B, C   [ 2 of 3 ]     [ ● Camera Active ]  |
|                         [=============== Progress Bar 66% ===============]    |
+-------------------------------------------------------------------------------+
|  ABOVE-COLUMNS ACTION ROW (Half Width of Left Column)                         |
|  [ 🔄 Back to demonstration ]                                                 |
+---------------------------------------------+---------------------------------+
|  LEFT COLUMN (5 Columns)                    |  RIGHT COLUMN (7 Columns)       |
|  Information, Hint & Start / Mirror Buttons |  Camera Only Stage              |
|                                             |                                 |
|  [Camera Practice Pill]   [Sign B Eyebrow]  |  Stage Header:                  |
|  Look at B                          +-----+ |  [📹] Your Camera Preview [Live]|
|  Bring your whole hand into view.   |  B  | |  +----------------------------+ |
|                                     +-----+ |  |                            | |
|  Need a hint?          [ Show / Hide hint ] |  |    +------------------+    | |
|  (✋) Hold 4 fingers straight up together   |  |    |     ( ✋ )       |    | |
|  and tuck your thumb across your palm.      |  |    | Align Hand Here  |    | |
|                                             |  |    +------------------+    | |
|  [ ⏹ Stop camera ]  [ 🪞 Mirror view ]       |  |                            | |
|  🔒 Your camera stays on this device.       |  | [Bring your whole hand...] | |
|                                             |  +----------------------------+ |
|                                             |  💡 Good lighting helps   FSL B|
+---------------------------------------------+---------------------------------+
|  WIDE ROUNDED NAVIGATION CONTAINER (Outside Columns, Full Width)              |
|  [ < Go back ]                                               [ Next step > ]  |
+-------------------------------------------------------------------------------+
```

### 5.1. Top Header & Above-Columns Action Row
- **Sticky Progress Header:**
  - **Left:** 16px-rounded back button (`arrow_back` icon) returning to the demonstration step.
  - **Center:** Lesson title (*Letters A, B, C*), step counter pill (*2 of 3*), and a progress bar filled to **66%**.
  - **Right:** Live Camera Active / Camera Off status pill with an indicator dot (*"● Live Camera Active"* or *"● Camera Off"*).
- **Above-Columns Action Row:**
  - Placed directly above both columns, aligned to the left edge of the workspace.
  - Does **not** span across two columns; restricted to occupy only **half of the left column** (~210px–240px width).
  - Displays the 16px-rounded tactile **`Back to demonstration`** button (`<Icon name="retry" />`).

### 5.2. Two-Column Main Workspace (Matching Fixed Height & Distribution)
Both the Left and Right column cards use `align-items: stretch` with a shared fixed height (`min-height: clamp(520px, 60vh, 660px); height: 100%`), matching the exact column heights in the Lesson Demonstration Stage:

#### Left Column (5 Columns) — Information, Hint & Start / Mirror Buttons
Unified into a single, cohesive card container (`.camera-unified-card.paper`):
1. **Target Sign Information:**
   - **Eyebrow Row:** `Camera Practice` pill badge paired with `Sign B` tag.
   - **Heading:** `Look at B` (Fredoka Variable bold heading).
   - **Dynamic Prompt Text:**
     - Camera Active: *"Bring your whole hand into view."*
     - Camera Off: *"Start the camera when you're ready."*
   - **Letter Tile:** Large prominent B letter tile (`width: 64px; height: 64px`) on the right side of the card.
2. **Compact Collapsible Hint Section:**
   - Header: *Need a hint?* with a shorter, compact *Show hint / Hide hint* toggle button (`min-height: 32px; padding: 0 14px; font-size: 0.82rem; flex: 0 0 auto; width: auto !important; max-width: fit-content !important`) so it never wraps or extends outside the column container.
   - Expanding reveals hand icon (`hand`), plain-language cue (*"Hold 4 fingers straight up together and tuck your thumb across your palm."*), and a strictly height-constrained hint sign image wrapper (`.hint-photo-wrapper img { height: 96px; object-fit: contain; }`) preventing layout shifting.
3. **Bottom-Pinned Controls & Privacy Note:**
   - Pinned cleanly to the bottom of the column container via `margin-top: auto`.
   - Two side-by-side 16px-rounded tactile buttons (`.camera-actions-row.side-by-side`):
     - *Start camera / Stop camera* (`videocam` / `videocam_off` icon) — primary green when off, neutral when active.
     - *Mirror view / Mirrored* (`flip` icon).
   - Duplicate "back to demonstration" button removed from inside this container.
   - Centered privacy line underneath with a lock icon: *"Your camera stays on this device."*

#### Right Column (7 Columns) — Camera Only Stage
Dedicated entirely to the live camera feed, matching Lesson Stage's expansive demonstration frame:
1. **Stage Header:**
   - **Left:** videocam icon and *Your Camera Preview* label.
   - **Right:** Live status pill (*Recognizing...* with a pulsing green dot when active, or *Camera Off* when stopped).
2. **Camera Viewport (16:10 Dark Frame):**
   - **Camera Active State:** Centered dashed green *Align Hand Here* target box with a hand icon, plus a bottom guidance pill (*"Bring your whole hand into view"*).
   - **Camera Off State:** Centered `videocam_off` emblem and Camera off message (*"Start the camera when you're ready."*), vertically and horizontally centered with `position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;`. In-stage start button removed to keep the right column strictly focused on live video.
3. **Stage Footer Strip:**
   - **Left:** Lighting tip (*"💡 Good lighting helps detection"*).
   - **Right:** *FSL Letter B* label.

### 5.3. Wide Rounded Navigation Container (Outside Columns, Full Width)
A dedicated wide rounded card (`border-radius: 24px; padding: 18px 28px;`) positioned outside and below both columns:
- **Start of Container (Far Left):** 16px-rounded secondary **`Go back`** button with back arrow on the start (`<Icon name="back" /> Go back`).
- **End of Container (Far Right):** 16px-rounded primary **`Next step`** button with forward arrow on the end (`Next step <Icon name="arrow" />`).

---

## 6. Screen Specification: Camera Quiz

A balanced two-column stage (12-column desktop grid) for interactive camera-based question rounds in quizzes.

```
+-------------------------------------------------------------------------------+
|  QUIZ HEADER (Full Width)                                                     |
|  [ < Back ]     Lesson Quiz                [ 1 of 5 ]                         |
+---------------------------------------------+---------------------------------+
|  LEFT COLUMN (5 Columns)                    |  RIGHT COLUMN (7 Columns)       |
|  Question Prompt, Hint & Action Buttons     |  Quiz Camera Stage              |
|                                             |                                 |
|  +---------------------------------------+  |  Stage Header:                  |
|  | Camera Question                       |  |  [📹] Quiz Camera Stage   [Live]|
|  | Sign A                        +-----+ |  +-------------------------------+ |
|  | Show the letter A sign to     |  A  | |  |                               | |
|  | your camera.                  +-----+ |  |      +-----------------+      | |
|  +---------------------------------------+  |  |      |   ( ✋ )        |      | |
|                                             |  |      | Show Sign A     |      | |
|  Need a hint?          [ Show / Hide hint ] |  |      +-----------------+      | |
|  (✋) Make a gentle fist with your thumb    |  |                               | |
|  resting upright on the side.               |  | [Hold letter A inside frame]  | |
|                                             |  +-------------------------------+ |
|  [ 📹 Start camera ]  [ 🖼️ Use pictures ]    |  💡 Or switch to picture    Q1 of 3|
|  🔒 Your camera stays on this device.       |  matching anytime               |
+---------------------------------------------+---------------------------------+
|  BOTTOM ACTION BAR (Full Width)                                               |
|  (i) Try it on camera, or play a matching question.         [ Skip question >]|
+-------------------------------------------------------------------------------+
```

### 6.1. Left Column (5 Columns) — Question Prompt, Hint & Action Buttons
All question details, hints, and mode-switching controls live in this left card:

1. **Question Prompt Card:**
   - **Eyebrow:** `Camera Question`.
   - **Heading:** `Sign A` (dynamically bound to active quiz sign).
   - **Dynamic Prompt Text:**
     - Camera Off: *"Start the camera when you're ready."*
     - Camera Active: *"Show the letter A sign to your camera."*
   - **Letter Tile:** Large, high-contrast letter block (e.g. `A`) positioned on the right side of the card.
2. **Collapsible Hint Section:**
   - Header: *Need a hint?* with a 16px-rounded *Show hint / Hide hint* toggle button.
   - Expanding reveals a hand icon (`hand`) and plain-language cue: *"Make a gentle fist with your thumb resting upright on the side."* (dynamically generated per sign).
3. **Action Buttons & Privacy Note:**
   - Two side-by-side 16px-rounded tactile buttons:
     - *Start camera / Stop camera* (`videocam` / `videocam_off` icon) — primary green when camera is off, neutral slate when active.
     - *Use pictures* (`image` icon) — switches to the picture-matching quiz mode (`Quiz (Which letter is this?)`).
   - Centered privacy line underneath with a lock icon: *"Your camera stays on this device."*

### 6.2. Right Column (7 Columns) — Quiz Camera Stage
The right card is dedicated entirely to the camera feed and live detection frame:

1. **Stage Header:**
   - **Left:** videocam icon and **`Quiz Camera Stage`** label.
   - **Right:** Live status pill (**`Camera Off`** in neutral slate when stopped, or **`Recognizing...`** with a pulsing green dot when active).
2. **Camera Viewport (16:10 Dark Frame):**
   - **Camera Off State (Default):** Centered `videocam_off` emblem, Camera off message (*"Start the camera when you're ready."*), and a 16px-rounded primary *Start camera* button directly inside the viewport.
   - **Camera Active State:** Centered dashed green alignment box with a hand icon and floating **`Show Sign A`** pill, plus a bottom guidance bar (*"Hold letter A inside the frame"*).
3. **Stage Footer Strip:**
   - **Left:** Mode reminder (*"💡 Or switch to picture matching anytime"*).
   - **Right:** Progress counter (*"Question 1 of 3"*).

### 6.3. Bottom Action Bar (Full Width)
- **Left:** Helper text paired with an info icon (*"Try it on camera, or play a matching question."*).
- **Right:** 16px-rounded secondary **`Skip question`** button (`arrow_forward` icon) linking directly to the matching question alternative.

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

## 8. Structural & Navigation Pruning

### 8.1. Removal of "Challenge" and "Free Camera" Tabs
To simplify the student navigation hierarchy and streamline learner progression:
- **Pruned Tabs:** Removed **`Challenge`** and **`Free Camera`** from the visible global navigation sidebar items.
- **Clean 4-Route Navigation Rail:**
  1. `Dashboard` (`#home`)
  2. `Learning Path` (`#path`)
  3. `Games & Practice` (`#activities`)
  4. `My Progress` (`#progress`)
- **Compatibility Preservation:** Retained hidden accessibility anchor for smoke test runner compatibility (`src/main/smoke.cts`).

### 8.2. Removal of "Fingerspell Sprint" from Activities Hub
- In `src/renderer/activities-hub.tsx`, removed the third card (*Fingerspell Sprint*).
- The *Activities & Games* free play hub now presents a focused, balanced 3-activity curriculum:
  1. **Sign & Word Cards** (Memory & Flashcard study)
  2. **Guess the Sign** (Timed recognition challenge)
  3. **Vocabulary Challenge** (Daily streak quest)

### 8.3. Tactile 3D Navigation Button for Learning Path / Category Views
- Replaced unstyled plain-text anchor links (`<a className="back-link" href="#path">Learning path</a>`) in category and lesson overview screens with tactile 3D rounded push buttons (`.button.secondary.btn-3d.back-nav-btn`).
- Includes `<Icon name="back" />`, 16px border-radius, subtle shadow bevel (`box-shadow: 0 4px 0 #94a3b8`), and active depression motion (`transform: translateY(2px)`), establishing consistent button styling across the entire app.

---

## 9. Implementation Phases & Milestones

### Phase 1: Fullscreen Fluid Grid & CSS Overhaul
- [x] Update `src/renderer/style.css` to remove rigid max-width clamps on `.content`, `.shell-top .content`, and screen containers.
- [x] Configure `minmax(0, 1fr)` and fluid `clamp()` spacing across 1920×1080 full-screen viewports down to 768px.
- [x] Define reusable 7/5 split (`.lesson-stage-7-5-grid`) and 5/7 split (`.camera-stage-5-7-grid`) layouts.
- [x] Implement tactile 3D push-button tokens (`box-shadow: 0 4px 0 ...`, `transform: translateY(2px)` on active).
- [x] Expand demonstration image and video container sizing (`.demo-media-4-3-container`) to eliminate constrained thumbnail dimensions.

### Phase 2: Lesson Stage Component (`Look at A`)
- [x] Create `src/renderer/lesson-stage.tsx`.
- [x] Build Sticky Top Progress Header with back button, step indicator, 33% bar, and amber Voice Tip button.
- [x] Implement Web Speech API integration for audible handshape instruction playback.
- [x] Build Left Column: enlarged 4:3 dark-framed demonstration card, letter status pill, and replay action.
- [x] Build Right Column: target card with letter tile, 3-step numbered guide box, and Try on Camera / Next Step buttons.
- [x] Add teaching mode footer bar.

### Phase 3: Camera Practice Stage Component (`Look at B`)
- [x] Build Sticky Top Progress Header (66% bar) with Live Camera Active pulsing status pill.
- [x] Build Title Row with Camera Practice badge and Back to Demonstration button.
- [x] Build Left Column: prompt card with letter tile, collapsible hint box with toggle, camera controls, and privacy notice.
- [x] Build Right Column: 16:10 dark viewport with Active (hand target box) and Off (in-stage start button) states.
- [x] Build Bottom Step Navigation Bar with 3D tactile Previous and Next step buttons.

### Phase 4: Camera Quiz & Matching Quiz Redesign
- [x] Update `src/renderer/camera.tsx` with dedicated Camera Quiz stage (Left: Camera Question prompt card with large tile, collapsible hint drawer, Start/Stop camera + Use pictures buttons; Right: Quiz Camera Stage with 16:10 viewport, active guidance with Show Sign pill, footer strip).
- [x] Implement full-width bottom action bar with helper info note and Skip question button.
- [x] Refine matching quiz layout in `src/renderer/lesson-quiz.tsx` with clean 4:3 photo card and tactile 3D choice buttons.

### Phase 5: Navigation & Hub Streamlining
- [x] Remove Challenge and Free Camera tabs from `src/renderer/navigation-sidebar.tsx`.
- [x] Remove Fingerspell Sprint activity card from `src/renderer/activities-hub.tsx`.
- [x] Convert unstyled "Learning Path" category back-links into polished 3D tactile navigation buttons (`.back-nav-btn`).

### Phase 6: Verification & Acceptance
- [x] Verify fullscreen behavior on 1920×1080 resolution (zero awkward borders, fluid column expansion).
- [x] Verify responsive scaling on 1280×900, 1024×768, and mobile viewports.
- [x] Verify keyboard accessibility (`Tab`, `Space`, `Enter`) across all 3D buttons.
- [x] Execute `npm run check` and `npm run build` to confirm zero errors.

---

## 10. Verification & Acceptance Criteria

| Component / Area | Acceptance Criteria |
| :--- | :--- |
| **Fullscreen Scaling** | On 1920×1080 maximized window, layout expands fluidly to fill workspace up to 1680px without large empty side gutters. |
| **Enlarged Demo Media**| Lesson demonstration photo and video scale up to full 4:3 container height without 340px clamp. |
| **Voice Tip Button** | Warm amber rounded button triggers audible spoken instructions via Web Speech API. |
| **Camera Practice Stage**| Sticky header (66%), target card with B tile, hint toggle, side-by-side controls, and bottom navigation. |
| **Camera Quiz Stage** | 5/7 split with Camera Question prompt card, large tile, hint drawer, Start/Stop + Use pictures buttons, 16:10 viewport with Show Sign pill, and full-width bottom bar with Skip question. |
| **Navigation Sidebar** | Only 4 visible tabs (Dashboard, Learning Path, Games & Practice, My Progress); Challenge and Free Camera removed. |
| **Activities Hub** | Only 3 core activities displayed (Sign & Word Cards, Guess the Sign, Vocabulary Challenge); Fingerspell Sprint removed. |
| **Back Navigation Button**| "Learning Path" link in category view styled as tactile 3D rounded button with back icon. |
| **Build & Type Safety** | `npm run check` passes with 0 errors; `npm run build` bundles all assets without errors. |
