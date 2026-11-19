import { useEffect, useState } from 'react';
import { cameraSupports, isLabel, labels, type Label } from './letters';
import type { Prompt, QuizPlan } from './quiz';
import { vocabulary, vocabularyExample, vocabularyVideo } from './vocabulary';

export type Step =
  | { id: string; kind: 'look' | 'match' | 'camera' | 'video'; letter: Label | ''; image?: File; video?: File }
  | { id: string; kind: 'media'; term: string; example?: string; image?: File; video?: File }
  | { id: string; kind: 'spell'; word: string };

export const categories = [
  { id: 'alphabet', title: 'Alphabet & Letters', detail: 'Learn the signs for A to Z.', mark: 'Aa', tone: 'mint' },
  { id: 'numbers', title: 'Numbers', detail: 'Practice counting signs.', mark: '123', tone: 'sky' },
  { id: 'greetings', title: 'Everyday Greetings', detail: 'Say hello and more.', mark: 'Hi', tone: 'peach' },
  { id: 'family', title: 'Family Members', detail: 'Signs for people close to you.', mark: '♥', tone: 'yellow' },
  { id: 'food', title: 'Food & Colors', detail: 'Sign things you see every day.', mark: '✦', tone: 'mint' },
  { id: 'words', title: 'Words', detail: 'Explore more everyday signs.', mark: 'W', tone: 'sky' },
  { id: 'days', title: 'Days & Time', detail: 'Sign today, tomorrow, and the days of the week.', mark: '☀', tone: 'yellow' },
  { id: 'months', title: 'Calendar', detail: 'Learn the months of the year.', mark: 'Jan', tone: 'peach' },
  { id: 'people', title: 'People', detail: 'Learn signs for people and relationships.', mark: '☺', tone: 'mint' },
  { id: 'drinks', title: 'Drinks & Flavors', detail: 'Learn signs for drinks and how to order them.', mark: '☕', tone: 'sky' },
  { id: 'errands', title: 'Everyday Errands', detail: 'Practice signs for asking for help and shopping.', mark: '★', tone: 'yellow' },
] as const;
export type Category = typeof categories[number]['id'];
export const categoryFor = (id?: string) => categories.find((category) => category.id === id) ?? categories[0];
export type Lesson = { id: string; title: string; steps: Step[]; revision: number; category?: Category; quiz?: QuizPlan<string> };
export type TeacherLesson = { id: string; draft: Lesson; published?: Lesson; starter?: boolean; hidden?: boolean };

function vocabularyLessons(): TeacherLesson[] {
  return vocabulary.map(({ id, title, category, terms }) => {
    const ready = terms.every((term) => Boolean(term.source));
    const lesson: Lesson = {
      id, title, category, revision: 1,
      steps: terms.map((term, index) => ({ id: id + '-' + index, kind: 'media', term: term.term, example: term.id })),
      quiz: ready ? { count: Math.min(3, terms.length), prompts: terms.map((term) => ({ letter: term.term, kind: 'match' })) } : undefined,
    };
    return { id, draft: lesson, published: ready ? lesson : undefined };
  });
}

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
    ? isLabel(step.letter) ? [step.letter] : [] : step.kind === 'spell' ? [...step.word].filter(isLabel) : []))];
}

export function lessonTerms(lesson: Lesson) {
  return lesson.category && lesson.category !== 'alphabet'
    ? [...new Set(lesson.steps.flatMap((step) => step.kind === 'media' && step.term.trim() && hasTermMedia(step) ? [step.term.trim()] : []))]
    : lessonLetters(lesson);
}

type MediaStep = Extract<Step, { kind: 'media' }>;
export const hasTermMedia = (step: MediaStep) => Boolean(step.image || step.video || vocabularyVideo(step.example));

export function termMedia(lesson: Lesson, term: string) {
  return lesson.steps.find((step): step is MediaStep => step.kind === 'media' && step.term.trim() === term && hasTermMedia(step));
}

export function termCamera(step?: MediaStep) {
  const example = vocabularyExample(step?.example);
  return example?.camera && example.term === step?.term.trim() ? example.id : undefined;
}

export function quizCamera(lesson: Lesson, term: string) {
  return categoryFor(lesson.category).id === 'alphabet' ? cameraSupports(term) : Boolean(termCamera(termMedia(lesson, term)));
}

export function signImage(lesson: Lesson, label: Label) {
  for (const step of lesson.steps) if ('letter' in step && step.letter === label && step.image) return step.image;
}

export function quizFor(lesson: Lesson): QuizPlan<string> | undefined {
  const plan = lesson.quiz;
  const terms: string[] = lessonTerms(lesson);
  if (!plan || terms.length < 2) return;
  const unique = new Map<string, Prompt<string>>();
  for (const { letter, kind } of plan.prompts) {
    if (!terms.includes(letter)) continue;
    const format = kind === 'camera' && quizCamera(lesson, letter) ? 'camera' : 'match';
    unique.set(letter + ':' + format, { letter, kind: format });
  }
  const prompts = [...unique.values()];
  const count = Math.min(plan.count, prompts.length, 10);
  if (count > 0) return { count, prompts };
}

function openLessons() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('ab-sign-lessons', 4);
    let blocked = false;
    request.onupgradeneeded = (event) => {
      const store = event.oldVersion === 0 ? request.result.createObjectStore('lessons', { keyPath: 'id' }) : request.transaction!.objectStore('lessons');
      for (const item of [...starterLessons(), ...vocabularyLessons()]) {
        const existing = store.getKey(item.id);
        existing.onsuccess = () => { if (existing.result === undefined) store.add(item); };
      }
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

export function useTeacherLessons(canEdit: boolean) {
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
    if (!canEdit) throw new Error('Teacher sign-in required.');
    await access('readwrite', (store) => store.put(item));
    setItems((current) => current.some(({ id }) => id === item.id) ? current.map((value) => value.id === item.id ? item : value) : [...current, item]);
  };
  const showStarters = async (visible: boolean) => {
    if (!canEdit) throw new Error('Teacher sign-in required.');
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
  return { items: canEdit ? items : [], visible, status, save, showStarters };
}

export type TeacherLibrary = ReturnType<typeof useTeacherLessons>;
