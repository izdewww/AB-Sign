import { useEffect, useRef, useState, type SetStateAction } from 'react';
import { LessonStep, stepTitle } from './course';
import { Icon } from './icons';
import { cameraSupports, findLetter, isLabel, labels } from './letters';
import { LessonMedia } from './lesson-media';
import { categories, categoryFor, hasTermMedia, lessonTerms, quizCamera, quizFor, type Category, type Lesson, type Step, type TeacherLesson, type TeacherLibrary } from './lessons';
import { vocabularyVideo } from './vocabulary';
import type { Prompt } from './quiz';

const stepNames: Record<Step['kind'], string> = {
  look: 'Show a sign', video: 'Play a video', match: 'Match a sign', camera: 'Try the camera', spell: 'Read a fingerspelled word', media: 'Show a sign',
};

function newStep(kind: Step['kind'], id: string = crypto.randomUUID()): Step {
  if (kind === 'spell') return { id, kind, word: '' };
  if (kind === 'media') return { id, kind, term: '' };
  return { id, kind, letter: '' };
}

async function checkImage(file: File) {
  if (!/\.(jpg|jpeg|png|webp)$/i.test(file.name) || !file.size || file.size > 15 * 1024 * 1024) throw new Error('Choose a JPG, PNG, or WebP image under 15 MB.');
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error('This picture could not be opened. Choose another one.'); }
  try {
    if (bitmap.width > 6000 || bitmap.height > 6000) throw new Error('Use an image no larger than 6,000 pixels on either side.');
  } finally { bitmap.close(); }
}

function checkVideo(file: File) {
  if (!/\.(mp4|webm)$/i.test(file.name) || !file.size || file.size > 50 * 1024 * 1024) {
    return Promise.reject(new Error('Choose an MP4 or WebM video under 50 MB.'));
  }
  return new Promise<void>((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      video.onloadeddata = null;
      video.onerror = null;
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
      if (ok) resolve();
      else reject(new Error('This video cannot play. Choose another MP4 or WebM file.'));
    };
    const timer = window.setTimeout(() => finish(false), 6000);
    video.onloadeddata = () => finish(video.videoWidth > 0);
    video.onerror = () => finish(false);
    video.preload = 'auto';
    video.src = url;
  });
}

export function Builder({ library, id, category }: { library: TeacherLibrary; id?: string; category?: string }) {
  const { status, items } = library;
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  if (status !== 'ready') return <section><h1>Lesson builder</h1><p role="status">{status === 'loading' ? 'Opening your lessons…' : 'Your lessons could not be opened. Restart the app and try again.'}</p></section>;
  if (!id) return (
    <section><header className="page-heading"><h1>Lesson builder</h1><p>Put pictures, videos, and practice into a lesson.</p></header>
      <div className="actions"><a className="button primary" href="#builder/new">Create a lesson <Icon name="arrow" /></a>
        {items.some(({ starter }) => starter) && <button className="button secondary" disabled={busy} onClick={async () => {
          const show = !items.some(({ starter, hidden }) => starter && !hidden);
          setBusy(true); setMessage('');
          try { await library.showStarters(show); setMessage(show ? 'Alphabet lessons are visible again.' : 'Alphabet lessons are hidden from learners. You can still edit them here.'); }
          catch { setMessage('Could not change lesson visibility. Try again.'); }
          finally { setBusy(false); }
        }}>{items.some(({ starter, hidden }) => starter && !hidden) ? 'Hide alphabet lessons' : 'Show alphabet lessons'}</button>}
      </div>
      {message && <p className="notice section-actions" role="status">{message}</p>}
      {items.length > 0 && <ul className="lesson-list paper section-actions">{items.map((item) => <li key={item.id}><div><h2>{item.draft.title || 'Untitled lesson'}</h2><p>{categoryFor(item.draft.category).title} · {item.hidden ? 'Hidden from learners' : item.published ? 'Ready on this device' : 'Draft'}</p></div><a className="button secondary" href={`#builder/${item.id}`} aria-label={`Edit ${item.draft.title || 'untitled lesson'}`}>Edit</a></li>)}</ul>}
      {items.length === 0 && <p className="notice section-actions">Lessons you save will show here.</p>}
    </section>
  );
  const selected = items.find((item) => item.id === id);
  if (selected || id === 'new') return <Editor key={id} library={library} entry={selected} category={categoryFor(category).id} />;
  return <section><header className="page-heading"><h1>Lesson not found</h1></header><a className="button secondary" href="#builder">My lessons</a></section>;
}

