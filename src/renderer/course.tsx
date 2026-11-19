import { useEffect, useState, type CSSProperties } from 'react';
import { Camera } from './camera';
import type { ClassroomStore } from './classroom';
import { Fingerspelling } from './fingerspelling';
import { Icon } from './icons';
import { LessonMedia } from './lesson-media';
import { LessonQuiz } from './lesson-quiz';
import { StepProgress } from './learning-ui';
import { cameraSupports, findLetter, isLabel, moves } from './letters';
import { categories, categoryFor, quizFor, termCamera, type Lesson, type Step, type TeacherLibrary } from './lessons';
import { vocabularyVideo } from './vocabulary';

type LibraryView = { library: TeacherLibrary; store: ClassroomStore };

export function LearningPath({ library, store }: LibraryView) {
  return <section>
    <header className="page-heading"><h1>Learning path</h1><p>Choose a category and find a lesson.</p></header>
    {library.status !== 'ready' && <p role="status">{library.status === 'loading' ? 'Opening lessons…' : 'Could not open lessons. Restart the app to try again.'}</p>}
    <div className="library-grid category-grid">{categories.map((category) => {
      const lessons = library.visible.filter((lesson) => categoryFor(lesson.category).id === category.id);
      const finished = lessons.filter((lesson) => store.data.completed.includes(lesson.id)).length;
      return <a key={category.id} data-category={category.id} className="library-card paper" href={'#category/' + category.id}>
        <div className={'category-cover ' + category.tone}><span aria-hidden="true">{category.mark}</span>
          {store.data.badges.includes(category.id) && <Icon name="trophy" />}</div>
        <div className="category-card-copy"><h2>{category.title}</h2><p>{category.detail}</p>
          {lessons.length > 0 && <StepProgress value={finished} total={lessons.length} label={category.title + ' progress'} />}
          <span className="text-link">{lessons.length ? `${finished} of ${lessons.length} finished` : 'No lessons yet'} <Icon name="arrow" /></span>
        </div>
      </a>;
    })}</div>
  </section>;
}

export function CategoryView({ id, library, store, teacher }: LibraryView & { id?: string; teacher: boolean }) {
  const category = categoryFor(id);
  const lessons = library.visible.filter((lesson) => categoryFor(lesson.category).id === category.id);
  const finished = lessons.filter((lesson) => store.data.completed.includes(lesson.id)).length;
  return <section>
    <a className="back-link" href="#path">Learning path</a>
    <header className={'category-heading path-card ' + category.tone}><div><h1>{category.title}</h1><p>{category.detail}</p>
      {lessons.length > 0 && <p>{finished} of {lessons.length} lessons finished</p>}</div>
      <span className="category-mark" aria-hidden="true">{category.mark}</span></header>
    <h2 className="section-actions">Lessons</h2>
    {library.status !== 'ready' ? <p role="status">{library.status === 'loading' ? 'Opening lessons…' : 'Could not open lessons. Restart the app to try again.'}</p> :
      lessons.length ? <div className="library-grid section-actions">{lessons.map((lesson, index) => {
        const cover = [...new Set(lesson.steps.flatMap((step) => {
          if ('letter' in step && isLabel(step.letter)) return [step.letter];
          return category.id === 'numbers' && step.kind === 'media' && /^\d+$/.test(step.term) ? [step.term] : [];
        }))].slice(0, 3);
        return <a key={lesson.id} className="library-card paper" href={'#lesson/' + lesson.id}>
          <div className={'library-cover ' + ['mint', 'sky', 'peach', 'yellow'][index % 4]}>{cover.length > 0
            ? cover.map((letter) => <span key={letter}>{letter}</span>) : <span><Icon name="book" /></span>}</div>
          <div className="library-card-copy"><div><h2>{lesson.title}</h2><p>{store.data.completed.includes(lesson.id) ? 'Finished' : lesson.steps.length + (lesson.steps.length === 1 ? ' step' : ' steps')}</p></div><Icon name="arrow" /></div>
        </a>;
      })}</div> :
        <div className="paper empty section-actions"><h2>No lessons here yet</h2>{!teacher && <a className="button secondary" href="#path">Choose a category</a>}</div>}
    {teacher && <a className="button primary section-actions" href={'#builder/new/' + category.id}>Create a lesson</a>}
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
  const category = categoryFor(lesson?.category);
  const index = Number(position);
  const step = lesson && (action === 'demo' || action === 'practice') && Number.isInteger(index) && index >= 0 ? lesson.steps[index] : undefined;
  const quiz = lesson && quizFor(lesson);
  const celebrated = action === 'finished' && Boolean(lesson && store.data.completed.includes(lesson.id));
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
    <LessonStep key={step.id} step={step} lesson={lesson} previous={index > 0 ? '#lesson/' + lesson.id + '/demo/' + (index - 1) : undefined}
      action={index + 1 === lesson.steps.length ? 'Finish lesson' : 'Next step'} next={() => {
        if (index + 1 < lesson.steps.length) location.hash = 'lesson/' + lesson.id + '/demo/' + (index + 1);
        else {
          const categoryDone = library.visible.filter((value) => categoryFor(value.category).id === category.id)
            .every((value) => value.id === lesson.id || store.data.completed.includes(value.id));
          const categoryEarned = categoryDone && !store.data.badges.includes(category.id);
          store.complete(lesson.id, categoryEarned ? category.id : undefined);
          location.hash = 'lesson/' + lesson.id + (categoryEarned ? '/finished/category' : '/finished');
        }
      }} />
  </section>;

  return <section>
    <a className="back-link" href={'#category/' + category.id}>{category.title}</a>
    <div className={'path-card mint' + (celebrated ? ' celebrate-card' : '')}>
      {celebrated && <Confetti />}
      <div><h1>{celebrated ? 'Lesson finished!' : lesson.title}</h1><p>{celebrated ? lesson.title : lesson.steps.length + (lesson.steps.length === 1 ? ' step' : ' steps')}</p>
        {celebrated && <div className="badge-list"><span><Icon name="trophy" /> Lesson badge</span>
          {position === 'category' && store.data.badges.includes(category.id) && <span><Icon name="trophy" /> {category.title} badge</span>}</div>}</div>
      <div className="actions">
        {celebrated ? <a className="button primary" href={'#category/' + category.id}>Choose a lesson</a> :
          <a className="button primary" href={'#lesson/' + lesson.id + '/demo/0'}>Start lesson <Icon name="arrow" /></a>}
        {quiz && <a className="button secondary" href={'#lesson/' + lesson.id + '/quiz'}>Take quiz</a>}
      </div>
    </div>
    {!celebrated && <><h2 className="section-actions">In this lesson</h2><ul className="lesson-list paper section-actions">{lesson.steps.map((item, stepIndex) => <li key={item.id}>
      <h2>{stepTitle(item)}</h2><a className="text-link" aria-label={'Open step ' + (stepIndex + 1)} href={'#lesson/' + lesson.id + '/demo/' + stepIndex}>Open <Icon name="arrow" /></a>
    </li>)}</ul></>}
  </section>;
}

