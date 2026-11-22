import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AccountCommand, AccountReply, AccountState, ChallengeMode, ChallengeScores, Progress, Student } from './account-types.cjs';

type Password = { salt: string; digest: string };
type Record = Student & { progress: Progress; challenge?: ChallengeScores };
type AccountFile = { version: 1; password?: Password; students: Record[] };
const starter = {
  salt: 'ab-sign-initial-teacher-v1',
  digest: 'b411434160954571565e083dc8a0f50825def6cfd670b519166080f9d6722644',
};

const emptyProgress = (): Progress => ({ attempts: [], completed: [], badges: [], resume: '', sound: false });
const text = (value: unknown, limit: number): value is string => typeof value === 'string' && value.length <= limit;
const list = (value: unknown, limit: number, check: (item: unknown) => boolean) =>
  Array.isArray(value) && value.length <= limit && value.every(check);
const challengeMode = (mode: unknown): mode is ChallengeMode => mode === 'letters' || mode === 'mixed';
const challengeScore = (score: unknown): score is number => typeof score === 'number' && Number.isInteger(score) && score >= 0 && score <= 20;

function validChallenge(value: unknown): value is ChallengeScores {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) &&
    Object.entries(value as ChallengeScores).every(([mode, result]) => challengeMode(mode) && result &&
      challengeScore(result.latest) && challengeScore(result.best) && result.best >= result.latest));
}

function validProgress(value: unknown): value is Progress {
  if (!value || typeof value !== 'object') return false;
  const progress = value as Progress;
  return typeof progress.sound === 'boolean' && text(progress.resume, 160) &&
    list(progress.completed, 10000, (id) => text(id, 100)) &&
    list(progress.badges, 12, (id) => text(id, 40)) && list(progress.attempts, 300, (value) => {
    if (!value || typeof value !== 'object') return false;
    const attempt = value as Progress['attempts'][number];
    return text(attempt.id, 100) && text(attempt.title, 100) &&
      ['lesson','check','match','memory','quick','spell','daily','camera','quiz'].includes(attempt.activity) &&
      text(attempt.date, 10) && /^\d{4}-\d{2}-\d{2}$/.test(attempt.date) &&
      Number.isInteger(attempt.total) && Number.isInteger(attempt.score) &&
      attempt.score >= 0 && attempt.total > 0 && attempt.total <= 100 && attempt.score <= attempt.total &&
      (attempt.lesson === undefined || text(attempt.lesson, 100)) && list(attempt.missed, 100, (term) => text(term, 60));
    });
}

