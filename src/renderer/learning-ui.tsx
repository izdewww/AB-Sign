import type { CSSProperties, ReactNode } from 'react';
import { Icon } from './icons';

export function StepProgress({ value, total, label }: { value: number; total: number; label: string }) {
  return <div className="step-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={value}>
    <span style={{ '--completion': total ? value / total : 0 } as CSSProperties} />
  </div>;
}

export function AnswerChoices<T extends string>({ options, value, correct, checked, choose, group = 'Choose a letter' }: {
  options: T[]; value?: T; correct?: T; checked?: boolean; choose: (label: T) => void; group?: string;
}) {
  return <div className="choices answer-cards" role="group" aria-label={group} data-count={options.length} data-words={group !== 'Choose a letter' || undefined}>{options.map((label) => {
    const selected = label === value;
    const state = checked && label === correct ? 'right' : selected ? checked ? 'retry' : 'selected' : undefined;
    return <button key={label} className="choice" disabled={checked} aria-pressed={selected} data-answer={state} onClick={() => choose(label)}>
      <span>{label}</span>{state === 'right' && <span className="answer-status"><Icon name="check" /> Correct</span>}
      {state === 'retry' && <span className="answer-status">Your choice</span>}
    </button>;
  })}</div>;
}

export function LessonFooter({ state, message, action, children }: {
  state?: 'right' | 'retry'; message?: string; action: ReactNode; children?: ReactNode;
}) {
  return <footer className="lesson-footer" data-feedback={state}>
    <div className="lesson-footer-note" role="status" aria-atomic="true">
      {state && <span className="feedback-icon"><Icon name={state === 'right' ? 'check' : 'retry'} /></span>}
      {message && <p>{message}</p>}
    </div>
    <div className="actions">{children}{action}</div>
  </footer>;
}

let audio: AudioContext | undefined;

export function answerSound(correct: boolean) {
  try {
    audio ??= new AudioContext();
    const context = audio;
    if (context.state === 'suspended') void context.resume().catch(() => {});
    const start = context.currentTime;
    (correct ? [392, 587] : [262]).forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const time = start + .075 * index;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.001, time);
      gain.gain.exponentialRampToValueAtTime(.09, time + .015);
      gain.gain.exponentialRampToValueAtTime(.001, time + .13);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(time);
      oscillator.stop(time + .14);
    });
  } catch {
    // Written feedback is always available.
  }
}