function Confetti() {
  return <div className="confetti" aria-hidden="true">{Array.from({ length: 20 }, (_, index) => <span key={index}
    style={{ '--left': `${(index * 37) % 97}%`, '--delay': `${index % 7 * 45}ms`, '--spin': `${(index % 2 ? -1 : 1) * (280 + index * 13)}deg` } as CSSProperties} />)}</div>;
}

export function stepTitle(step: Step, showWord = false) {
  if (step.kind === 'spell') return showWord && step.word ? 'Read signs for ' + step.word : 'Read the signs';
  if (step.kind === 'media') return step.term.trim() || 'New sign';
  if (!step.letter) return 'New sign';
  if (step.kind === 'camera' && cameraSupports(step.letter)) return 'Sign ' + step.letter;
  return (step.video ? 'Watch ' : 'Look at ') + step.letter;
}

export function LessonStep({ step, lesson, next, previous, action = 'Next step' }: { step: Step; lesson?: Lesson; next: () => void; previous?: string; action?: string }) {
  const [practice, setPractice] = useState(step.kind === 'camera');
  if (step.kind === 'spell') return <Fingerspelling key={step.id} word={step.word} lesson={lesson} next={next} previous={previous} action={action} />;
  if (step.kind === 'media') {
    const id = termCamera(step);
    const demo = step.image ? undefined : vocabularyVideo(step.example);
    return <div><div className="page-heading"><h1>{stepTitle(step)}</h1><p>Look at the sign and try it yourself.</p></div>
    {practice && id ? <Camera term={{ id, name: step.term, demo, video: step.video }} image={step.image} match={() => setPractice(false)}
      fallback={<button className="button secondary" onClick={() => setPractice(false)}>Back to demonstration</button>} /> :
      <div className="study-stage paper sky"><LessonMedia name={step.term} image={step.image} file={step.video} bundledVideo={demo} /></div>}
    <div className="actions section-actions">{previous && <a className="button secondary" href={previous}>Previous step</a>}
      {id && !practice && <button className="button secondary" onClick={() => setPractice(true)}>Try this sign</button>}
      <button className="button primary" onClick={next}>{action} <Icon name="arrow" /></button></div></div>;
  }
  const sign = 'letter' in step && isLabel(step.letter) ? findLetter(step.letter) : undefined;
  const camera = sign && cameraSupports(sign.label) && practice;
  return <div>
    <div className="page-heading"><h1>{stepTitle(step)}</h1></div>
    {sign && (camera ?
      <Camera target={sign.label} image={step.image} match={() => setPractice(false)} fallback={<button className="button secondary" onClick={() => setPractice(false)}>Back to demonstration</button>} /> :
      <div className={'study-stage paper ' + sign.tone}>
        <LessonMedia letter={sign} image={step.image} file={step.video} />
        {moves(sign.label) && !step.video && <p>{sign.label} is a moving sign. This picture shows one moment.</p>}
      </div>)}
    <div className="actions section-actions">
      {previous && <a className="button secondary" href={previous}>Previous step</a>}
      {sign && !camera && cameraSupports(sign.label) && <button className="button secondary" onClick={() => setPractice(true)}>Try this sign</button>}
      <button className="button primary" onClick={next}>{action} <Icon name="arrow" /></button>
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