function load(file?: string): AccountFile {
  if (file) {
    try {
      const data = JSON.parse(readFileSync(file, 'utf8')) as AccountFile;
      if (data.version !== 1 || !Array.isArray(data.students) ||
        !data.students.every((student) => student && text(student.id, 100) && text(student.name, 40) && validProgress(student.progress) &&
          (student.challenge === undefined || validChallenge(student.challenge))) ||
        (data.password && (!/^[a-f0-9]{32}$/.test(data.password.salt) || !/^[a-f0-9]{64}$/.test(data.password.digest)))) {
        throw new Error('Could not read the local classroom file.');
      }
      return data;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return { version: 1, students: [] };
}

export function localAccounts(file?: string) {
  const data = load(file);
  let role: 'teacher' | 'student' | undefined;
  let currentStudent: string | undefined;
  let failed = 0;
  let lockedUntil = 0;
  const student = (id: unknown) => data.students.find((user) => user.id === id);
  const publicStudent = ({ id, name }: Record): Student => ({ id, name });
  const ranking = (mode: ChallengeMode) => data.students.flatMap(({ id, name, challenge }) => {
    const score = challenge?.[mode];
    return score ? [{ id, name, best: score.best }] : [];
  }).sort((left, right) => right.best - left.best || left.name.localeCompare(right.name));
  const state = (): AccountState => {
    const selected = student(currentStudent);
    return {
      students: data.students.map(publicStudent),
      challenge: role === 'student' && selected ? {
        scores: selected.challenge ?? {}, leaderboard: { letters: ranking('letters'), mixed: ranking('mixed') },
      } : undefined,
      active: role === 'teacher' ? { role, setup: !data.password }
        : role === 'student' && selected ? { role, student: publicStudent(selected), progress: selected.progress } : null,
    };
  };
  const save = (next: AccountFile) => {
    if (file) {
      mkdirSync(dirname(file), { recursive: true });
      const pending = file + '.tmp';
      writeFileSync(pending, JSON.stringify(next), { encoding: 'utf8', mode: 0o600, flush: true });
      renameSync(pending, file);
    }
    Object.assign(data, next);
  };
  const teacher = () => {
    if (role !== 'teacher' || !data.password) throw new Error('Sign in as the teacher first.');
  };
  const checkPassword = (value: unknown) => {
    if (Date.now() < lockedUntil) throw new Error('Take a short break, then try again.');
    const saved = data.password ?? starter;
    const correct = text(value, 128) && timingSafeEqual(scryptSync(value, saved.salt, 32), Buffer.from(saved.digest, 'hex'));
    if (!correct) {
      if (++failed >= 5) { failed = 0; lockedUntil = Date.now() + 30000; }
      throw new Error('That password does not match.');
    }
    failed = 0;
  };
  const nameFor = (value: unknown) => {
    if (!text(value, 40) || !value.trim() || /[\x00-\x1f\x7f]/.test(value)) throw new Error('Enter a name using 1 to 40 characters.');
    return value.trim();
  };
  const requireStudent = (id: unknown) => {
    const selected = student(id);
    if (!selected) throw new Error('That student is no longer in this classroom.');
    return selected;
  };

  return (command: AccountCommand): AccountReply => {
    try {
      let progress: Progress | undefined;
      switch (command?.action) {
        case 'state': break;
        case 'logout': role = undefined; currentStudent = undefined; break;
        case 'create': {
          const next = { id: randomUUID(), name: nameFor(command.name), progress: emptyProgress() };
          if (data.students.some((user) => user.name.toLowerCase() === next.name.toLowerCase())) throw new Error('That name is already on the list. Choose it to sign in.');
          save({ ...data, students: [...data.students, next] });
          role = 'student';
          currentStudent = next.id;
          break;
        }
        case 'select': currentStudent = requireStudent(command.id).id; role = 'student'; break;
        case 'login': checkPassword(command.password); role = 'teacher'; currentStudent = undefined; break;
        case 'password': {
          if (role !== 'teacher') throw new Error('Sign in as the teacher first.');
          checkPassword(command.current);
          if (!text(command.password, 128) || command.password.length < 8 || !command.password.trim()) throw new Error('Choose a password with at least 8 characters.');
          if (command.password === command.current) throw new Error('Choose a different password.');
          const salt = randomBytes(16).toString('hex');
          save({ ...data, password: { salt, digest: scryptSync(command.password, salt, 32).toString('hex') } });
          break;
        }
        case 'rename': {
          teacher();
          const selected = requireStudent(command.id);
          const name = nameFor(command.name);
          if (data.students.some((user) => user.id !== selected.id && user.name.toLowerCase() === name.toLowerCase())) throw new Error('That name is already on the list.');
          save({ ...data, students: data.students.map((user) => user.id === selected.id ? { ...user, name } : user) });
          break;
        }
        case 'remove':
          teacher();
          requireStudent(command.id);
          save({ ...data, students: data.students.filter((user) => user.id !== command.id) });
          break;
        case 'student-progress':
          teacher();
          progress = requireStudent(command.id).progress;
          break;
        case 'save-challenge': {
          const { mode, score } = command;
          if (role !== 'student' || !challengeMode(mode) || !challengeScore(score)) throw new Error('Could not save this challenge score.');
          const selected = requireStudent(currentStudent);
          const best = Math.max(score, selected.challenge?.[mode]?.best ?? 0);
          save({ ...data, students: data.students.map((user) => user.id === selected.id
            ? { ...user, challenge: { ...user.challenge, [mode]: { best, latest: score } } } : user) });
          break;
        }
        case 'save-progress': {
          if (role !== 'student' || currentStudent !== command.id || !validProgress(command.progress)) throw new Error('Could not save your progress.');
          const selected = requireStudent(command.id);
          save({ ...data, students: data.students.map((user) => user.id === selected.id ? { ...user, progress: command.progress } : user) });
          break;
        }
        default: throw new Error('That account action is unavailable.');
      }
      return { ok: true, state: state(), progress };
    } catch (error) {
      return { ok: false, error: (error as NodeJS.ErrnoException).code ? 'Could not save your changes on this device.' : error instanceof Error ? error.message : 'Could not open your account.' };
    }
  };
}
