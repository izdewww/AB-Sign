import { useState } from 'react';
import type { Lesson, Step } from './lessons';
import { cameraSupports, findLetter, isLabel, moves } from './letters';
import { Icon } from './icons';
import { LessonMedia } from './lesson-media';
import { vocabularyVideo } from './vocabulary';

export function getHandshapeSteps(letterOrWord: string): string[] {
  const char = letterOrWord.trim().toUpperCase();
  switch (char) {
    case 'A':
      return [
        'Make a relaxed fist with your dominant hand.',
        'Keep your four fingers curled in tight.',
        'Rest your thumb straight up against the side of your index finger.'
      ];
    case 'B':
      return [
        'Hold four fingers straight up together.',
        'Tuck your thumb flat across your palm.',
        'Keep your hand steady facing forward.'
      ];
    case 'C':
      return [
        'Curve all your fingers slightly forward.',
        'Curve your thumb up to meet them like an open "C".',
        'Keep your hand turned so the curved shape is clear.'
      ];
    case 'D':
      return [
        'Point your index finger straight up.',
        'Touch your thumb to the tips of your other three fingers.',
        'Form a clear circle resembling the letter D.'
      ];
    case 'E':
      return [
        'Bend all four fingers down toward your palm.',
        'Tuck your thumb in tightly below your fingertips.',
        'Keep your knuckles facing forward.'
      ];
    case 'F':
      return [
        'Touch the tip of your index finger to your thumb tip.',
        'Hold your remaining three fingers upright and spread.',
        'Keep your palm facing forward.'
      ];
    case 'G':
      return [
        'Extend your thumb and index finger parallel to each other.',
        'Point them horizontally toward the side.',
        'Keep your remaining fingers curled in.'
      ];
    case 'H':
      return [
        'Extend both your index and middle fingers together horizontally.',
        'Tuck your thumb over your ring and pinky fingers.',
        'Point both fingers straight across.'
      ];
    case 'I':
      return [
        'Extend your pinky finger straight up.',
        'Hold down all three other fingers with your thumb.',
        'Keep your hand steady at chest level.'
      ];
    case 'L':
      return [
        'Extend your index finger straight up.',
        'Extend your thumb straight out to the side forming an "L".',
        'Keep your other three fingers curled in.'
      ];
    default:
      return [
        `Observe the finger placement shown for ${letterOrWord}.`,
        'Position your dominant hand steady at chest level.',
        'Keep your palm facing forward as demonstrated.'
      ];
  }
}

export function getHandshapeHint(letterOrWord: string): string {
  const char = letterOrWord.trim().toUpperCase();
  if (char === 'B') {
    return 'Hold 4 fingers straight up together and tuck your thumb flat across your palm.';
  } else if (char === 'A') {
    return 'Make a fist with four fingers down and rest your thumb straight along the side.';
  } else if (char === 'C') {
    return 'Curve all fingers and thumb forward like an open "C".';
  } else if (char === 'D') {
    return 'Point index finger up, touch thumb to remaining finger tips.';
  }
  return `Keep your fingers steady in the demonstrated position for ${letterOrWord}.`;
}

export function speakInstruction(text: string) {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.92;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Audio speech playback optional fallback
    }
  }
}

