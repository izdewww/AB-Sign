import { useRef, useState } from 'react';
import type { Attempt, Progress } from '../main/account-types.cjs';
import type { Label } from './letters';

export type { Attempt, Label };

export function today(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function streak(attempts: Attempt[]) {
  const active = new Set(attempts.map(({ date }) => date));
  const date = new Date();
  if (!active.has(today(date))) date.setDate(date.getDate() - 1);
  let days = 0;
  while (active.has(today(date))) {
    days++;
    date.setDate(date.getDate() - 1);
  }
  return days;
}

const blank = (): Progress => ({ attempts: [], completed: [], badges: [], resume: '', sound: false });

export function useClassroom(student?: { id: string; progress: Progress }) {
  const [data, setData] = useState(() => student?.progress ?? blank());
  const current = useRef(data);
  const [saveFailed, setSaveFailed] = useState(false);

  const save = (next: Progress) => {
    current.current = next;
    setData(next);
    if (student) void window.localAccounts.request({ action: 'save-progress', id: student.id, progress: next })
      .then((reply) => setSaveFailed(!reply.ok), () => setSaveFailed(true));
  };

  return {
    data, saveFailed,
    update: (changes: Partial<Progress>) => save({ ...current.current, ...changes }),
    complete: (id: string, badge?: string) => {
      const saved = current.current;
      save({ ...saved, completed: [...new Set([...saved.completed, id])], resume: '',
        badges: badge ? [...new Set([...saved.badges, badge])] : saved.badges });
    },
    record: (result: Omit<Attempt, 'id' | 'date'>) => {
      const attempt = { ...result, id: crypto.randomUUID(), date: today() };
      const saved = current.current;
      save({ ...saved, attempts: [attempt, ...saved.attempts].slice(0, 300) });
      return attempt.id;
    },
    reset: () => save({ ...blank(), sound: current.current.sound }),
  };
}

export type ClassroomStore = ReturnType<typeof useClassroom>;
