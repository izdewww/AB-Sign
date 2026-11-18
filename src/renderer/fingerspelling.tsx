import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';
import { AnswerChoices, LessonFooter } from './learning-ui';
import { SignPhoto } from './lesson-media';
import { findLetter, isLabel, labels, type Label } from './letters';
import { signImage, type Lesson } from './lessons';
import { shuffle } from './quiz';

export function Fingerspelling({ word, lesson, next, previous, action }: {
  word: string; lesson?: Lesson; next: () => void; previous?: string; action: string;
}) {
  const [round] = useState(() => [...word].filter(isLabel).map((letter) => ({
    letter,
    choices: shuffle([letter, ...shuffle(labels.filter((label) => label !== letter)).slice(0, 2)]),
  })));
  const [position, setPosition] = useState(0);
  const [choice, setChoice] = useState<Label>();
  const [feedback, setFeedback] = useState<'right' | 'retry'>();
  const prompt = useRef<HTMLHeadingElement>(null);
  const question = round[position];

  useEffect(() => {
    if (position > 0) prompt.current?.focus();
  }, [position]);

  const advance = () => {
    if (!question) { next(); return; }
    if (feedback === 'right') {
      setPosition(position + 1);
      setFeedback(undefined);
      setChoice(undefined);
    } else if (choice) {
      setFeedback(choice === question.letter ? 'right' : 'retry');
    }
  };

  return <section className="fingerspelling" aria-labelledby="fingerspelling-title">
    <header className="page-heading spell-heading">
      <h1 id="fingerspelling-title">Read the signs</h1>
      {question && <div className="spell-word" role="group" aria-label={`${position} of ${round.length} letters found`}>
        {round.map(({ letter }, index) => <span key={index} className={index < position ? 'mint' : undefined}
          data-current={index === position || undefined}>{index < position ? letter : ''}</span>)}
      </div>}
    </header>
    {question ?
      <div className="practice-grid match-grid">
        <div className="practice-photo sign-stage" key={position}>
          <SignPhoto letter={findLetter(question.letter)} image={lesson && signImage(lesson, question.letter)} prompt />
        </div>
        <div className="practice-controls answer-side">
          <p className="spell-position">Sign {position + 1} of {round.length}</p>
          <h2 ref={prompt} tabIndex={-1}>Which letter is this?</h2>
          <AnswerChoices options={question.choices} value={choice} correct={question.letter} checked={feedback === 'right'}
            choose={(letter) => { setChoice(letter); setFeedback(undefined); }} />
        </div>
      </div>
    : <div className="paper empty">
      <h2 ref={prompt} tabIndex={-1}>{round.length ? 'You read the word!' : 'No signs in this step'}</h2>
      {round.length > 0 && <p className="spell-result">{round.map(({ letter }) => letter).join('')}</p>}
    </div>}
    <LessonFooter state={feedback} message={feedback === 'right' ? 'That’s right!' : feedback === 'retry' ? 'Try again. Look at the hand shape.' : undefined}
      action={<button className="button primary" disabled={Boolean(question && !choice)} onClick={advance}>
        {!question ? action : feedback !== 'right' ? 'Check answer' : position + 1 === round.length ? 'See the word' : 'Next sign'} <Icon name="arrow" />
      </button>}>
      {previous && <a className="button secondary" href={previous}>Previous step</a>}
    </LessonFooter>
  </section>;
}
