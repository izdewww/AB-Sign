import data from './vocabulary.json';
import type { Category } from './lessons';

export type VocabularyExample = { id?: string; term: string; camera: boolean; source?: string };
export const vocabulary = data as { id: string; category: Exclude<Category, 'alphabet'>; title: string; terms: VocabularyExample[] }[];
const examples = new Map(vocabulary.flatMap((lesson) => lesson.terms.flatMap((example) => example.id ? [[example.id, example] as const] : [])));

export function vocabularyExample(id?: string) {
  return id ? examples.get(id) : undefined;
}

export function vocabularyVideo(id?: string) {
  const example = vocabularyExample(id);
  return example?.source ? '/vocabulary/fsl-' + example.id + '.webm' : undefined;
}
