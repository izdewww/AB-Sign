import { useEffect, useRef, useState } from 'react';
import type { Letter } from './letters';

export function SignPhoto({ letter, image, prompt = false }: { letter: Letter; image?: File; prompt?: boolean }) {
  const [source, setSource] = useState<{ file: File; url: string }>();
  useEffect(() => {
    if (!image) return;
    const url = URL.createObjectURL(image);
    setSource({ file: image, url });
    return () => URL.revokeObjectURL(url);
  }, [image]);
  return <img src={source && source.file === image ? source.url : letter.photo} alt={prompt ? 'Picture of a hand sign' : letter.description} width="300" height="300" />;
}

export function LessonMedia({ letter, file, image }: { letter: Letter; file?: File; image?: File }) {
  const [source, setSource] = useState('');
  const [error, setError] = useState(false);
  const [slow, setSlow] = useState(false);
  const player = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setSource(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!file || error) return <div className="practice-photo">{error && <p role="status">This video can’t play. Use the picture instead.</p>}<SignPhoto letter={letter} image={image} /></div>;
  return (
    <div className="lesson-video">
      <video ref={player} src={source || undefined} controls preload="metadata" muted playsInline aria-label={`Video for letter ${letter.label}`} onError={() => setError(true)} />
      <div className="actions">
        <button className="button secondary" aria-pressed={slow} onClick={() => {
          if (player.current) player.current.playbackRate = slow ? 1 : .5;
          setSlow(!slow);
        }}>{slow ? 'Slow speed on' : 'Play slowly'}</button>
        <button className="button secondary" onClick={() => {
          const video = player.current;
          if (video) { video.currentTime = 0; void video.play().catch(() => setError(true)); }
        }}>Replay</button>
      </div>
    </div>
  );
}
