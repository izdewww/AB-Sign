import { createHash } from 'node:crypto';
import { copyFile, cp, mkdir, readFile } from 'node:fs/promises';

const source = new URL('../model-training/artifacts/', import.meta.url);
const target = new URL('../dist/vision/', import.meta.url);
const modelName = 'fsl-az-v2.task';
const geometryName = 'fsl-geometry-v3.json';
const model = new URL(modelName, source);
const geometry = new URL(geometryName, source);
const profile = new URL('fsl-geometry-v3-benchmark.json', source);
const benchmark = JSON.parse(await readFile(profile, 'utf8'));
const checksum = createHash('sha256').update(await readFile(model)).digest('hex');
const geometryChecksum = createHash('sha256').update(await readFile(geometry)).digest('hex');

if (benchmark.detector !== modelName || checksum !== benchmark.detector_sha256 ||
  benchmark.model !== geometryName || geometryChecksum !== benchmark.model_sha256 ||
  benchmark.labels.join('') !== 'ABCDEFGHIKLMNOPQRSTUVWXY') {
  throw new Error('The bundled alphabet model differs from its report.');
}

await mkdir(target, { recursive: true });
await copyFile(model, new URL(modelName, target));
await copyFile(geometry, new URL(geometryName, target));
await copyFile(profile, new URL('benchmark.json', target));

const vocabularyReport = 'fsl-vocabulary-v1-benchmark.json';
const vocabularyBenchmark = JSON.parse(await readFile(new URL(vocabularyReport, source), 'utf8'));
const wordReport = 'fsl-words-v3-benchmark.json';
const wordBenchmark = JSON.parse(await readFile(new URL(wordReport, source), 'utf8'));
const catalog = JSON.parse(await readFile(new URL('../src/renderer/vocabulary.json', import.meta.url), 'utf8'));
const terms = catalog.flatMap(({ terms }) => terms);
const enabled = [...vocabularyBenchmark.camera.map(({ id }) => id).filter((id) => /^2\d$/.test(id)), ...wordBenchmark.combined.passing];
if (terms.filter(({ camera }) => camera).map(({ id }) => id).sort().join(',') !== enabled.sort().join(',')) {
  throw new Error('The vocabulary camera list differs from its report.');
}
for (const term of terms.filter(({ source }) => source)) {
  const clip = new URL(`../dist/vocabulary/fsl-${term.id}.webm`, import.meta.url);
  if (!(await readFile(clip)).length) throw new Error(`Empty sign video for ${term.term}.`);
}
for (const [name, expected] of [
  ['fsl-vocabulary-v1.json', vocabularyBenchmark.model_sha256],
  ['fsl-words-v3.json', wordBenchmark.model_sha256],
  ['vocabulary-hands.task', vocabularyBenchmark.hands_sha256],
  ['vocabulary-pose.task', vocabularyBenchmark.pose_sha256],
]) {
  const asset = new URL(name, source);
  if (createHash('sha256').update(await readFile(asset)).digest('hex') !== expected) {
    throw new Error(`The bundled vocabulary asset ${name} differs from its report.`);
  }
  await copyFile(asset, new URL(name, target));
}
await copyFile(new URL(vocabularyReport, source), new URL(vocabularyReport, target));
await copyFile(new URL(wordReport, source), new URL(wordReport, target));
await cp(new URL('../node_modules/@mediapipe/tasks-vision/wasm/', import.meta.url), new URL('wasm/', target), { recursive: true });
