import { useEffect, useRef, useState } from 'react';
import logo from '../../docs/images/logo.jpg';
import type { AccountCommand, AccountState, Progress, Student } from '../main/account-types.cjs';
import { Icon } from './icons';

export type AccountAction = (command: AccountCommand, route?: string) => Promise<void>;

export function AccountEntry({ state, teacher, act }: { state: AccountState; teacher: boolean; act: AccountAction }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (command: AccountCommand, route: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try { await act(command, route); }
    catch (problem) { setError((problem as Error).message); setPassword(''); }
    finally { setBusy(false); }
  };

  return <section className="account-entry">
    <div className="account-art">
      <img src={logo} width="172" height="172" alt="Illustrated hands inside a pastel rainbow" />
      <h1>{teacher ? 'Teacher sign-in' : 'Who is learning today?'}</h1>
      <p>{teacher ? 'Open your classroom on this device.' : 'Choose your name to start signing.'}</p>
    </div>
    <div className="account-card paper">
      {teacher ? <form className="simple-form" onSubmit={(event) => { event.preventDefault(); void submit({ action: 'login', password }, 'teachers'); }}>
        <label htmlFor="teacher-password">Teacher password</label>
        <input id="teacher-password" type="password" autoComplete="current-password" value={password} maxLength={128} required onChange={(event) => setPassword(event.target.value)} />
        <button className="button primary" disabled={busy}>Sign in <Icon name="arrow" /></button>
      </form> : <>
        {state.students.length > 0 && <div className="student-picker" aria-label="Choose your name">
          {state.students.map((student) => <button className="button secondary" key={student.id} disabled={busy}
            onClick={() => void submit({ action: 'select', id: student.id }, 'home')}>{student.name}</button>)}
        </div>}
        <form className="simple-form" onSubmit={(event) => { event.preventDefault(); void submit({ action: 'create', name }, 'home'); }}>
          <label htmlFor="student-name">{state.students.length ? 'Add your name' : 'Your name'}</label>
          <input id="student-name" value={name} maxLength={40} required autoComplete="off" onChange={(event) => setName(event.target.value)} />
          <button className="button primary" disabled={busy}>Start learning <Icon name="arrow" /></button>
        </form>
      </>}
      {error && <p role="alert" className="notice">{error}</p>}
      <a className="text-link" href={teacher ? '#welcome' : '#teacher-sign-in'}>{teacher ? 'Back to student accounts' : 'Teacher sign-in'} <Icon name="arrow" /></a>
    </div>
  </section>;
}

export function TeacherAccount({ setup, act }: { setup: boolean; act: AccountAction }) {
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <section>
    <header className="page-heading"><h1>{setup ? 'Set your teacher password' : 'Teacher account'}</h1>
      <p>{setup ? 'Change the starter password to open your classroom.' : 'Change the password used on this device.'}</p></header>
    <form className="simple-form paper account-password" onSubmit={async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const fields = new FormData(form);
      const current = String(fields.get('current'));
      const password = String(fields.get('password'));
      setStatus(''); setError('');
      if (password !== fields.get('confirm')) { setError('The new passwords do not match.'); return; }
      setBusy(true);
      try { await act({ action: 'password', current, password }, setup ? 'teachers' : undefined); form.reset(); setStatus('Password changed.'); }
      catch (problem) { setError((problem as Error).message); }
      finally { setBusy(false); }
    }}>
      <label>Current password<input name="current" type="password" autoComplete="current-password" required maxLength={128} /></label>
      <label>New password<input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} /></label>
      <label>Confirm new password<input name="confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={128} /></label>
      {error && <p className="notice" role="alert">{error}</p>}
      {status && <p className="notice" role="status">{status}</p>}
      <button className="button primary" disabled={busy}>Save password</button>
    </form>
  </section>;
}

function StudentDialog({ student, remove, act, close }: { student: Student; remove: boolean; act: AccountAction; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(student.name);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => { if (node?.open) node.close(); };
  }, []);
  return <dialog ref={dialog} className="account-dialog paper" aria-labelledby="student-dialog-title" onCancel={(event) => { event.preventDefault(); if (!busy) close(); }}>
    <h2 id="student-dialog-title">{remove ? 'Remove ' + student.name + '?' : 'Edit student name'}</h2>
    <form className="simple-form" onSubmit={async (event) => {
      event.preventDefault();
      setBusy(true); setError('');
      try { await act(remove ? { action: 'remove', id: student.id } : { action: 'rename', id: student.id, name }); close(); }
      catch (problem) { setError((problem as Error).message); }
      finally { setBusy(false); }
    }}>
      {remove ? <p>Their account and progress will be deleted from this device.</p> :
        <label>Student name<input value={name} required maxLength={40} onChange={(event) => setName(event.target.value)} /></label>}
      {error && <p role="alert" className="notice">{error}</p>}
      <div className="actions"><button className="button secondary" type="button" autoFocus={!remove ? undefined : true} disabled={busy} onClick={close}>Cancel</button>
        <button className={'button ' + (remove ? 'danger' : 'primary')} disabled={busy}>{remove ? 'Remove student' : 'Save name'}</button></div>
    </form>
  </dialog>;
}

export function Students({ students, act }: { students: Student[]; act: AccountAction }) {
  const [dialog, setDialog] = useState<{ student: Student; remove: boolean }>();
  return <section>
    <header className="page-heading"><h1>Students</h1><p>See how each student is doing.</p></header>
    {students.length ? <ul className="lesson-list paper roster">{students.map((student) => <li key={student.id}>
      <div className="roster-name"><span className="roster-initial" aria-hidden="true">{[...student.name][0]}</span><h2>{student.name}</h2></div>
      <div className="actions"><a className="button secondary" href={'#student/' + student.id}>View progress</a>
        <button className="button secondary" aria-label={'Edit ' + student.name} onClick={() => setDialog({ student, remove: false })}>Edit name</button>
        <button className="button secondary" aria-label={'Remove ' + student.name} onClick={() => setDialog({ student, remove: true })}>Remove</button></div>
    </li>)}</ul> : <div className="paper empty"><h2>No students yet</h2><p>Students can add their name when they open the app.</p></div>}
    {dialog && <StudentDialog {...dialog} act={act} close={() => setDialog(undefined)} />}
  </section>;
}

export function StudentProgress({ student, children }: { student: Student; children: (value: Progress) => React.ReactNode }) {
  const [progress, setProgress] = useState<Progress>();
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    void window.localAccounts.request({ action: 'student-progress', id: student.id }).then((reply) => {
      if (!current) return;
      if (reply.ok) setProgress(reply.progress);
      else setError(reply.error);
    }, () => { if (current) setError('Could not open student progress.'); });
    return () => { current = false; };
  }, [student.id]);
  return <><a className="back-link" href="#students">Students</a>
    {progress ? children(progress) : <p role={error ? 'alert' : 'status'}>{error || 'Opening progress…'}</p>}</>;
}
