import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/fredoka';
import '@fontsource/varela-round/latin-400.css';
import logo from '../../docs/images/logo.jpg';
import type { AccountState, Progress as StudentData } from '../main/account-types.cjs';
import { AccountEntry, StudentProgress, Students, TeacherAccount, type AccountAction } from './accounts-ui';
import { BuddyAvatar } from './avatars';
import { getLearnerAvatar } from './learner-profile';
import { WelcomePage } from './welcome-page';
import { LearnerDashboard } from './dashboard';
import { NavigationSidebar } from './navigation-sidebar';
import { ActivitiesHub } from './activities-hub';
import { ProgressView } from './progress-view';
import { CameraSetupPage } from './camera-setup-page';
import { Icon } from './icons';
import { Builder } from './builder';
import { Camera } from './camera';
import { Challenge } from './challenge';
import { streak, useClassroom, type ClassroomStore } from './classroom';
import { CategoryView, DashboardStrip, LearningPath, LessonView, Results } from './course';
import { StepProgress } from './learning-ui';
import { cameraSupports, findLetter, labels } from './letters';
import { categories, quizFor, useTeacherLessons, type TeacherLibrary } from './lessons';
import { vocabulary, vocabularyVideo } from './vocabulary';
import './style.css';

const pages = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'path', label: 'Learn', icon: 'book' },
  { key: 'activities', label: 'Play', icon: 'match' },
  { key: 'challenge', label: 'Challenge', icon: 'trophy' },
  { key: 'progress', label: 'Progress', icon: 'chart' },
] as const;
const teacherPages = [
  { key: 'teachers', label: 'Classroom', icon: 'teach' },
  { key: 'builder', label: 'Lessons', icon: 'book' },
  { key: 'students', label: 'Students', icon: 'chart' },
  { key: 'teacher-account', label: 'Account', icon: 'home' },
] as const;

function getPage() {
  return window.location.hash.slice(1).split('/', 4);
}

function Home({ library, store, name }: { library: TeacherLibrary; store: ClassroomStore; name: string }) {
  return <div className="dashboard">
    <section className="dashboard-welcome paper">
      <img src={logo} width="76" height="76" alt="" />
      <div><h1>Hi, {name}! Ready to sign?</h1><p>Practice Filipino Sign Language.</p></div>
      <a className="button secondary" href="#camera-setup"><Icon name="camera" /> Check camera</a>
    </section>
    <DashboardStrip library={library} store={store} />
    <section className="paper dashboard-categories"><div className="section-heading"><h2>Learning path</h2><a className="text-link" href="#path">All categories <Icon name="arrow" /></a></div>
      <div className="dashboard-category-links">{categories.map((category) => <a key={category.id}
        className={'button secondary ' + category.tone} href={'#category/' + category.id}>{category.title}</a>)}</div>
    </section>
    <div className="dashboard-grid">
      <section className="game paper"><div className="activity-mark"><Icon name="match" /></div><h2>Play &amp; practice</h2>
        <p>Play a lesson quiz or try the camera.</p><a className="button secondary" href="#activities">Find a quiz <Icon name="arrow" /></a></section>
      <section className="game paper"><div className="activity-mark"><Icon name="trophy" /></div><h2>My progress</h2>
        <p>{store.data.completed.length} lessons finished</p><a className="button secondary" href="#progress">See progress <Icon name="arrow" /></a></section>
    </div>
  </div>;
}

