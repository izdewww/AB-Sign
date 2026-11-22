import { useEffect, useRef, useState } from 'react';
import { Camera } from './camera';
import { Icon } from './icons';
import { AnswerChoices, answerSound, LessonFooter, StepProgress } from './learning-ui';
import { LessonMedia, SignPhoto } from './lesson-media';
import { cameraSupports, findLetter, isLabel } from './letters';
import { categoryFor, lessonTerms, signImage, termCamera, termMedia, type Lesson } from './lessons';
import { makeQuiz, type QuizPlan } from './quiz';
import { vocabularyVideo } from './vocabulary';

export function LessonQuiz({ lesson, plan, sound, finish }: {
  lesson: Lesson;
  plan: QuizPlan<string>;
  sound: boolean;
  finish: (score: number, total: number, missed: string[]) => void;
}) {
  const [questions] = useState(() => makeQuiz(plan, lessonTerms(lesson)));
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<string>();
  const [confirmed, setConfirmed] = useState<'right' | 'retry'>();
  const [picture, setPicture] = useState(false);
  const [misses, setMisses] = useState<string[]>([]);
  const done = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const keyboardChoice = useRef(false);
  const question = questions[index];
  const alphabet = categoryFor(lesson.category).id === 'alphabet';
  const sign = alphabet && isLabel(question.letter) ? findLetter(question.letter) : undefined;
  const media = !alphabet ? termMedia(lesson, question.letter) : undefined;
  const image = sign ? signImage(lesson, sign.label) : media?.image;
  const target = question.kind === 'camera' && !picture && alphabet && cameraSupports(question.letter) ? question.letter : undefined;
  const wordId = question.kind === 'camera' && !picture ? termCamera(media) : undefined;
  const demo = image ? undefined : vocabularyVideo(media?.example);
  const term = wordId && media ? { id: wordId, name: media.term, demo, video: media.video } : undefined;
  const useCamera = Boolean(target || term);
  const feedback = confirmed === 'right'
    ? `That’s right! This is ${question.letter}.`
    : confirmed === 'retry'
      ? `This sign is ${question.letter}.`
      : useCamera ? 'Try it on camera, or play a matching question.' : alphabet ? 'Choose the matching letter.' : 'Choose what the sign means.';

  useEffect(() => { if (confirmed) nextButton.current?.focus(); else heading.current?.focus(); }, [index, confirmed]);
  useEffect(() => {
    if (choice && keyboardChoice.current) { keyboardChoice.current = false; nextButton.current?.focus(); }
  }, [choice]);
  useEffect(() => {
    const select = (event: KeyboardEvent) => {
      if (useCamera || confirmed || event.repeat || event.metaKey || event.ctrlKey || event.altKey || !/^[1-3]$/.test(event.key)) return;
      const value = question.choices[Number(event.key) - 1];
      if (!value) return;
      if (value === choice) nextButton.current?.focus();
      else { keyboardChoice.current = true; setChoice(value); }
    };
    window.addEventListener('keydown', select);
    return () => window.removeEventListener('keydown', select);
  }, [choice, confirmed, question, useCamera]);

  const mark = (right: boolean) => {
    setConfirmed(right ? 'right' : 'retry');
    if (sound) answerSound(right);
  };

  const next = () => {
    if (done.current || !confirmed) return;
    const missed = confirmed === 'retry' ? [...misses, question.letter] : misses;
    if (index + 1 === questions.length) {
      done.current = true;
      finish(questions.length - missed.length, questions.length, missed);
      return;
    }
    setMisses(missed);
    setChoice(undefined);
    setConfirmed(undefined);
    setPicture(false);
    setIndex(index + 1);
  };

  return (
    <section className="match-screen learning-screen" aria-labelledby="quiz-title" data-question-kind={question.kind}>
      <header className="lesson-heading">
        <a className="icon-link" href={`#lesson/${lesson.id}`} aria-label="Back to lesson"><Icon name="back" /></a>
        <div className="lesson-heading-copy"><h1 id="quiz-title" ref={heading} tabIndex={-1}>{lesson.title} quiz</h1><StepProgress value={index} total={questions.length} label="Questions finished" /></div>
        <span className="question-count">{index + 1} of {questions.length}</span>
      </header>
      {useCamera ? (
        confirmed ? <div className="study-stage paper"><LessonMedia letter={sign} name={media?.term} image={image} file={media?.video} bundledVideo={demo} /></div> :
          <Camera
            key={index}
            target={target}
            term={term}
            image={image}
            match={() => mark(true)}
            quizContext={{
              onUsePictures: () => setPicture(true),
              usePicturesLabel: alphabet ? 'Use pictures' : 'Use matching',
              questionNumber: index + 1,
              totalQuestions: questions.length,
              onSkip: () => setPicture(true),
            }}
            fallback={<button className="button secondary btn-3d" onClick={() => setPicture(true)}>{alphabet ? 'Use pictures' : 'Use matching'}</button>}
          />
      ) : (
        <div className="practice-grid match-grid">
          <div className="practice-photo sign-stage" key={index}>{image || sign ? <SignPhoto letter={sign} image={image} prompt /> : <LessonMedia file={media?.video} bundledVideo={demo} prompt />}</div>
          <div className="practice-controls answer-side"><h2>{alphabet ? 'Which letter is this?' : 'What does this sign mean?'}</h2>
            <AnswerChoices options={question.choices} value={choice} correct={question.letter} checked={Boolean(confirmed)} choose={setChoice} group={alphabet ? undefined : 'Choose what the sign means'} />
            <p className="small-copy">Select a card, then check your answer.</p>
          </div>
        </div>
      )}
      <LessonFooter state={confirmed} message={feedback} action={
        confirmed ? <button ref={nextButton} className="button primary btn-3d" onClick={next}>{index + 1 === questions.length ? 'See my result' : 'Next question'} <Icon name="arrow" /></button>
          : useCamera ? <button className="button secondary btn-3d" onClick={() => mark(false)}>Skip question</button>
          : <button ref={nextButton} className="button primary btn-3d" disabled={!choice} onClick={() => mark(choice === question.letter)}>Check answer <Icon name="check" /></button>
      } />
    </section>
  );
}
