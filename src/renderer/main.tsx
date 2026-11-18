import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/fredoka';
import '@fontsource/varela-round/latin-400.css';
import logo from '../../docs/images/logo.jpg';
import { Icon } from './icons';
import { Builder } from './builder';
import { Camera } from './camera';
import { streak, useClassroom, type ClassroomStore } from './classroom';
import { DashboardStrip, LearningPath, LessonView, Results } from './course';
import { StepProgress } from './learning-ui';
import { cameraSupports, findLetter, labels } from './letters';
import { quizFor, useTeacherLessons, type TeacherLibrary } from './lessons';
import './style.css';

import { Welcome } from './onboarding';

const pages = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'path', label: 'Learn', icon: 'book' },
  { key: 'activities', label: 'Play', icon: 'match' },
  { key: 'progress', label: 'Progress', icon: 'chart' },
  { key: 'teachers', label: 'For teachers', icon: 'teach' },
] as const;

function getPage() {
  return window.location.hash.slice(1).split('/', 4);
}

function Home({ library, store }: { library: TeacherLibrary; store: ClassroomStore }) {
  return <div className="dashboard">
    <section className="dashboard-welcome paper">
      <img src={logo} width="76" height="76" alt="" />
      <div><h1>Ready to sign?</h1><p>Practice Filipino Sign Language.</p></div>
    </section>
    <DashboardStrip library={library} store={store} />
    <div className="dashboard-grid">
      <section className="game paper"><div className="activity-mark"><Icon name="match" /></div><h2>Play &amp; practice</h2>
        <p>Play a lesson quiz or try the camera.</p><a className="button secondary" href="#activities">Find a quiz <Icon name="arrow" /></a></section>
      <section className="game paper"><div className="activity-mark"><Icon name="teach" /></div><h2>Make a lesson</h2>
        <p>Add signs, pictures, videos, and a short quiz.</p><a className="button secondary" href="#teachers">Open lesson builder <Icon name="arrow" /></a></section>
    </div>
  </div>;
}

function PracticeHub({ library }: { library: TeacherLibrary }) {
  const quizzes = library.visible.filter(quizFor);
  return <section>
    <header className="page-heading activities-heading"><div className="activity-mark"><Icon name="match" /></div><div><h1>Play &amp; practice</h1><p>Pick a quiz from your lessons.</p></div></header>
    {quizzes.length > 0 ? <ul className="lesson-list paper">{quizzes.map((lesson) => <li key={lesson.id}>
      <h2>{lesson.title}</h2><a className="button secondary" href={'#lesson/' + lesson.id + '/quiz'} aria-label={'Play ' + lesson.title + ' quiz'}>Play quiz</a>
    </li>)}</ul> : <div className="paper empty"><p>{library.status === 'loading' ? 'Opening quizzes…' : library.status === 'error' ? 'Could not open quizzes.' : 'Lesson quizzes will show up here.'}</p></div>}
    <section className="path-card sky"><div><h2>Try the camera</h2><p>Choose a letter to practice.</p></div><a className="button secondary" href="#camera">Camera practice</a></section>
  </section>;
}

function CameraPractice({ id, store }: { id?: string; store: ClassroomStore }) {
  const target = cameraSupports(id) ? id : undefined;
  return <section>
    <a className="back-link" href="#activities">Play &amp; practice</a>
    <header className="page-heading"><h1>Camera practice</h1><p>Choose a letter to try.</p></header>
    <div className="letter-picker camera-letter-picker" aria-label="Letters">{labels.filter(cameraSupports).map((label) =>
      <a className={'letter-chip ' + findLetter(label).tone} aria-current={label === target ? 'true' : undefined} key={label} href={'#camera/' + label}>{label}</a>)}</div>
    {target && <Camera key={target} target={target} fallback={<a className="button secondary" href="#activities">Use pictures</a>} match={() => {
      store.record({ activity: 'camera', title: 'Camera · ' + target, score: 1, total: 1, missed: [] });
    }} />}
  </section>;
}