function PracticeHub({ library, mode }: { library: TeacherLibrary; mode?: string }) {
  const quizzes = library.visible.filter(quizFor);
  const activities = [
    { id: 'cards', title: 'Sign & word cards', description: 'Look at a sign and practice it.', tone: 'mint' },
    { id: 'guess', title: 'Guess the sign', description: 'Find the letter or word that matches.', tone: 'sky' },
    { id: 'spell', title: 'Fingerspelling', description: 'Read signs one letter at a time.', tone: 'yellow' },
    { id: 'words', title: 'Vocabulary challenge', description: 'Match signs for numbers and words.', tone: 'peach' },
  ] as const;
  const activity = activities.find((item) => item.id === mode);
  const options = mode === 'cards'
    ? library.visible.map((lesson) => ({ title: lesson.title, url: '#lesson/' + lesson.id + '/demo/0' }))
    : mode === 'spell' ? library.visible.flatMap((lesson) => lesson.steps.flatMap((step, index) => step.kind === 'spell'
      ? [{ title: lesson.title, url: '#lesson/' + lesson.id + '/demo/' + index }] : []))
    : quizzes.filter((lesson) => mode !== 'words' || (lesson.category && lesson.category !== 'alphabet'))
      .map((lesson) => ({ title: lesson.title, url: '#lesson/' + lesson.id + '/quiz' }));
  if (activity) return <section>
    <a className="back-link" href="#activities">Activities &amp; games</a>
    <header className={'path-card ' + activity.tone}><div><h1>{activity.title}</h1><p>{activity.description}</p></div></header>
    {options.length ? <ul className="lesson-list paper section-actions">{options.map(({ title, url }) => <li key={url}>
      <h2>{title}</h2><a className="button secondary" href={url}>Open <Icon name="arrow" /></a>
    </li>)}</ul> : <div className="paper empty section-actions"><p>{library.status === 'loading' ? 'Opening lessons…' : 'No activities here yet.'}</p></div>}
  </section>;
  return <section>
    <header className="page-heading activities-heading"><div className="activity-mark"><Icon name="match" /></div><div><h1>Activities &amp; games</h1><p>Choose how you want to practice.</p></div></header>
    <div className="activity-grid">{activities.map((item) => <a key={item.id} className={'paper activity-tile ' + item.tone} href={'#activities/' + item.id}>
      <div><h2>{item.title}</h2><p>{item.description}</p></div><Icon name="arrow" />
    </a>)}</div>
    <section className="path-card sky"><div><h2>Try the camera</h2><p>Choose a letter or number to practice.</p></div><a className="button secondary" href="#camera">Camera practice</a></section>
  </section>;
}

function CameraSetup() {
  return <section>
    <a className="back-link" href="#home">Home</a>
    <header className="page-heading"><h1>Let’s check your camera</h1><p>Check that you can see your whole hand.</p></header>
    <Camera guided />
    <div className="actions section-actions"><a className="button primary" href="#camera">Practice a sign <Icon name="arrow" /></a></div>
  </section>;
}

function CameraPractice({ id, store }: { id?: string; store: ClassroomStore }) {
  const target = cameraSupports(id) ? id : undefined;
  const numbers = vocabulary.filter(({ category }) => category === 'numbers').flatMap(({ terms }) => terms).filter(({ camera }) => camera);
  const number = numbers.find(({ term }) => id === 'number-' + term);
  return <section>
    <a className="back-link" href="#activities">Play &amp; practice</a>
    <header className="page-heading"><h1>Camera practice</h1><p>Choose a letter or number to try.</p></header>
    <div className="letter-picker camera-letter-picker" aria-label="Letters">{labels.filter(cameraSupports).map((label) =>
      <a className={'letter-chip ' + findLetter(label).tone} aria-current={label === target ? 'true' : undefined} key={label} href={'#camera/' + label}>{label}</a>)}</div>
    <div className="letter-picker camera-letter-picker section-actions" aria-label="Numbers">{numbers.map(({ term }) =>
      <a className="letter-chip sky" aria-current={term === number?.term ? 'true' : undefined} key={term} href={'#camera/number-' + term}>{term}</a>)}</div>
    {target && <Camera key={target} target={target} fallback={<a className="button secondary" href="#activities">Use pictures</a>} match={() => {
      store.record({ activity: 'camera', title: 'Camera · ' + target, score: 1, total: 1, missed: [] });
    }} />}
    {number?.id && <Camera key={number.id} term={{ id: number.id, name: number.term, demo: vocabularyVideo(number.id) }} guided
      fallback={<a className="button secondary" href="#category/numbers">Use matching</a>} match={() => {
        store.record({ activity: 'camera', title: 'Camera · ' + number.term, score: 1, total: 1, missed: [] });
      }} />}
  </section>;
}

