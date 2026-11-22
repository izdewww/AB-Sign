import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { makeQuiz } from '../src/renderer/quiz.ts';

test('the starter curriculum limits vocabulary camera practice to numbers 1–10', () => {
  const catalog = JSON.parse(readFileSync(new URL('../src/renderer/vocabulary.json', import.meta.url), 'utf8'));
  const terms = (category) => catalog.filter((lesson) => lesson.category === category).flatMap((lesson) => lesson.terms);
  assert.deepEqual([...new Set(catalog.map((lesson) => lesson.category))], ['numbers', 'greetings', 'people']);
  assert.deepEqual(terms('numbers').map(({ term }) => Number(term)), Array.from({ length: 100 }, (_, index) => index + 1));
  assert.equal(terms('greetings').length, 30);
  assert.equal(terms('people').length, 30);
  assert.deepEqual(catalog.flatMap(({ terms }) => terms).filter(({ camera }) => camera).map(({ term }) => Number(term)),
    Array.from({ length: 10 }, (_, index) => index + 1));
});

function seeded(seed) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

test('lesson questions and answer positions vary within the chosen pool', () => {
  const letters = ['B', 'C', 'D', 'X'];
  const prompts = [
    { letter: 'B', kind: 'match' },
    { letter: 'B', kind: 'camera' },
    { letter: 'C', kind: 'camera' },
    { letter: 'D', kind: 'match' },
    { letter: 'X', kind: 'match' },
  ];
  const sequences = new Set();
  const correctPositions = new Set();
  const distractorsForB = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const questions = makeQuiz({ count: 3, prompts }, letters, seeded(seed));
    assert.equal(questions.length, 3);
    assert.equal(new Set(questions.map(({ letter, kind }) => letter + kind)).size, 3);
    assert.equal(new Set(questions.map(({ kind }) => kind)).size, 2);
    for (const { letter, kind, choices } of questions) {
      assert.ok(prompts.some((prompt) => prompt.letter === letter && prompt.kind === kind));
      assert.equal(new Set(choices).size, 3);
      assert.ok(choices.includes(letter) && choices.every((choice) => letters.includes(choice)));
      correctPositions.add(choices.indexOf(letter));
      if (letter === 'B') distractorsForB.add(choices.filter((choice) => choice !== letter).sort().join(''));
    }
    sequences.add(questions.map(({ letter, kind }) => letter + kind).join('|'));
  }
  assert.ok(sequences.size > 6, 'prompt order and selection are not fixed');
  assert.equal(correctPositions.size, 3);
  assert.equal(distractorsForB.size, 3);
});

test('a two-letter lesson keeps both choices without adding an outside sign', () => {
  const [question] = makeQuiz({ count: 1, prompts: [{ letter: 'Y', kind: 'match' }] }, ['Y', 'Z'], seeded(5));
  assert.deepEqual(question.choices.toSorted(), ['Y', 'Z']);
});

test('bundled practice covers every sign once and shuffles only eligible camera questions', () => {
  const signs = ['1', '2', '3', '4', '5'];
  const supported = ['1', '3', '5'];
  const prompts = signs.map(letter => ({ letter, kind: 'match' }));
  for (const letter of supported) prompts.push({ letter, kind: 'camera' });
  const cameraSigns = new Set();
  const orders = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const round = makeQuiz({ count: signs.length, prompts, perSign: true }, signs, seeded(seed));
    assert.deepEqual(round.map(({ letter }) => letter).sort(), signs);
    assert.equal(new Set(round.map(({ kind }) => kind)).size, 2);
    for (const { letter, kind } of round) if (kind === 'camera') {
      assert.ok(supported.includes(letter));
      cameraSigns.add(letter);
    }
    orders.add(round.map(({ letter }) => letter).join(''));
  }
  assert.deepEqual([...cameraSigns].sort(), supported);
  assert.ok(orders.size > 6);
});
