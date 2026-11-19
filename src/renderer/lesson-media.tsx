import { useEffect, useRef, useState } from 'react';
import type { Letter } from './letters';

export function SignPhoto({ letter, image, prompt = false, name }: { letter?: Letter; image?: File; prompt?: boolean; name?: string }) {
  const [source, setSource] = useState<{ file: File; url: string }>();
  useEffect(() => {
    if (!image) return;
    const url = URL.createObjectURL(image);
    setSource({ file: image, url });
    return () => URL.revokeObjectURL(url);
  }, [image]);
  const url = source?.file === image ? source?.url ?? letter?.photo : letter?.photo;
  if (!url) return <p>{image ? 'Opening picture…' : 'No picture'}</p>;
  return <img src={url} alt={prompt ? 'Picture of a hand sign' : letter?.description ?? 'Sign for ' + name} width="300" height="300" />;
}

export function LessonMedia({ letter, file, image, name, prompt, bundledVideo }: {
  letter?: Letter; file?: File; image?: File; name?: string; prompt?: boolean; bundledVideo?: string;
}) {
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

  const videoSource = file ? source : bundledVideo;
  if ((!file && !bundledVideo) || error) return <div className="practice-photo">{error && <p role="status">This video can’t play on this device.</p>}<SignPhoto letter={letter} image={image} name={name} prompt={prompt} /></div>;
  return (
    <div className="lesson-video">
      <video ref={player} src={videoSource || undefined} controls preload="metadata" muted playsInline
        aria-label={prompt ? 'Video of a hand sign' : letter ? `Video for letter ${letter.label}` : 'Video for ' + name} onError={() => setError(true)} />
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
