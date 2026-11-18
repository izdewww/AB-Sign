import { useEffect, useState } from 'react';
import { Camera } from './camera';
import type { ClassroomStore } from './classroom';
import { Icon } from './icons';
import { LessonMedia } from './lesson-media';
import { LessonQuiz } from './lesson-quiz';
import { StepProgress } from './learning-ui';
import { cameraSupports, findLetter, isLabel, moves } from './letters';
import { lessonLetters, quizFor, type Step, type TeacherLibrary } from './lessons';

type LibraryView = { library: TeacherLibrary; store: ClassroomStore };

export function LearningPath({ library, store }: LibraryView) {
  return <section>
    <header className="page-heading"><h1>Learning path</h1><p>Choose any lesson to get started.</p></header>
    {library.status !== 'ready' ? <p role="status">{library.status === 'loading' ? 'Opening lessons…' : 'Could not open lessons. Restart the app to try again.'}</p> :
      library.visible.length ? <div className="library-grid">{library.visible.map((lesson, index) =>
        <a key={lesson.id} className="library-card paper" href={'#lesson/' + lesson.id}>
          <div className={'library-cover ' + ['mint', 'sky', 'peach', 'yellow'][index % 4]}>{lessonLetters(lesson).slice(0, 3).map((letter) => <span key={letter}>{letter}</span>)}</div>
          <div className="library-card-copy"><div><h2>{lesson.title}</h2><p>{store.data.completed.includes(lesson.id) ? 'Finished' : lesson.steps.length + (lesson.steps.length === 1 ? ' step' : ' steps')}</p></div><Icon name="arrow" /></div>
        </a>)}</div> :
        <div className="paper empty"><h2>No lessons yet</h2><a className="button primary" href="#builder/new">Create a lesson</a></div>}
  </section>;
}

export function DashboardStrip({ library, store }: LibraryView) {
  const resume = library.visible.find(({ id }) => store.data.resume.startsWith('lesson/' + id + '/'));
  return <section className="up-next path-card mint"><div><h2>{resume?.title ?? 'Pick a lesson'}</h2><p>{resume ? 'Pick up where you left off.' : 'Look at signs and practice at your own pace.'}</p></div>
    <a className="button primary" href={resume ? '#' + store.data.resume : '#path'}>{resume ? 'Continue lesson' : 'See lessons'} <Icon name="arrow" /></a>
  </section>;
}

export function LessonView({ id, action, position, library, store }: LibraryView & { id?: string; action?: string; position?: string }) {
  const lesson = library.visible.find((item) => item.id === id);
  const index = Number(position);
  const step = lesson && (action === 'demo' || action === 'practice') && Number.isInteger(index) && index >= 0 ? lesson.steps[index] : undefined;
  const quiz = lesson && quizFor(lesson);
  useEffect(() => {
    if (lesson && step) {
      const resume = 'lesson/' + lesson.id + '/demo/' + index;
      if (store.data.resume !== resume) store.update({ resume });
    }
  }, [lesson, step, index, store]);

  if (library.status === 'loading') return <p role="status">Opening lesson…</p>;
  if (!lesson) return <div className="paper empty"><h1>Lesson unavailable</h1><a className="button secondary" href="#path">See lessons</a></div>;

  if (action === 'quiz' && quiz) return <LessonQuiz lesson={lesson} plan={quiz} sound={store.data.sound} finish={(score, total, missed) => {
    const result = store.record({ activity: 'quiz', title: lesson.title, score, total, missed, lesson: lesson.id });
    location.hash = 'result/' + result;
  }} />;

  if (step) return <section className="learning-screen">
    <header className="lesson-heading"><a className="icon-link" href={'#lesson/' + lesson.id} aria-label="Back to lesson"><Icon name="back" /></a>
      <div className="lesson-heading-copy"><p>{lesson.title}</p><StepProgress value={index} total={lesson.steps.length} label="Steps finished" /></div>
      <span className="question-count">{index + 1} of {lesson.steps.length}</span>
    </header>
    <LessonStep step={step} previous={index > 0 ? '#lesson/' + lesson.id + '/demo/' + (index - 1) : undefined}
      action={index + 1 === lesson.steps.length ? 'Finish lesson' : 'Next step'} next={() => {
        if (index + 1 < lesson.steps.length) location.hash = 'lesson/' + lesson.id + '/demo/' + (index + 1);
        else { store.complete(lesson.id); location.hash = 'lesson/' + lesson.id + '/finished'; }
      }} />
  </section>;

  return <section>
    <a className="back-link" href="#path">Learning path</a>
    <div className="path-card mint">
      <div><h1>{action === 'finished' ? 'Lesson finished!' : lesson.title}</h1><p>{action === 'finished' ? lesson.title : lesson.steps.length + (lesson.steps.length === 1 ? ' step' : ' steps')}</p></div>
      <div className="actions">
        {action === 'finished' ? <a className="button primary" href="#path">Choose a lesson</a> :
          <a className="button primary" href={'#lesson/' + lesson.id + '/demo/0'}>Start lesson <Icon name="arrow" /></a>}
        {quiz && <a className="button secondary" href={'#lesson/' + lesson.id + '/quiz'}>Take quiz</a>}
      </div>
    </div>
    {action !== 'finished' && <ul className="lesson-list paper section-actions">{lesson.steps.map((item, stepIndex) => <li key={item.id}>
      <h2>{stepTitle(item)}</h2><a className="text-link" aria-label={'Open step ' + (stepIndex + 1)} href={'#lesson/' + lesson.id + '/demo/' + stepIndex}>Open <Icon name="arrow" /></a>
    </li>)}</ul>}
  </section>;
}