export function LessonDemoStage({
  step,
  lesson,
  index,
  total,
  action,
  next,
  onTryOnCamera,
  canPractice = false
}: {
  step: Step;
  lesson: Lesson;
  index: number;
  total: number;
  action: string;
  next: () => void;
  onTryOnCamera?: () => void;
  canPractice?: boolean;
}) {
  const [replayKey, setReplayKey] = useState(0);

  const sign = 'letter' in step && isLabel(step.letter) ? findLetter(step.letter) : undefined;
  const isMedia = step.kind === 'media';
  const termName = isMedia ? step.term : sign ? sign.label : 'Sign';
  const label = sign ? sign.label : termName;
  const stepImage = 'image' in step ? step.image : undefined;
  const stepVideo = 'video' in step ? step.video : undefined;
  const demoVideo = isMedia && !stepImage ? vocabularyVideo(step.example) : undefined;

  const progressPercent = Math.max(10, Math.round(((index + 1) / total) * 100));
  const handshapeSteps = getHandshapeSteps(label);

  const voiceScript = `How to sign ${label}. Step 1: ${handshapeSteps[0]} Step 2: ${handshapeSteps[1]} Step 3: ${handshapeSteps[2]}`;

  let nextCue = 'Lesson Review';
  if (index + 1 < total && lesson.steps[index + 1]) {
    const nextStep = lesson.steps[index + 1];
    if ('letter' in nextStep && nextStep.letter) {
      nextCue = `Letter ${nextStep.letter} Demonstration`;
    } else if (nextStep.kind === 'media' && nextStep.term) {
      nextCue = `${nextStep.term} Demonstration`;
    } else {
      nextCue = `Step ${index + 2}`;
    }
  }

  const handleReplay = () => {
    setReplayKey((k) => k + 1);
    const video = document.querySelector('.demo-media-4-3-container video') as HTMLVideoElement | null;
    if (video) {
      video.currentTime = 0;
      video.play().catch(() => {});
    }
  };

  return (
    <div className="lesson-stage-container">
      {/* Sticky Top Progress Header */}
      <header className="lesson-sticky-header">
        <a
          className="header-back-btn btn-3d"
          href={'#lesson/' + lesson.id}
          aria-label="Back to lesson overview"
        >
          <Icon name="back" />
        </a>

        <div className="header-progress-center">
          <div className="header-meta-row">
            <span className="header-lesson-title">{lesson.title}</span>
            <span className="header-step-pill">{index + 1} of {total}</span>
          </div>
          <div className="header-progress-track" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
            <div className="header-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <button
          type="button"
          className="voice-tip-btn"
          onClick={() => speakInstruction(voiceScript)}
          aria-label="Voice tip audio instruction"
          title="Listen to sign instruction"
        >
          <Icon name="sound" />
          <span>Voice Tip</span>
        </button>
      </header>

      {/* Main 2-Column Stage (7 / 5 Desktop Split) */}
      <div className="lesson-stage-7-5-grid">
        {/* Left Column (7/12) — Sign Demonstration Card */}
        <div className="sign-demo-card">
          <div className="sign-demo-header">
            <div className="sign-demo-label-group">
              <Icon name="hand" />
              <span>Sign Demonstration</span>
            </div>
            <span className="sign-demo-badge">Clear Front View</span>
          </div>

          {/* 4:3 Dark-Framed Media Container */}
          <div className="demo-media-4-3-container" key={replayKey}>
            <div className={'study-stage ' + (sign ? sign.tone : 'sky')}>
              {isMedia ? (
                <LessonMedia name={step.term} image={stepImage} file={stepVideo} bundledVideo={demoVideo} />
              ) : sign ? (
                <>
                  <LessonMedia letter={sign} image={stepImage} file={stepVideo} />
                  {moves(sign.label) && !stepVideo && <p>{sign.label} is a moving sign. This picture shows one moment.</p>}
                </>
              ) : null}
            </div>
            <div className="handshape-floating-pill">
              Letter {label} Handshape
            </div>
          </div>

          {/* Bottom Guidance Strip */}
          <div className="demo-guidance-strip">
            <span className="demo-guidance-text">Hold your hand steady at chest level.</span>
            <button
              type="button"
              className="demo-replay-btn"
              onClick={handleReplay}
              aria-label="Replay demonstration"
            >
              <Icon name="retry" />
              <span>Replay</span>
            </button>
          </div>
        </div>

        {/* Right Column (5/12) — Target Letter, Steps & Actions */}
        <div className="target-letter-card">
          <div className="target-card-header-row">
            <div className="target-card-info">
              <span className="target-step-counter-badge">Step {index + 1} of {total}</span>
              <h1 className="lesson-stage-title">
                {isMedia ? step.term : `Look at ${label}`}
              </h1>
              <p className="target-instruction-sub">
                Watch the hand shape carefully before trying it on camera.
              </p>
            </div>
            <div className="letter-tile-large">{label}</div>
          </div>

          {/* How to Sign Soft-Green Container */}
          <div className="how-to-sign-box">
            <div className="how-to-sign-header">
              <span>💡</span>
              <span>How to Sign {label}</span>
            </div>
            <ol className="how-to-sign-steps-list">
              {handshapeSteps.map((instruction, idx) => (
                <li key={idx}>{instruction}</li>
              ))}
            </ol>
          </div>

          {/* Action Stack: Tactile 3D Buttons */}
          <div className="stage-actions-stack">
            {canPractice && onTryOnCamera && (
              <button
                type="button"
                className="button secondary btn-3d"
                onClick={onTryOnCamera}
              >
                <Icon name="camera" /> Try on camera
              </button>
            )}
            <button
              type="button"
              className="button primary btn-3d"
              onClick={next}
            >
              {action} <Icon name="arrow" />
            </button>
          </div>
        </div>
      </div>

      {/* Footer Notice Bar */}
      <footer className="stage-footer-bar">
        <span>A-B-Sign! Teaching Mode • Up next: {nextCue}</span>
      </footer>
    </div>
  );
}
