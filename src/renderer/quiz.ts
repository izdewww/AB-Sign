import type { Label } from './letters';

export type Prompt = { letter: Label; kind: 'match' | 'camera' };
export type QuizPlan = { count: number; prompts: Prompt[] };
export type Question = Prompt & { choices: Label[] };

export function shuffle<T>(values: readonly T[], random = Math.random): T[] {
  const order = [...values];
  for (let index = order.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [order[index], order[other]] = [order[other], order[index]];
  }
  return order;
}

export function makeQuiz(plan: QuizPlan, letters: readonly Label[], random = Math.random): Question[] {
  const order = shuffle(plan.prompts, random);
  const chosen = order.slice(0, plan.count);
  // Keep both formats in a mixed round whenever there is room for both.
  if (chosen.length > 1 && chosen.every(({ kind }) => kind === chosen[0].kind)) {
    const alternate = order.find(({ kind }) => kind !== chosen[0].kind);
    if (alternate) chosen[chosen.length - 1] = alternate;
  }
  return shuffle(chosen, random).map((prompt) => ({
    ...prompt,
    choices: shuffle([prompt.letter, ...shuffle(letters.filter((label) => label !== prompt.letter), random).slice(0, 2)], random),
  }));
}
