import { useEffect, useRef, useState, type ReactNode } from 'react';
import { letters } from './letters';
import type { Label } from './classroom';
import type { CameraReport } from './recognize.worker';
import type { WordCameraReport } from './vocabulary.worker';
import { Icon } from './icons';
import { LessonMedia, SignPhoto } from './lesson-media';
import { SignSuccessModal } from './sign-success-modal';
import { getHandshapeHint } from './lesson-stage';

type Run = { stream?: MediaStream; worker?: Worker; loop?: number; startup?: number };

export type LessonCameraContext = {
  lessonTitle: string;
  stepIndex: number;
  totalSteps: number;
  onBackToDemo: () => void;
  onNext: () => void;
  previousUrl?: string;
  actionText: string;
};

export type QuizCameraContext = {
  onUsePictures?: () => void;
  usePicturesLabel?: string;
};

function release(run: Run | undefined) {
  if (!run) return;
  clearInterval(run.loop);
  clearTimeout(run.startup);
  run.worker?.terminate();
  run.stream?.getTracks().forEach((track) => track.stop());
}

export function Camera({ target, term, match, guided = false, fallback, image, lessonContext, quizContext }: {
  target?: Label; term?: { id: string; name: string; demo?: string; video?: File };
  match?: () => void; guided?: boolean; fallback?: ReactNode; image?: File;
  lessonContext?: LessonCameraContext;
  quizContext?: QuizCameraContext;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const current = useRef<Run>(undefined);
  const [state, setState] = useState<'off' | 'starting' | 'on' | 'error'>('off');
  const [status, setStatus] = useState('Start the camera when you’re ready.');
  const [flipped, setFlipped] = useState(true);
  const [stable, setStable] = useState(false);
  const [hint, showHint] = useState(guided);
  const [showModal, setShowModal] = useState(false);
  const letter = letters.find(({ label }) => label === target);
  const targetName = term?.name ?? target;

  useEffect(() => {
    if (stable && targetName) {
      setShowModal(true);
    }
  }, [stable, targetName]);

  const reset = () => {
    release(current.current);
    current.current = undefined;
    if (video.current) video.current.srcObject = null;
    setStable(false);
    setShowModal(false);
  };

  useEffect(() => () => {
    release(current.current);
    current.current = undefined;
  }, []);

  async function start() {
    if (current.current) return;
    const run: Run = {};
    current.current = run;
    setState('starting');
    setStatus('Starting the camera…');
    const fail = (message: string) => {
      if (current.current !== run) return;
      reset();
      setState('error');
      setStatus(message);
    };
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      if (current.current !== run || !video.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      run.stream = stream;
      stream.getVideoTracks()[0]?.addEventListener('ended', () => fail('The camera disconnected. Try again or use pictures.'), { once: true });
      const screen = video.current;
      screen.srcObject = stream;
      await screen.play();
      if (current.current !== run) return;
      if (!targetName) {
        setState('on');
        setStatus('Camera ready. Keep your whole hand in view.');
        return;
      }

      const worker = term
        ? new Worker(new URL('./vocabulary.worker.ts', import.meta.url), { type: 'module' })
        : new Worker(new URL('./recognize.worker.ts', import.meta.url), { type: 'module' });
      run.worker = worker;
      let busy = false;
      let lastVideoTime = -1;
      let hold = 0;
      let frameCount = 0;
      let matched = false;
      run.startup = window.setTimeout(() => fail('Camera practice took too long to start. Try again or use pictures.'), 20000);
      worker.onmessage = ({ data }: MessageEvent<CameraReport | WordCameraReport>) => {
        if (current.current !== run) return;
        if (data.kind === 'error') {
          console.warn('Camera practice error:', data.message);
          fail('Camera practice is unavailable. You can try again or use pictures.');
        } else if (data.kind === 'ready') {
          clearTimeout(run.startup);
          setState('on');
          setStatus(`Show the sign for ${targetName}.`);
          run.loop = window.setInterval(async () => {
            if (matched || busy || screen.readyState < 2 || screen.currentTime === lastVideoTime) return;
            busy = true;
            lastVideoTime = screen.currentTime;
            try {
              const frame = await createImageBitmap(screen);
              if (current.current !== run) { frame.close(); return; }
              worker.postMessage({ kind: 'frame', image: frame, time: performance.now() }, [frame]);
            } catch {
              fail('The camera stopped sending pictures. Try again or use pictures.');
            }
          }, 'fps' in data ? 1000 / data.fps : 90);
        } else if (data.kind === 'progress') {
          busy = false;
          setStatus(`Show the sign for ${targetName} · ${data.elapsed} sec`);
        } else if (data.kind === 'word') {
          busy = false;
          matched = Boolean(data.id && data.id === term?.id);
          setStable(matched);
          setStatus(matched ? `That looks like ${targetName}!` : data.hands ? 'Try the sign once more.' : 'Keep your hands and shoulders in view.');
        } else {
          busy = false;
          const now = performance.now();
          if (data.letter !== target) {
            hold = 0;
            frameCount = 0;
            setStable(false);
            setStatus(data.hand ? `Try making ${target} again.` : 'Bring your whole hand into view.');
          } else {
            if (!hold) hold = now;
            const ready = ++frameCount >= 4 && now - hold >= 400;
            setStable(ready);
            setStatus(ready ? `That looks like ${target}!` : 'Hold that shape…');
          }
        }
      };
      worker.onerror = (error) => {
        console.warn('Camera practice error:', error.message);
        fail('Camera practice is unavailable. You can try again or use pictures.');
      };
      worker.postMessage({ kind: 'start', term: term?.id });
    } catch (error) {
      fail(error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'Camera access is off. Check Windows camera settings or use pictures.'
        : 'The camera is unavailable. Try reconnecting it or use pictures.');
    }
  }

  // 1. If in lesson context, render the dedicated 5 / 7 split Camera Practice Stage
  if (lessonContext) {
    const letterLabel = targetName || 'Sign';
    const progressPercent = Math.max(10, Math.round(((lessonContext.stepIndex + 1) / lessonContext.totalSteps) * 100));

    return (
      <div className="camera-practice-stage-wrapper">
        {/* Sticky Top Progress Header */}
        <header className="lesson-sticky-header">
          <button
            type="button"
            className="header-back-btn btn-3d"
            onClick={lessonContext.onBackToDemo}
            aria-label="Back to demonstration"
          >
            <Icon name="back" />
          </button>
          <div className="header-progress-center">
            <div className="header-meta-row">
              <span className="header-lesson-title">{lessonContext.lessonTitle}</span>
              <span className="header-step-pill">{lessonContext.stepIndex + 1} of {lessonContext.totalSteps}</span>
            </div>
            <div className="header-progress-track" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
              <div className="header-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
          <div className="header-camera-status-pill">
            <span className={`camera-dot ${state === 'on' ? 'dot-active' : 'dot-off'}`} />
            <span>{state === 'on' ? 'Live Camera Active' : 'Camera Off'}</span>
          </div>
        </header>

        {/* Page Title Row */}
        <div className="camera-stage-title-row">
          <div className="camera-stage-title-group">
            <h1 className="camera-stage-title">Look at {letterLabel}</h1>
            <span className="badge-pill emerald">Camera Practice</span>
          </div>
          <button
            type="button"
            className="button secondary back-to-demo-btn btn-3d"
            onClick={lessonContext.onBackToDemo}
          >
            <Icon name="retry" /> Back to demonstration
          </button>
        </div>

        {/* Main 5 / 7 Desktop Split */}
        <div className="camera-stage-5-7-grid">
          {/* Left Column (5 Columns) — Information, Hint & Camera Controls */}
          <div className="camera-stage-left-col">
            {/* Target Sign Info Card */}
            <div className="target-sign-card paper">
              <div className="target-sign-header">
                <div className="camera-hint">
                  <span className="target-sign-eyebrow">Target Sign</span>
                  <h2>Sign {letterLabel}</h2>
                  <p className="prompt-text">
                    {state === 'on' ? 'Bring your whole hand into view.' : "Start the camera when you're ready."}
                  </p>
                </div>
                <div className="letter-tile-large">{letterLabel}</div>
              </div>
            </div>

            {/* Collapsible Hint Section */}
            <div className="collapsible-hint-card paper">
              <div className="hint-card-header">
                <div className="hint-title-group">
                  <span>💡</span>
                  <strong>Need a hint?</strong>
                </div>
                <button
                  type="button"
                  className="button secondary hint-toggle btn-3d"
                  aria-expanded={hint}
                  onClick={() => showHint(!hint)}
                >
                  {hint ? 'Hide hint' : 'Show hint'}
                </button>
              </div>
              {hint && (
                <div className="hint-card-body">
                  <div className="hint-cue-row">
                    <Icon name="hand" />
                    <p className="hint-instruction-text">{getHandshapeHint(letterLabel)}</p>
                  </div>
                  {letter && <SignPhoto letter={letter} image={image} />}
                  {term && <LessonMedia name={letterLabel} file={term?.video} image={image} bundledVideo={term?.demo} />}
                </div>
              )}
            </div>

            {/* Camera Control Buttons & Privacy Note */}
            <div className="camera-controls paper">
              <div className="actions camera-actions-row">
                {state === 'on' || state === 'starting' ? (
                  <button type="button" className="button secondary btn-3d" onClick={() => { reset(); setState('off'); setStatus('Camera off.'); }}>
                    <Icon name="videoOff" /> Stop camera
                  </button>
                ) : (
                  <button type="button" className="button primary btn-3d" onClick={start}>
                    <Icon name="camera" /> {state === 'error' ? 'Try camera again' : 'Start camera'}
                  </button>
                )}
                {state === 'on' && (
                  <button type="button" className="button secondary btn-3d" aria-pressed={flipped} onClick={() => setFlipped(!flipped)}>
                    <Icon name="flip" /> {flipped ? 'Mirrored' : 'Mirror view'}
                  </button>
                )}
                {fallback}
              </div>
              <p className="small-copy camera-privacy-note centered">
                <Icon name="lock" /> Your camera stays on this device.
              </p>
            </div>
          </div>

          {/* Right Column (7 Columns) — Live Camera Stage */}
          <div className="camera-stage-right-col">
            <div className="camera-preview-card-header">
              <div className="stage-header-title">
                <Icon name="camera" />
                <span className="preview-label">Your Camera Preview</span>
              </div>
              <span className={`preview-status-badge ${state === 'on' ? (stable ? 'badge-matched' : 'badge-recognizing') : 'badge-off'}`}>
                <span className={`camera-dot ${state === 'on' ? 'dot-active' : 'dot-off'}`} />
                {state === 'on' ? (stable ? '✓ Sign Matched!' : 'Recognizing…') : 'Camera Off'}
              </span>
            </div>

            {/* 16:10 Dark Viewport */}
            <div className={`camera-stage-viewport ${stable ? 'viewport-matched' : ''}`} data-camera={state} data-match={stable || undefined}>
              <video ref={video} muted playsInline aria-label="Your camera preview" className={flipped ? 'mirrored' : ''} />
              {state === 'on' ? (
                <>
                  <div className={`camera-alignment-box ${stable ? 'matched' : ''}`}>
                    <div className="hand-guide-inner">
                      <Icon name="hand" />
                      <span>Align Hand Here</span>
                    </div>
                    {stable && <span className="right-sign-pill">Right Sign!</span>}
                  </div>
                  <div className="viewport-bottom-guidance">
                    <span>Bring your whole hand into view</span>
                  </div>
                </>
              ) : (
                <div className="camera-viewport-off-state">
                  <div className="off-emblem"><Icon name="videoOff" /></div>
                  <p className="off-message">Start the camera when you're ready.</p>
                  <button type="button" className="button primary in-stage-start-btn btn-3d" onClick={start}>
                    <Icon name="camera" /> Start camera
                  </button>
                </div>
              )}
            </div>

            {/* Stage Footer Strip */}
            <div className="camera-stage-bottom-strip">
              <div className="lighting-tip-item">
                <span>💡 Good lighting helps detection</span>
              </div>
              <span className="fsl-letter-tag">FSL Letter {letterLabel}</span>
            </div>
          </div>
        </div>

        {/* Bottom Step Navigation Bar (Full Width) */}
        <div className="stage-bottom-nav-bar paper">
          {lessonContext.previousUrl ? (
            <a className="button secondary btn-3d" href={lessonContext.previousUrl}>
              <Icon name="back" /> Previous step
            </a>
          ) : <span />}
          <button type="button" className="button primary btn-3d" onClick={lessonContext.onNext}>
            Next step <Icon name="arrow" />
          </button>
        </div>

        {/* Success Modal */}
        {showModal && targetName && (
          <SignSuccessModal
            signName={targetName}
            onNextSign={() => {
              setShowModal(false);
              reset();
              setState('off');
              match?.();
              lessonContext.onNext();
            }}
            onPracticeAgain={() => {
              setShowModal(false);
              setStable(false);
            }}
            onDismiss={() => setShowModal(false)}
          />
        )}
      </div>
    );
  }

  // 2. If in quiz context, render the balanced two-column Camera Quiz stage
  if (quizContext) {
    const letterLabel = targetName || 'A';

    return (
      <div className="camera-quiz-stage-wrapper">
        <div className="camera-stage-5-7-grid">
          {/* Left Column (5 Columns) — Sign Prompt, Hint & Controls */}
          <div className="camera-stage-left-col">
            <div className="target-sign-card paper">
              <div className="target-sign-header">
                <div className="camera-hint">
                  <span className="target-sign-eyebrow">Target Sign</span>
                  <h2>Sign {letterLabel}</h2>
                  <p className="prompt-text">
                    {state === 'on' ? 'Bring your whole hand into view.' : "Start the camera when you're ready."}
                  </p>
                </div>
                <div className="letter-tile-large">{letterLabel}</div>
              </div>
            </div>

            {/* Collapsible Hint Drawer */}
            <div className="collapsible-hint-card paper">
              <div className="hint-card-header">
                <div className="hint-title-group">
                  <span>💡</span>
                  <strong>Need a hint?</strong>
                </div>
                <button
                  type="button"
                  className="button secondary hint-toggle btn-3d"
                  aria-expanded={hint}
                  onClick={() => showHint(!hint)}
                >
                  {hint ? 'Hide hint' : 'Show hint'}
                </button>
              </div>
              {hint && (
                <div className="hint-card-body">
                  <div className="hint-cue-row">
                    <Icon name="hand" />
                    <p className="hint-instruction-text">{getHandshapeHint(letterLabel)}</p>
                  </div>
                  {letter && <SignPhoto letter={letter} image={image} />}
                  {term && <LessonMedia name={letterLabel} file={term?.video} image={image} bundledVideo={term?.demo} />}
                </div>
              )}
            </div>

            {/* Control & Alternate Input Action Bar */}
            <div className="camera-controls paper">
              <div className="actions camera-actions-row">
                {state === 'on' || state === 'starting' ? (
                  <button type="button" className="button secondary btn-3d" onClick={() => { reset(); setState('off'); setStatus('Camera off.'); }}>
                    <Icon name="videoOff" /> Stop camera
                  </button>
                ) : (
                  <button type="button" className="button primary btn-3d" onClick={start}>
                    <Icon name="camera" /> {state === 'error' ? 'Try camera again' : 'Start camera'}
                  </button>
                )}
                {quizContext.onUsePictures && (
                  <button type="button" className="button secondary btn-3d" onClick={quizContext.onUsePictures}>
                    <Icon name="book" /> {quizContext.usePicturesLabel || 'Use pictures'}
                  </button>
                )}
              </div>
              <p className="small-copy camera-privacy-note centered">
                <Icon name="lock" /> Your camera stays on this device.
              </p>
            </div>
          </div>

          {/* Right Column (7 Columns) — Interactive Camera Stage */}
          <div className="camera-stage-right-col">
            <div className="camera-preview-card-header">
              <div className="stage-header-title">
                <Icon name="camera" />
                <span className="preview-label">Your Camera Preview</span>
              </div>
              <span className={`preview-status-badge ${state === 'on' ? (stable ? 'badge-matched' : 'badge-recognizing') : 'badge-off'}`}>
                <span className={`camera-dot ${state === 'on' ? 'dot-active' : 'dot-off'}`} />
                {state === 'on' ? (stable ? '✓ Sign Matched!' : 'Recognizing…') : 'Camera Off'}
              </span>
            </div>

            {/* 16:10 Dark Viewport */}
            <div className={`camera-stage-viewport ${stable ? 'viewport-matched' : ''}`} data-camera={state} data-match={stable || undefined}>
              <video ref={video} muted playsInline aria-label="Your camera preview" className={flipped ? 'mirrored' : ''} />
              {state === 'on' ? (
                <>
                  <div className={`camera-alignment-box ${stable ? 'matched' : ''}`}>
                    <div className="hand-guide-inner">
                      <Icon name="hand" />
                      <span>Align Hand Here</span>
                    </div>
                    {stable && <span className="right-sign-pill">Right Sign!</span>}
                  </div>
                  <div className="viewport-bottom-guidance">
                    <span>Bring your whole hand into view</span>
                  </div>
                </>
              ) : (
                <div className="camera-viewport-off-state">
                  <div className="off-emblem"><Icon name="videoOff" /></div>
                  <p className="off-message">Start the camera when you're ready.</p>
                  <button type="button" className="button primary in-stage-start-btn btn-3d" onClick={start}>
                    <Icon name="camera" /> Start camera
                  </button>
                </div>
              )}
            </div>

            {/* Stage Footer Strip */}
            <div className="camera-stage-bottom-strip">
              <div className="lighting-tip-item">
                <span>💡 Good lighting helps detection</span>
              </div>
              <span className="fsl-letter-tag">FSL Letter {letterLabel}</span>
            </div>
          </div>
        </div>

        {/* Success Modal */}
        {showModal && targetName && (
          <SignSuccessModal
            signName={targetName}
            onNextSign={() => {
              setShowModal(false);
              reset();
              setState('off');
              match?.();
            }}
            onPracticeAgain={() => {
              setShowModal(false);
              setStable(false);
            }}
            onDismiss={() => setShowModal(false)}
          />
        )}
      </div>
    );
  }

  // 3. Standard standalone camera grid (used for free camera #camera, etc.)
  return (
    <div className={`camera-grid${targetName ? ' camera-lesson' : ''}${guided ? ' camera-guided' : ''}`}>
      <div className={`camera-view ${stable ? 'camera-view-matched' : ''}`} data-camera={state} data-match={stable || undefined}>
        <video ref={video} muted playsInline aria-label="Your camera preview" className={flipped ? 'mirrored' : ''} />
        {state === 'on' && <div className={`camera-frame ${stable ? 'frame-success' : ''}`} aria-hidden="true" />}
        {state !== 'on' && <div className="camera-message"><Icon name="camera" />{state === 'starting' ? 'Starting…' : 'Camera off'}</div>}
        {state === 'on' && (
          <span className={`camera-indicator ${stable ? 'matched' : ''}`}>
            {stable ? '✓ Sign Matched!' : 'Recognizing…'}
          </span>
        )}
        {state === 'on' && (
          <div className={`camera-alignment-box ${stable ? 'matched' : ''}`}>
            {stable && <span className="right-sign-pill">Right Sign!</span>}
          </div>
        )}
        {state === 'on' && stable && targetName && (
          <div className="camera-detection-banner">
            <span>Detected: {targetName}</span>
          </div>
        )}
      </div>
      <div className="camera-controls paper">
        {targetName && <div className="camera-hint">{hint && (letter ? <SignPhoto letter={letter} image={image} /> :
          <LessonMedia name={targetName} file={term?.video} image={image} bundledVideo={term?.demo} />)}<h2>Sign {targetName}</h2></div>}
        {targetName && <button className="button secondary hint-toggle btn-3d" aria-expanded={hint} onClick={() => showHint(!hint)}>{hint ? 'Hide hint' : 'Show hint'}</button>}
        <p role="status" className="camera-status" data-feedback={stable ? 'right' : undefined}>{stable && <Icon name="check" />}{status}</p>
        <div className="actions">
          {state === 'on' || state === 'starting'
            ? <button className="button secondary btn-3d" onClick={() => { reset(); setState('off'); setStatus('Camera off.'); }}><Icon name="videoOff" /> Stop camera</button>
            : <button className="button primary btn-3d" onClick={start}><Icon name="camera" /> {state === 'error' ? 'Try camera again' : 'Start camera'}</button>}
          {state === 'on' && <button className="button secondary btn-3d" aria-pressed={flipped} onClick={() => setFlipped(!flipped)}><Icon name="flip" /> Mirror view</button>}
          {stable && match && <button className="button primary btn-3d" onClick={() => { reset(); setState('off'); setStatus('Match saved.'); match(); }}>Save match</button>}
          {fallback}
        </div>
        <p className="small-copy">Your camera stays on this device.</p>
      </div>

      {showModal && targetName && (
        <SignSuccessModal
          signName={targetName}
          onNextSign={() => {
            setShowModal(false);
            reset();
            setState('off');
            match?.();
          }}
          onPracticeAgain={() => {
            setShowModal(false);
            setStable(false);
          }}
          onDismiss={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