function Editor({ library, entry, category }: { library: TeacherLibrary; entry?: TeacherLesson; category: Category }) {
  const [draft, setDraft] = useState<Lesson>(() => {
    if (!entry) return { id: crypto.randomUUID(), title: '', category, steps: [], revision: 1 };
    return {
      ...entry.draft,
      steps: entry.draft.steps.map((step) => step.kind === 'camera' && isLabel(step.letter) && !cameraSupports(step.letter) ? { ...step, kind: 'look' } : step),
      quiz: entry.draft.quiz?.perSign ? entry.draft.quiz : quizFor(entry.draft) ?? entry.draft.quiz,
    };
  });
  const [preview, setPreview] = useState<number>();
  const [selectedId, selectStep] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const index = Math.max(0, draft.steps.findIndex(({ id }) => id === selectedId));
  const step = draft.steps[index];
  const currentCategory = categoryFor(draft.category).id;
  const alphabet = currentCategory === 'alphabet';
  const automaticRound = draft.quiz?.perSign ? quizFor(draft) : undefined;
  const dirty = useRef(false);
  const queue = useRef(Promise.resolve());
  const update = (change: SetStateAction<Lesson>) => {
    dirty.current = true;
    setDraft((previous) => {
      const next = typeof change === 'function' ? change(previous) : change;
      if (!next.quiz || next.quiz.perSign) return next;
      const current = quizFor(next);
      if (current) return { ...next, quiz: current };
      return { ...next, quiz: { prompts: [], count: 1 } };
    });
  };
  const updateStep = (position: number, step: Step) => update((current) => ({ ...current, steps: current.steps.map((value, index) => index === position ? step : value) }));
  const write = (item: TeacherLesson) => {
    const next = queue.current.catch(() => {}).then(() => library.save(item));
    queue.current = next;
    return next;
  };
  useEffect(() => {
    if (!entry || busy || !dirty.current) return;
    const timer = window.setTimeout(() => {
      dirty.current = false;
      void write({ ...entry, draft }).then(() => setNotice('Draft saved.')).catch(() => setError('Draft could not save. Try Save draft.'));
    }, 750);
    return () => clearTimeout(timer);
  }, [draft, busy, entry]);

  const move = (position: number, direction: number) => {
    const steps = [...draft.steps];
    const next = position + direction;
    [steps[position], steps[next]] = [steps[next], steps[position]];
    update({ ...draft, steps });
  };

  async function loadMedia(step: Exclude<Step, { kind: 'spell' }>, field: 'image' | 'video', file?: File) {
    if (!file || busy) return;
    setBusy(true);
    setError('');
    try {
      await (field === 'image' ? checkImage(file) : checkVideo(file));
      update((current) => ({ ...current, steps: current.steps.map((item) => item.id === step.id && item.kind !== 'spell' ? { ...item, [field]: file } : item) }));
    }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not open that file.'); }
    finally { setBusy(false); }
  }

  function validate() {
    if (!draft.title.trim()) return 'Give the lesson a name.';
    if (!draft.steps.length) return 'Add at least one step.';
    if (draft.steps.some((step) => 'letter' in step && !isLabel(step.letter))) return 'Choose a letter for every sign step.';
    if (draft.steps.some((step) => step.kind === 'spell' && !/^[A-Z]{2,12}$/.test(step.word))) return 'Spelling steps need 2 to 12 letters.';
    if (draft.steps.some((step) => step.kind === 'media' && (!step.term.trim() || !hasTermMedia(step)))) return 'Name each sign and add a picture or video.';
    if (draft.quiz && !draft.quiz.perSign && !quizFor(draft)) return 'Add at least two different signs and choose quiz questions, or turn off the quiz.';
    return '';
  }

  async function save(publish: boolean) {
    setError('');
    setNotice('');
    const problem = publish ? validate() : '';
    if (problem) { setError(problem); return; }
    const current = { ...draft, title: draft.title.trim(), revision: publish ? (entry?.published?.revision ?? 0) + 1 : draft.revision };
    dirty.current = false;
    setBusy(true);
    try {
      await write({ ...entry, id: draft.id, draft: current, published: publish ? current : entry?.published });
      setDraft(current);
      setNotice(publish ? 'Lesson ready on this device.' : 'Draft saved.');
      if (!entry) window.location.hash = publish ? `lesson/${draft.id}` : `builder/${draft.id}`;
    } catch {
      setError('Could not save the lesson. Check available storage and try again.');
    } finally {
      setBusy(false);
    }
  }

  function togglePrompt(prompt: Prompt<string>) {
    if (!draft.quiz) return;
    const has = (item: Prompt<string>) => item.kind === prompt.kind && item.letter === prompt.letter;
    const prompts = draft.quiz.prompts.some(has) ? draft.quiz.prompts.filter((item) => !has(item)) : [...draft.quiz.prompts, prompt];
    update({ ...draft, quiz: { count: Math.max(1, Math.min(draft.quiz.count, prompts.length)), prompts } });
  }

  if (preview !== undefined) return (
    <section>
      <div className="actions preview-toolbar"><button className="button secondary" onClick={() => setPreview(undefined)}>Back to editing</button><p>Preview · Step {Math.min(preview + 1, draft.steps.length)} of {draft.steps.length}</p></div>
      {draft.steps[preview] ? <LessonStep key={draft.steps[preview].id} step={draft.steps[preview]} lesson={draft} next={() => setPreview(preview + 1)} /> : <h1>Preview complete</h1>}
    </section>
  );
  return (
    <section className="builder-screen">
      <a className="back-link" href="#builder">My lessons</a>
      <header className="page-heading"><h1>{entry ? 'Edit lesson' : 'Create a lesson'}</h1><p>Build the lesson one step at a time.</p></header>
      <div className="builder-board">
        <aside className="builder-rail paper" aria-label="Lesson steps">
          <h2>Steps ({draft.steps.length})</h2>
          <ol className="builder-steps">{draft.steps.map((item) => <li key={item.id}><button className="step-select" aria-current={item.id === step?.id ? 'step' : undefined} onClick={() => selectStep(item.id)}>{stepTitle(item, true)}</button></li>)}</ol>
          <button className="button secondary" disabled={busy || draft.steps.length >= 20} onClick={() => {
            const step = newStep(alphabet ? 'look' : 'media'); update({ ...draft, steps: [...draft.steps, step] }); selectStep(step.id);
          }}>Add step</button>
        </aside>
        <div className="simple-form builder-editor paper">
          <label>Lesson name<input value={draft.title} disabled={busy} onChange={(event) => update({ ...draft, title: event.target.value })} maxLength={60} placeholder="For example, First letters" /></label>
          <label>Category<select value={currentCategory} disabled={busy || draft.steps.length > 0}
            onChange={(event) => update({ ...draft, category: categoryFor(event.target.value).id })}>
            {categories.map(({ id, title }) => <option key={id} value={id}>{title}</option>)}
          </select></label>
          {step && <section className="builder-step" key={step.id}>
            <div className="builder-step-header"><h2>Step {index + 1}</h2><div className="actions">
              <button className="button secondary" disabled={index === 0 || busy} aria-label={`Move step ${index + 1} up`} onClick={() => move(index, -1)}>Up</button>
              <button className="button secondary" disabled={index === draft.steps.length - 1 || busy} aria-label={`Move step ${index + 1} down`} onClick={() => move(index, 1)}>Down</button>
              <button className="button secondary" disabled={busy} aria-label={`Remove step ${index + 1}`} onClick={() => update({ ...draft, steps: draft.steps.filter((item) => item.id !== step.id) })}>Remove</button>
            </div></div>
            <div className="editor-fields">
              {step.kind === 'media' ? <label>{currentCategory === 'numbers' ? 'Number' : 'Word or phrase'}
                <input value={step.term} maxLength={40} disabled={busy} onChange={(event) => updateStep(index, { ...step, term: event.target.value, example: undefined })} />
              </label> : <><label>What will learners do?<select disabled={busy} value={step.kind} onChange={(event) => {
                const kind = event.target.value as Step['kind'];
                updateStep(index, 'letter' in step && kind !== 'spell' && kind !== 'media'
                  ? { ...step, kind, letter: kind === 'camera' && !cameraSupports(step.letter) ? '' : step.letter }
                  : newStep(kind, step.id));
              }}>{Object.entries(stepNames).filter(([kind]) => ['look', 'spell'].includes(kind) || kind === step.kind).map(([kind, label]) => <option value={kind} key={kind}>{label}</option>)}</select></label>
              {step.kind === 'spell' ? <label>Word to reveal at the end<input value={step.word} disabled={busy} maxLength={12} onChange={(event) => updateStep(index, { ...step, word: event.target.value.toUpperCase() })} /></label> :
                <label>Letter<select value={step.letter} disabled={busy} onChange={(event) => {
                  const value = event.target.value; updateStep(index, { ...step, letter: isLabel(value) ? value : '' });
                }}><option value="">Choose a letter</option>{labels.filter((label) => step.kind !== 'camera' || cameraSupports(label)).map((label) => <option key={label}>{label}</option>)}</select></label>}</>}
            </div>
            {step.kind !== 'spell' && <div className="media-fields">
              {(['image', 'video'] as const).map((field) => <div key={field} className="media-picker">
                <label onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
                  event.preventDefault();
                  if (event.dataTransfer.files.length !== 1) { setError('Choose one file for this step.'); return; }
                  void loadMedia(step, field, event.dataTransfer.files[0]);
                }}>{field === 'image' ? 'Picture' : 'Video (optional)'} <span className="small-copy">{step[field]?.name ?? (field === 'image' ? ('letter' in step && step.letter ? 'Dataset photo' : 'No picture selected') : step.kind === 'media' && vocabularyVideo(step.example) ? 'Bundled demo' : 'No video added')}</span>
                  <input type="file" data-media={field} accept={field === 'image' ? '.png,.jpg,.jpeg,.webp' : '.mp4,.webm'} disabled={busy} onChange={(event) => {
                    const file = event.target.files?.[0]; event.target.value = ''; void loadMedia(step, field, file);
                  }} />
                  <span className="media-pick-action">{step[field] ? 'Replace' : 'Upload'} {field === 'image' ? 'picture' : 'video'}</span>
                </label>
                {step[field] && <button className="button secondary" disabled={busy} onClick={() => updateStep(index, { ...step, [field]: undefined })}>{field === 'image' ? ('letter' in step ? 'Use dataset photo' : 'Remove picture') : 'Remove video'}</button>}
              </div>)}
            </div>}
          </section>}
        </div>
        <aside className="learner-preview paper">
          <h2>Learner preview</h2>
          {step ? <><p>{stepTitle(step)}</p>{step.kind === 'spell' ? <span className="preview-letters">{step.word}</span> :
            (step.kind === 'media' ? hasTermMedia(step) : isLabel(step.letter)) &&
              <LessonMedia key={step.id + (step.video?.name ?? '')} name={step.kind === 'media' ? step.term : undefined}
                letter={'letter' in step && isLabel(step.letter) ? findLetter(step.letter) : undefined} file={step.video} image={step.image}
                bundledVideo={step.kind === 'media' && !step.image ? vocabularyVideo(step.example) : undefined} />}</> : <p>Add a step to see it here.</p>}
          <button className="button secondary" disabled={busy || !draft.steps.length} onClick={() => { const issue = validate(); setError(issue); if (!issue) setPreview(0); }}>Preview</button>
        </aside>
      </div>
      <section className="builder-quiz paper" aria-labelledby="builder-quiz-title">
        <div className="section-heading"><div><h2 id="builder-quiz-title">Lesson quiz</h2><p>{draft.quiz?.perSign ? 'Every sign gets a turn. The order changes each round.' : 'Choose the signs to practice. The order and choices change each round.'}</p></div>
          <button className="button secondary" aria-pressed={Boolean(draft.quiz)} disabled={busy} onClick={() => update({ ...draft, quiz: draft.quiz ? undefined : { count: 1, prompts: [] } })}>{draft.quiz ? 'Remove quiz' : 'Add quiz'}</button>
        </div>
        {draft.quiz?.perSign ? <div className="actions section-actions">
          <p>{!automaticRound ? 'Add two signs with demonstrations to start practice.' : automaticRound.prompts.some(({ kind }) => kind === 'camera') ? 'This lesson mixes matching and camera practice.' : 'This lesson shuffles matching questions.'}</p>
          {automaticRound && <button className="button secondary" disabled={busy} onClick={() => update({ ...draft,
            quiz: { count: Math.min(10, automaticRound.count), prompts: automaticRound.prompts },
          })}>Choose questions</button>}
        </div> : draft.quiz && (lessonTerms(draft).length < 2 ? <p className="notice">Add two different signs to start a quiz.</p> : <>
          <div className="quiz-variables">{lessonTerms(draft).map((letter) => <fieldset key={letter}>
            <legend>{alphabet ? 'Letter ' : ''}{letter}</legend>{(['match', 'camera'] as const).filter((kind) => kind === 'match' || quizCamera(draft, letter)).map((kind) => <label key={kind}>
              <input type="checkbox" disabled={busy} checked={Boolean(draft.quiz?.prompts.some((item) => item.kind === kind && item.letter === letter))} onChange={() => togglePrompt({ letter, kind })} /> {kind === 'match' ? (alphabet ? 'Picture match' : 'Match the sign') : 'Camera'}
            </label>)}
          </fieldset>)}</div>
          <label className="quiz-length">Questions per round<select disabled={busy || !draft.quiz.prompts.length} value={draft.quiz.count} onChange={(event) => update({ ...draft, quiz: { ...draft.quiz!, count: Number(event.target.value) } })}>
            {Array.from({ length: Math.max(1, Math.min(10, draft.quiz.prompts.length)) }, (_, position) => <option key={position} value={position + 1}>{position + 1}</option>)}
          </select></label>
        </>)}
      </section>
      <footer className="builder-footer paper">
        {error && <p className="notice" role="alert">{error}</p>}
        <p role="status">{busy ? 'Working…' : notice}</p>
        <div className="actions">
          <button className="button secondary" disabled={busy} onClick={() => void save(false)}>Save draft</button>
          <button className="button primary" disabled={busy} onClick={() => void save(true)}>Use on this device</button>
          {entry?.published && !entry.hidden && <a className="button secondary" href={`#lesson/${entry.id}`}>Open saved lesson</a>}
        </div>
      </footer>
    </section>
  );
}
