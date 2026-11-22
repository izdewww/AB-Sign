import { useEffect, useRef, useState } from 'react';
import benchmark from '../../model-training/artifacts/fsl-numbers-v3-benchmark.json';
import type { AccountState, ChallengeMode } from '../main/account-types.cjs';
import type { AccountAction } from './accounts-ui';
import { Camera } from './camera';
import { Icon } from './icons';
import { StepProgress } from './learning-ui';
import { cameraSupports, labels, type Label } from './letters';
import { shuffle } from './quiz';
import { vocabulary } from './vocabulary';

type Sign = { label: Label } | { id: string; name: string };
const modes = { letters: 'Letters only', mixed: 'Letters + numbers' } as const;
const roundSize = 20;
const letterSigns = labels.filter(cameraSupports).map((label) => ({ label }));
const trustedIds = new Set(Object.entries(benchmark.fsl105).filter(([, result]) => result.camera).map(([id]) => id));
const numberSigns = vocabulary.filter(({ category }) => category === 'numbers').flatMap(({ terms }) => terms)
  .flatMap(({ id, term, camera }) => id && camera && trustedIds.has(id) ? [{ id, name: term }] : []);

export function Challenge({ data, studentId, act }: { data: NonNullable<AccountState['challenge']>; studentId: string; act: AccountAction }) {
  const [mode, setMode] = useState<ChallengeMode>('letters');
  const [signs, setSigns] = useState<Sign[]>([]);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [save, setSave] = useState<'saving' | 'saved' | 'failed'>('saving');
  const heading = useRef<HTMLHeadingElement>(null);
  const sign = signs[answers.length];
  const finished = signs.length > 0 && answers.length === signs.length;
  const score = answers.filter(Boolean).length;
  const leaderboard = data.leaderboard[mode];
  const personal = data.scores[mode];
  const phase = sign ? 'round' : finished ? 'result' : 'lobby';
  useEffect(() => { heading.current?.focus(); }, [phase]);

  function start() {
    setSave('saving');
    setAnswers([]);
    setSigns(mode === 'letters' ? shuffle(letterSigns).slice(0, roundSize)
      : shuffle([...shuffle(letterSigns).slice(0, roundSize - 4), ...shuffle(numberSigns).slice(0, 4)]));
  }

  async function saveScore(value: number) {
    setSave('saving');
    try {
      await act({ action: 'save-challenge', mode, score: value });
      setSave('saved');
    } catch {
      setSave('failed');
    }
  }

  function answer(correct: boolean) {
    const next = [...answers, correct];
    setAnswers(next);
    if (next.length === signs.length) void saveScore(score + Number(correct));
  }

  if (sign) return <section className="challenge-page">
    <a className="back-link" href="#challenge" onClick={(event) => { event.preventDefault(); setSigns([]); setAnswers([]); }}>Leave round</a>
    <header className="page-heading challenge-round-heading">
      <h1 ref={heading} tabIndex={-1}>Camera challenge</h1>
      <p className="question-count" aria-live="polite">Sign {answers.length + 1} of {signs.length}</p>
      <StepProgress label="Signs attempted" value={answers.length} total={signs.length} />
    </header>
    <Camera challenge target={'label' in sign ? sign.label : undefined} term={'id' in sign ? sign : undefined}
      match={() => answer(true)} fallback={<button className="button secondary" onClick={() => answer(false)}>Skip sign</button>} />
  </section>;

  return <section className="challenge-page">
    {finished ? <header className="challenge-hero mint">
      <span className="challenge-mark"><Icon name="trophy" /></span>
      <div><h1 ref={heading} tabIndex={-1}>Challenge finished!</h1><p className="challenge-score">{score} of {signs.length} signs matched</p>
        <p role="status">{save === 'saved' ? 'Score saved.' : save === 'saving' ? 'Saving your score…' : 'Your score could not be saved.'}</p></div>
      <div className="actions">{save === 'failed' && <button className="button primary" onClick={() => void saveScore(score)}>Save again</button>}
        {save === 'saved' && <button className="button primary" onClick={start}>Play again</button>}
        {save !== 'saving' && <button className="button secondary" onClick={() => { setSigns([]); setAnswers([]); }}>Choose a round</button>}
      </div>
    </header> : <header className="challenge-hero">
      <span className="challenge-mark"><Icon name="camera" /></span>
      <div><h1 ref={heading} tabIndex={-1}>Do you know your A-B Signs?</h1><p>Try 20 surprise signs with your camera.</p></div>
    </header>}

    <div className="challenge-lobby section-actions">
      {!finished && <section className="challenge-panel paper">
        <h2>Choose a round</h2>
        <div className="actions challenge-modes" role="group" aria-label="Challenge type">
          {(Object.keys(modes) as ChallengeMode[]).map((key) => <button key={key} className="button secondary"
            aria-pressed={mode === key} onClick={() => setMode(key)}>{modes[key]}</button>)}
        </div>
        <p>{mode === 'letters' ? '20 letters' : '16 letters and 4 numbers'} · Go at your own pace.</p>
        <button className="button primary" onClick={start}>Start challenge <Icon name="arrow" /></button>
      </section>}
      <section className="challenge-panel paper" aria-label="Leaderboard">
        <h2><Icon name="trophy" /> Leaderboard</h2>
        <p>{modes[mode]}{personal && ` · Your best ${personal.best}/${roundSize}`}</p>
        {personal && personal.latest !== personal.best && <p className="small-copy">Last round {personal.latest}/{roundSize}</p>}
        {leaderboard.length ? <ol className="challenge-ranks" aria-label={`${modes[mode]} rankings`}>
          {leaderboard.map(({ id, name, best }, index) => <li key={id} data-you={id === studentId || undefined}>
            <span className="challenge-rank">{index + 1}</span>
            <span>{name}{id === studentId && <small> You</small>}</span><strong>{best}/{roundSize}</strong>
          </li>)}
        </ol> : <p className="notice">Finish a round to earn a spot.</p>}
      </section>
    </div>
  </section>;
}
