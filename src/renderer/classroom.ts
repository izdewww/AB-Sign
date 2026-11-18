import { useState } from 'react';
import { isLabel, type Letter } from './letters';
import { addRound, discardLegacyRounds, emptyRounds, readProgress, validRounds, type Progress } from './progress';

export type Label = Letter['label'];
export type Activity = 'lesson' | 'check' | 'match' | 'memory' | 'quick' | 'spell' | 'daily' | 'camera' | 'quiz';
export type Attempt = {
  id: string;
  activity: Activity;
  title: string;
  score: number;
  total: number;
  date: string;
  missed: Label[];
  lesson?: string;
};

type Classroom = {
  setup: boolean;
  name: string;
  color: 'peach' | 'mint' | 'sky';
  level: 'start' | 'review';
  attempts: Attempt[];
  completed: string[];
  resume: string;
  daily: string;
  badge: boolean;
  sound: boolean;
  matching: Progress;
};

const key = 'ab-sign.classroom.v1';
const blank: Classroom = {
  setup: false, name: '', color: 'peach', level: 'start', attempts: [], completed: [], resume: '', daily: '', badge: false, sound: false, matching: emptyRounds,
};
const activities: Activity[] = ['lesson', 'check', 'match', 'memory', 'quick', 'spell', 'daily', 'camera', 'quiz'];

function validAttempt(value: unknown): value is Attempt {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Attempt;
  return typeof item.id === 'string' && typeof item.title === 'string' && activities.includes(item.activity) &&
    typeof item.date === 'string' && Number.isInteger(item.score) && Number.isInteger(item.total) &&
    item.score >= 0 && item.total > 0 && item.score <= item.total && Array.isArray(item.missed) &&
    item.missed.every(isLabel) &&
    (item.lesson === undefined || typeof item.lesson === 'string');
}

function readClassroom(): Classroom {
  try {
    const text = localStorage.getItem(key);
    const data = text ? JSON.parse(text) : null;
    if (!data || typeof data !== 'object') return { ...blank, matching: readProgress() };
    return {
      setup: data.setup === true,
      name: typeof data.name === 'string' ? data.name.slice(0, 24) : '',
      color: ['peach', 'mint', 'sky'].includes(data.color) ? data.color : blank.color,
      level: data.level === 'review' ? 'review' : 'start',
      attempts: Array.isArray(data.attempts) ? data.attempts.filter(validAttempt).slice(0, 300) : [],
      completed: Array.isArray(data.completed) ? data.completed.filter((id: unknown) => typeof id === 'string') : [],
      resume: typeof data.resume === 'string' && /^(lesson\/[a-z0-9-]+\/(demo|practice)\/\d+|lesson\/[a-z0-9-]+\/quiz)$/.test(data.resume) ? data.resume : '',
      daily: typeof data.daily === 'string' ? data.daily : '',
      badge: data.badge === true,
      sound: data.sound === true,
      matching: validRounds(data.matching ?? null) ? data.matching : readProgress(),
    };
  } catch {
    return { ...blank, matching: readProgress() };
  }
}

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

export const passed = (score: number, total: number) => score * 10 >= total * 7;

export function useClassroom() {
  const [data, setData] = useState(readClassroom);
  const [saveFailed, setSaveFailed] = useState(false);

  const save = (next: Classroom) => {
    try {
      localStorage.setItem(key, JSON.stringify(next));
      discardLegacyRounds();
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
    setData(next);
  };

  return {
    data, saveFailed,
    update: (changes: Partial<Classroom>) => save({ ...data, ...changes }),
    complete: (id: string) => save({ ...data, completed: [...new Set([...data.completed, id])], resume: '' }),
    record: (result: Omit<Attempt, 'id' | 'date'>) => {
      const attempt = { ...result, id: crypto.randomUUID(), date: today() };
      const pass = passed(attempt.score, attempt.total);
      save({
        ...data,
        attempts: [attempt, ...data.attempts].slice(0, 300),
        completed: attempt.activity === 'lesson' && attempt.lesson && pass
          ? [...new Set([...data.completed, attempt.lesson])] : data.completed,
        badge: data.badge || (attempt.activity === 'check' && pass),
        daily: attempt.activity === 'daily' ? attempt.date : data.daily,
        matching: attempt.activity === 'match' ? addRound(data.matching, attempt.score) : data.matching,
        resume: attempt.activity === 'lesson' && pass ? '' : data.resume,
      });
      return attempt.id;
    },
    reset: () => save({ ...blank, setup: data.setup, name: data.name, color: data.color, level: data.level, sound: data.sound }),
  };
}

export type ClassroomStore = ReturnType<typeof useClassroom>;
