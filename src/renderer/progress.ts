import { letters } from './letters';

export type Progress = { rounds: number; best: number; latest: number };
const key = 'ab-sign.progress.v1';
export const emptyRounds: Progress = { rounds: 0, best: 0, latest: 0 };

export function validRounds(data: Partial<Progress> | null): data is Progress {
  const validScore = (score: unknown): score is number =>
    typeof score === 'number' && Number.isInteger(score) && score >= 0 && score <= letters.length;
  return data !== null && typeof data === 'object' && typeof data.rounds === 'number' &&
    Number.isSafeInteger(data.rounds) && data.rounds >= 0 && validScore(data.latest) &&
    validScore(data.best) && data.best >= data.latest && (data.rounds > 0 || data.best === 0);
}

export function readProgress(): Progress {
  try {
    const saved = localStorage.getItem(key);
    if (saved === null) return emptyRounds;
    const data = JSON.parse(saved);
    if (validRounds(data)) {
      return { rounds: data.rounds, best: data.best, latest: data.latest };
    }
  } catch {
    // A fresh summary lets learners continue when storage is unavailable.
  }
  return emptyRounds;
}

export function addRound(previous: Progress, score: number): Progress {
  return {
    rounds: Math.min(previous.rounds + 1, Number.MAX_SAFE_INTEGER),
    best: Math.max(previous.best, score),
    latest: score,
  };
}

export function discardLegacyRounds() {
  localStorage.removeItem(key);
}
