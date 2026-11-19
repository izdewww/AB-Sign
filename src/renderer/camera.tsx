import { useEffect, useRef, useState, type ReactNode } from 'react';
import { letters } from './letters';
import type { Label } from './classroom';
import type { CameraReport } from './recognize.worker';
import type { WordCameraReport } from './vocabulary.worker';
import { Icon } from './icons';
import { LessonMedia, SignPhoto } from './lesson-media';

type Run = { stream?: MediaStream; worker?: Worker; loop?: number; startup?: number };

function release(run: Run | undefined) {
  if (!run) return;
  clearInterval(run.loop);
  clearTimeout(run.startup);
  run.worker?.terminate();
  run.stream?.getTracks().forEach((track) => track.stop());
}

export function Camera({ target, term, match, guided = false, fallback, image }: {
  target?: Label; term?: { id: string; name: string; demo?: string; video?: File };
  match?: () => void; guided?: boolean; fallback?: ReactNode; image?: File;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const current = useRef<Run>(undefined);
  const [state, setState] = useState<'off' | 'starting' | 'on' | 'error'>('off');
  const [status, setStatus] = useState('Start the camera when you’re ready.');
  const [flipped, setFlipped] = useState(true);
  const [stable, setStable] = useState(false);
  const [hint, showHint] = useState(guided);
  const letter = letters.find(({ label }) => label === target);
  const targetName = term?.name ?? target;

  const reset = () => {
    release(current.current);
    current.current = undefined;
    if (video.current) video.current.srcObject = null;
    setStable(false);
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

  return (
    <div className={`camera-grid${targetName ? ' camera-lesson' : ''}${guided ? ' camera-guided' : ''}`}>
      <div className="camera-view" data-camera={state} data-match={stable || undefined}>
        <video ref={video} muted playsInline aria-label="Your camera preview" className={flipped ? 'mirrored' : ''} />
        {state === 'on' && <div className="camera-frame" aria-hidden="true" />}
        {state !== 'on' && <div className="camera-message"><Icon name="camera" />{state === 'starting' ? 'Starting…' : 'Camera off'}</div>}
        {state === 'on' && <span className="camera-indicator">Camera on</span>}
      </div>
      <div className="camera-controls paper">
        {targetName && <div className="camera-hint">{hint && (letter ? <SignPhoto letter={letter} image={image} /> :
          <LessonMedia name={targetName} file={term?.video} image={image} bundledVideo={term?.demo} />)}<h2>Sign {targetName}</h2></div>}
        {targetName && <button className="button secondary hint-toggle" aria-expanded={hint} onClick={() => showHint(!hint)}>{hint ? 'Hide hint' : 'Show hint'}</button>}
        <p role="status" className="camera-status" data-feedback={stable ? 'right' : undefined}>{stable && <Icon name="check" />}{status}</p>
        <div className="actions">
          {state === 'on' || state === 'starting'
            ? <button className="button secondary" onClick={() => { reset(); setState('off'); setStatus('Camera off.'); }}>Stop camera</button>
            : <button className="button primary" onClick={start}>{state === 'error' ? 'Try camera again' : 'Start camera'}</button>}
          {state === 'on' && <button className="button secondary" aria-pressed={flipped} onClick={() => setFlipped(!flipped)}>Mirror view</button>}
          {stable && match && <button className="button primary" onClick={() => { reset(); setState('off'); setStatus('Match saved.'); match(); }}>Save match</button>}
          {fallback}
        </div>
        <p className="small-copy">Your camera stays on this device.</p>
      </div>
    </div>
  );
}
