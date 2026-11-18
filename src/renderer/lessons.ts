import { useEffect, useState } from 'react';
import { cameraSupports, isLabel, labels, type Label } from './letters';
import type { Prompt, QuizPlan } from './quiz';

export type Step =
  | { id: string; kind: 'look' | 'match' | 'camera' | 'video'; letter: Label | ''; image?: File; video?: File }
  | { id: string; kind: 'spell'; word: string };

export type Lesson = { id: string; title: string; steps: Step[]; revision: number; quiz?: QuizPlan };
export type TeacherLesson = { id: string; draft: Lesson; published?: Lesson; starter?: boolean; hidden?: boolean };

function starterLessons(): TeacherLesson[] {
  return Array.from({ length: Math.ceil(labels.length / 3) }, (_, index) => {
    const group = labels.slice(index * 3, index * 3 + 3);
    const prompts = group.flatMap<Prompt>((letter) => cameraSupports(letter)
      ? [{ letter, kind: 'match' as const }, { letter, kind: 'camera' as const }]
      : [{ letter, kind: 'match' as const }]);
    const lesson: Lesson = {
      id: `alphabet-${index + 1}`, title: `Letters ${group.join(', ')}`, revision: 1,
      steps: group.map((letter) => ({ id: `sign-${letter.toLowerCase()}`, kind: 'look', letter })),
      quiz: { count: Math.min(3, prompts.length), prompts },
    };
    return { id: lesson.id, draft: lesson, published: lesson, starter: true };
  });
}

export function lessonLetters(lesson: Lesson) {
  return [...new Set(lesson.steps.flatMap((step) => 'letter' in step
    ? isLabel(step.letter) ? [step.letter] : [] : [...step.word].filter(isLabel)))];
}

export function signImage(lesson: Lesson, label: Label) {
  for (const step of lesson.steps) if ('letter' in step && step.letter === label && step.image) return step.image;
}

export function quizFor(lesson: Lesson): QuizPlan | undefined {
  const plan = lesson.quiz;
  const letters = lessonLetters(lesson);
  if (!plan || letters.length < 2) return;
  const unique = new Map<string, Prompt>();
  for (const { letter, kind } of plan.prompts) {
    if (!letters.includes(letter)) continue;
    const format = kind === 'camera' && cameraSupports(letter) ? 'camera' : 'match';
    unique.set(letter + ':' + format, { letter, kind: format });
  }
  const prompts = [...unique.values()];
  const count = Math.min(plan.count, prompts.length, 10);
  if (count > 0) return { count, prompts };
}

function openLessons() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('ab-sign-lessons', 2);
    let blocked = false;
    request.onupgradeneeded = (event) => {
      const store = event.oldVersion === 0 ? request.result.createObjectStore('lessons', { keyPath: 'id' }) : request.transaction!.objectStore('lessons');
      for (const item of starterLessons()) store.add(item);
    };
    request.onsuccess = () => { if (blocked) request.result.close(); else resolve(request.result); };
    request.onerror = () => reject(request.error);
    request.onblocked = () => { blocked = true; reject(new Error('Another app window is using the lesson library.')); };
  });
}

async function access<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await openLessons();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction('lessons', mode);
      const request = operation(transaction.objectStore('lessons'));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error ?? new Error('Lesson storage stopped.'));
      transaction.onerror = () => reject(transaction.error ?? request.error);
    });
  } finally {
    database.close();
  }
}

export function useTeacherLessons() {
  const [items, setItems] = useState<TeacherLesson[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let live = true;
    access('readonly', (store) => store.getAll()).then((list) => {
      if (live) { setItems(list); setStatus('ready'); }
    }).catch(() => { if (live) setStatus('error'); });
    return () => { live = false; };
  }, []);

  const save = async (item: TeacherLesson) => {
    await access('readwrite', (store) => store.put(item));
    setItems((current) => current.some(({ id }) => id === item.id) ? current.map((value) => value.id === item.id ? item : value) : [...current, item]);
  };
  const showStarters = async (visible: boolean) => {
    const changed = items.filter(({ starter }) => starter).map((item) => ({ ...item, hidden: !visible }));
    if (!changed.length) return;
    await access('readwrite', (store) => {
      let request: IDBRequest<IDBValidKey> | undefined;
      for (const item of changed) request = store.put(item);
      return request!;
    });
    setItems((current) => current.map((item) => item.starter ? { ...item, hidden: !visible } : item));
  };

  const visible = items.flatMap(({ published, hidden }) => published && !hidden ? [published] : []);
  return { items, visible, status, save, showStarters };
}

export type TeacherLibrary = ReturnType<typeof useTeacherLessons>;