function Progress({ data, library, name, reset }: { data: StudentData; library: TeacherLibrary; name?: string; reset?: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const completed = library.visible.filter(({ id }) => data.completed.includes(id)).length;
  const hasProgress = data.completed.length || data.attempts.length;
  return <section>
    <header className="page-heading activities-heading"><div className="activity-mark"><Icon name="chart" /></div><div><h1>{name ? name + '’s progress' : 'Your progress'}</h1><p>Saved on this device.</p></div></header>
    <div className="progress-columns">
      <a className="progress-unit paper" href="#path"><div className="section-heading"><h2>Lessons</h2><Icon name="arrow" /></div><p>{completed} of {library.visible.length} finished</p>
        {library.visible.length > 0 && <StepProgress value={completed} total={library.visible.length} label="Lessons finished" />}</a>
      <section className="progress-history paper"><h2>Recent practice</h2>{data.attempts.length > 0 ?
        <ul className="lesson-list">{data.attempts.slice(0, 6).map((attempt) => <li key={attempt.id}>
          <div><h3>{attempt.title}</h3><p>{attempt.score} of {attempt.total} correct · {attempt.date}</p></div>{!name && <a className="text-link" href={'#result/' + attempt.id}>See result <Icon name="arrow" /></a>}
        </li>)}</ul> : <p>Your finished rounds will show up here.</p>}
      </section>
    </div>
    <section className="progress-history paper section-actions"><h2>Badges</h2>
      {data.completed.length || data.badges.length ? <div className="badge-list">
        {data.completed.map((id) => library.visible.find((lesson) => lesson.id === id)).filter((lesson) => lesson !== undefined)
          .map((lesson) => <span key={lesson.id}><Icon name="trophy" /> {lesson.title}</span>)}
        {categories.filter(({ id }) => data.badges.includes(id)).map(({ id, title }) => <span key={id}><Icon name="trophy" /> {title}</span>)}
      </div> : <p>Finish a lesson to earn a badge.</p>}
    </section>
    <section className="progress-history paper section-actions"><h2>Category progress</h2><ul className="lesson-list">{categories.map(({ id, title }) => {
      const lessons = library.visible.filter((lesson) => (lesson.category ?? 'alphabet') === id);
      return <li key={id}><h3>{title}</h3><p>{lessons.filter((lesson) => data.completed.includes(lesson.id)).length} of {lessons.length} finished</p></li>;
    })}</ul></section>
    {reset && hasProgress > 0 && <button className="button secondary section-actions" onClick={() => setConfirm(true)}>Clear progress</button>}
    {confirm && reset && <div className="notice section-actions"><p>Clear scores and lesson progress on this device?</p><div className="actions section-actions">
      <button className="button secondary" onClick={() => setConfirm(false)}>Keep progress</button>
      <button className="button primary" onClick={() => { reset(); setConfirm(false); }}>Clear progress now</button>
    </div></div>}
  </section>;
}

function App() {
  const [account, setAccount] = useState<AccountState>();
  const [error, setError] = useState('');
  useEffect(() => {
    void window.localAccounts.request({ action: 'state' }).then((reply) => {
      if (reply.ok) setAccount(reply.state);
      else setError(reply.error);
    }, () => setError('Could not open this classroom.'));
  }, []);
  const act: AccountAction = async (command, route) => {
    const reply = await window.localAccounts.request(command);
    if (!reply.ok) throw new Error(reply.error);
    setAccount(reply.state);
    if (route) location.hash = route;
  };
  if (!account) return <main className="content"><p role={error ? 'alert' : 'status'}>{error || 'Opening your classroom…'}</p></main>;
  return <Classroom key={account.active?.role === 'student' ? account.active.student.id : account.active?.role ?? 'entry'} account={account} act={act} />;
}

function Classroom({ account, act }: { account: AccountState; act: AccountAction }) {
  const activeAccount = account.active;
  const student = activeAccount?.role === 'student' ? activeAccount : undefined;
  const teacher = activeAccount?.role === 'teacher' ? activeAccount : undefined;
  const store = useClassroom(student && { id: student.student.id, progress: student.progress });
  const library = useTeacherLessons(Boolean(teacher && !teacher.setup));
  const [[name, id, action, position], setPage] = useState(getPage);
  const page = !activeAccount ? (name === 'teacher-sign-in' ? name : 'welcome')
    : teacher?.setup ? 'teacher-account'
    : name === 'welcome' || name === 'teacher-sign-in' || !name ? (teacher ? 'teachers' : 'home') : name;
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
    : page === 'student' ? 'students' : page;
  const navPages = teacher ? teacherPages : pages;
  useEffect(() => {
    const label = navPages.find(({ key }) => key === active)?.label;
    document.title = label && page !== 'home' ? label + ' · A-B Sign!' : 'A-B Sign!';
  }, [active, page, navPages]);
  const firstRun = !activeAccount;
  const railLayout = page === 'activities' || page === 'progress';
  const days = streak(store.data.attempts);

  return (
    <div className={`app-shell ${student ? 'shell-with-sidebar' : railLayout ? 'shell-sidebar' : 'shell-top'}${firstRun ? ' shell-setup' : ''}`}>
      <button className="skip" onClick={() => content.current?.focus()}>Skip to content</button>
      {student && (
        <NavigationSidebar
          student={student.student}
          activeRoute={page}
          daysStreak={days}
          onSwitchAccount={() => void act({ action: 'logout' }, 'welcome')}
        />
      )}
      {!student && (
        <header className="rail">
          <a className="brand" href={teacher ? '#teachers' : '#home'}><img src={logo} alt="" width="54" height="54" /><span>A-B Sign!</span></a>
          {!firstRun && !teacher?.setup && <nav aria-label="Main navigation">
            {navPages.map(({ key, label, icon }) => <a key={key} href={`#${key}`} aria-current={active === key ? 'page' : undefined}><Icon name={icon} /><span>{label}</span></a>)}
          </nav>}
          <div className="header-tools">
            {activeAccount && <button className="button secondary account-switch" onClick={() => void act({ action: 'logout' }, 'welcome')}>{teacher ? 'Sign out' : 'Switch account'}</button>}
          </div>
        </header>
      )}
      <main className="content" ref={content} id="content" tabIndex={-1}>
        {store.saveFailed && <p className="notice" role="alert">Changes could not be saved on this device.</p>}
        {firstRun && (page === 'teacher-sign-in' ? <AccountEntry key={page} state={account} teacher act={act} /> : <WelcomePage key={page} state={account} act={act} />)}
        {['home', 'preferences'].includes(page) && student && <LearnerDashboard store={store} library={library} student={student.student} />}
        {['path', 'learn', 'sign-check'].includes(page) && <LearningPath library={library} store={store} />}
        {page === 'category' && <CategoryView key={id} id={id} library={library} store={store} teacher={Boolean(teacher)} />}
        {page === 'lesson' && <LessonView key={routeKey} id={id} action={action} position={position} store={store} library={library} />}
        {page === 'result' && <Results id={id} completion={action} store={store} library={library} />}
        {['activities', 'match'].includes(page) && student && <ActivitiesHub library={library} store={store} student={student.student} mode={page === 'match' ? 'guess' : id} />}
        {['activities', 'match'].includes(page) && !student && <PracticeHub library={library} mode={page === 'match' ? 'guess' : id} />}
        {page === 'camera' && <CameraPractice id={id} store={store} />}
        {page === 'camera-setup' && <CameraSetupPage onContinue={() => { window.location.hash = '#camera'; }} />}
        {page === 'challenge' && student && account.challenge && <Challenge data={account.challenge} studentId={student.student.id} act={act} />}
        {page === 'challenge' && teacher && <section className="paper empty"><h1>Student challenge</h1><p>Choose a student account to play.</p></section>}
        {page === 'progress' && student && <ProgressView data={store.data} library={library} reset={store.reset} />}
        {page === 'teacher-account' && teacher && <TeacherAccount setup={teacher.setup} act={act} />}
        {page === 'teachers' && teacher && <section><header className="page-heading"><h1>Classroom</h1><p>Get today’s lesson ready or check student progress.</p></header>
          <div className="dashboard-grid"><section className="game paper"><h2>Lessons</h2><a className="button primary" href="#builder">Open lesson builder</a><a className="text-link" href="#path">View learning path</a></section>
            <section className="game paper"><h2>Students</h2><p>{account.students.length} on this device</p><a className="button secondary" href="#students">See students</a></section></div></section>}
        {page === 'builder' && teacher && <Builder key={routeKey} id={id} category={action} library={library} />}
        {page === 'students' && teacher && <Students students={account.students} act={act} />}
        {page === 'student' && teacher && (() => {
          const selected = account.students.find((item) => item.id === id);
          return selected ? <StudentProgress key={id} student={selected}>{(data) => <Progress data={data} library={library} name={selected.name} />}</StudentProgress>
            : <div className="paper empty"><h1>Student unavailable</h1><a className="button secondary" href="#students">Back to students</a></div>;
        })()}
        {!teacher && ['teachers', 'builder', 'students', 'student', 'teacher-account'].includes(page) &&
          <section className="paper empty"><h1>Teacher area</h1><button className="button primary" onClick={() => void act({ action: 'logout' }, 'teacher-sign-in')}>Teacher sign-in</button></section>}
        {!['welcome', 'teacher-sign-in', 'preferences', 'sign-check', 'camera-setup', 'home', 'learn', 'path', 'category', 'lesson', 'result', 'activities', 'camera', 'match', 'challenge', 'progress', 'teachers', 'builder', 'students', 'student', 'teacher-account'].includes(page) &&
          <section><h1>Page not found</h1><a className="button primary section-actions" href="#home">Go to Home</a></section>}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