function Progress({ store, library }: { store: ClassroomStore; library: TeacherLibrary }) {
  const [confirm, setConfirm] = useState(false);
  const completed = library.visible.filter(({ id }) => store.data.completed.includes(id)).length;
  const hasProgress = store.data.completed.length || store.data.attempts.length || store.data.matching.rounds;
  return <section>
    <header className="page-heading activities-heading"><div className="activity-mark"><Icon name="chart" /></div><div><h1>Your progress</h1><p>Saved on this device.</p></div></header>
    <div className="progress-columns">
      <a className="progress-unit paper" href="#path"><div className="section-heading"><h2>Lessons</h2><Icon name="arrow" /></div><p>{completed} of {library.visible.length} finished</p>
        {library.visible.length > 0 && <StepProgress value={completed} total={library.visible.length} label="Lessons finished" />}</a>
      <section className="progress-history paper"><h2>Recent practice</h2>{store.data.attempts.length > 0 ?
        <ul className="lesson-list">{store.data.attempts.slice(0, 6).map((attempt) => <li key={attempt.id}>
          <div><h3>{attempt.title}</h3><p>{attempt.score} of {attempt.total} correct · {attempt.date}</p></div><a className="text-link" href={'#result/' + attempt.id}>See result <Icon name="arrow" /></a>
        </li>)}</ul> : <p>Your finished rounds will show up here.</p>}
      </section>
    </div>
    {hasProgress > 0 && <button className="button secondary section-actions" onClick={() => setConfirm(true)}>Clear progress</button>}
    {confirm && <div className="notice section-actions"><p>Clear scores and lesson progress on this device?</p><div className="actions section-actions">
      <button className="button secondary" onClick={() => setConfirm(false)}>Keep progress</button>
      <button className="button primary" onClick={() => { store.reset(); setConfirm(false); }}>Clear progress now</button>
    </div></div>}
  </section>;
}

function App() {
  const store = useClassroom();
  const library = useTeacherLessons();
  const [[name, id, action, position], setPage] = useState(getPage);
  const page = name || (store.data.setup ? 'home' : 'welcome');
  const routeKey = [page, id, action, position].join('/');
  const content = useRef<HTMLElement>(null);

  useEffect(() => {
    const navigate = () => {
      setPage(getPage());
      content.current?.focus();
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);

  const active = ['learn', 'path', 'category', 'lesson', 'sign-check'].includes(page) ? 'path'
    : ['match', 'camera', 'activities', 'camera-setup'].includes(page) ? 'activities'
    : page === 'builder' ? 'teachers' : page;
  useEffect(() => {
    const label = pages.find(({ key }) => key === active)?.label;
    document.title = label && page !== 'home' ? label + ' · A-B Sign!' : 'A-B Sign!';
  }, [active, page]);
  const firstRun = page === 'welcome';
  const railLayout = page === 'activities' || page === 'progress';
  const days = streak(store.data.attempts);

  return (
    <div className={`app-shell ${railLayout ? 'shell-sidebar' : 'shell-top'}${firstRun ? ' shell-setup' : ''}`}>
      <button className="skip" onClick={() => content.current?.focus()}>Skip to content</button>
      <header className="rail">
        <a className="brand" href="#home"><img src={logo} alt="" width="54" height="54" /><span>A-B Sign!</span></a>
        {!firstRun && <nav aria-label="Main navigation">
          {pages.map(({ key, label, icon }) => <a key={key} href={`#${key}`} aria-current={active === key ? 'page' : undefined}><Icon name={icon} /><span>{label}</span></a>)}
        </nav>}
        <div className="header-tools">
          {!firstRun && <a className="streak-mark" href="#progress" aria-label={`${days} day practice streak`}><Icon name="flame" /> <span>{days} {days === 1 ? 'day' : 'days'}</span></a>}
          <button className="icon-link sound-toggle" aria-label="Answer sounds" aria-pressed={store.data.sound} title={store.data.sound ? 'Sound on' : 'Sound off'} onClick={() => store.update({ sound: !store.data.sound })}><Icon name={store.data.sound ? 'sound' : 'mute'} /></button>
        </div>
      </header>
      <main className="content" ref={content} id="content" tabIndex={-1}>
        {store.saveFailed && <p className="notice" role="alert">Changes could not be saved on this device.</p>}
        {firstRun && <Welcome store={store} />}
        {['home', 'preferences'].includes(page) && <Home store={store} library={library} />}
        {['path', 'learn', 'category', 'sign-check'].includes(page) && <LearningPath library={library} store={store} />}
        {page === 'lesson' && <LessonView key={routeKey} id={id} action={action} position={position} store={store} library={library} />}
        {page === 'result' && <Results id={id} store={store} library={library} />}
        {['activities', 'match'].includes(page) && <PracticeHub library={library} />}
        {['camera', 'camera-setup'].includes(page) && <CameraPractice id={id} store={store} />}
        {page === 'progress' && <Progress store={store} library={library} />}
        {['teachers', 'builder'].includes(page) && <Builder key={routeKey} id={id} library={library} />}
        {!['welcome', 'preferences', 'sign-check', 'camera-setup', 'home', 'learn', 'path', 'category', 'lesson', 'result', 'activities', 'camera', 'match', 'progress', 'teachers', 'builder'].includes(page) &&
          <section><h1>Page not found</h1><a className="button primary section-actions" href="#home">Go to Home</a></section>}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