export function stepTitle(step: Step) {
  if (step.kind === 'spell') return step.word ? 'Spell ' + step.word : 'Spelling step';
  if (!step.letter) return 'New sign';
  if (step.kind === 'camera' && cameraSupports(step.letter)) return 'Sign ' + step.letter;
  return (step.video ? 'Watch ' : 'Look at ') + step.letter;
}

export function LessonStep({ step, next, previous, action = 'Next step' }: { step: Step; next: () => void; previous?: string; action?: string }) {
  const [typed, setTyped] = useState('');
  const [picture, setPicture] = useState(false);
  const sign = 'letter' in step && isLabel(step.letter) ? findLetter(step.letter) : undefined;
  const camera = step.kind === 'camera' && sign && cameraSupports(sign.label) && !picture;
  return <div>
    <div className="page-heading"><h1>{stepTitle(step)}</h1></div>
    {step.kind === 'spell' ? <div className="paper empty">
      <label className="simple-form">Type the letters in order<input spellCheck={false} value={typed} maxLength={step.word.length} onChange={(event) => setTyped(event.target.value.toUpperCase())} /></label>
    </div> : sign && (camera ?
      <Camera target={sign.label} image={step.image} match={() => setPicture(true)} fallback={<button className="button secondary" onClick={() => setPicture(true)}>Use picture</button>} /> :
      <div className={'study-stage paper ' + sign.tone}>
        <LessonMedia letter={sign} image={step.image} file={step.video} />
        {moves(sign.label) && !step.video && <p>{sign.label} is a moving sign. This picture shows one moment.</p>}
      </div>)}
    <div className="actions section-actions">
      {previous && <a className="button secondary" href={previous}>Previous step</a>}
      <button className="button primary" disabled={step.kind === 'spell' && typed !== step.word} onClick={next}>{action} <Icon name="arrow" /></button>
    </div>
  </div>;
}

export function Results({ id, store, library }: LibraryView & { id?: string }) {
  const result = store.data.attempts.find((attempt) => attempt.id === id);
  const lesson = library.visible.find((item) => item.id === result?.lesson && quizFor(item));
  return <section className="paper result">
    <div className="activity-mark"><Icon name="trophy" /></div>
    <h1>{result ? 'Round finished!' : 'Result unavailable'}</h1>
    {result && <><p className="score">{result.score} of {result.total} correct</p>
      {result.missed.length > 0 && <p>Practice again: {[...new Set(result.missed)].join(', ')}</p>}</>}
    <div className="actions centered">
      <a className="button primary" href={lesson ? '#lesson/' + lesson.id : '#path'}>{lesson ? 'Back to lesson' : 'See lessons'}</a>
      {lesson && <a className="button secondary" href={'#lesson/' + lesson.id + '/quiz'}>Play again</a>}
    </div>
  </section>;
}
