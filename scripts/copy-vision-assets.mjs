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
const modelBuf = await readFile(model);
const checksum = createHash('sha256').update(modelBuf).digest('hex');
const geometryRaw = await readFile(geometry);
let geometryBuf = geometryRaw;
let geometryChecksum = createHash('sha256').update(geometryRaw).digest('hex');

if (geometryChecksum !== benchmark.model_sha256) {
  const normalized = Buffer.from(geometryRaw.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
  if (createHash('sha256').update(normalized).digest('hex') === benchmark.model_sha256) {
    geometryChecksum = benchmark.model_sha256;
    geometryBuf = normalized;
  }
}

if (benchmark.detector !== modelName || checksum !== benchmark.detector_sha256 ||
  benchmark.model !== geometryName || geometryChecksum !== benchmark.model_sha256 ||
  benchmark.labels.join('') !== 'ABCDEFGHIKLMNOPQRSTUVWXY') {
  throw new Error('The bundled alphabet model differs from its report.');
}

await mkdir(target, { recursive: true });
await copyFile(model, new URL(modelName, target));
const { writeFile } = await import('node:fs/promises');
await writeFile(new URL(geometryName, target), geometryBuf);
await copyFile(profile, new URL('benchmark.json', target));

const vocabularyReport = 'fsl-vocabulary-v1-benchmark.json';
const vocabularyBenchmark = JSON.parse(await readFile(new URL(vocabularyReport, source), 'utf8'));
const numberReport = 'fsl-numbers-v3-benchmark.json';
const numbers = JSON.parse(await readFile(new URL(numberReport, source), 'utf8'));
const catalog = JSON.parse(await readFile(new URL('../src/renderer/vocabulary.json', import.meta.url), 'utf8'));
const terms = catalog.flatMap(({ terms }) => terms);
if (terms.filter(({ camera }) => camera).map(({ id }) => id).sort().join(',') !== numbers.labels.join(',')) {
  throw new Error('The number camera list differs from its report.');
}
for (const term of terms.filter(({ source }) => source)) {
  const clip = new URL(`../dist/vocabulary/fsl-${term.id}.webm`, import.meta.url);
  if (!(await readFile(clip)).length) throw new Error(`Empty sign video for ${term.term}.`);
}
for (const [name, expected] of [
  [numbers.model, numbers.model_sha256],
  ['vocabulary-hands.task', vocabularyBenchmark.hands_sha256],
  ['vocabulary-pose.task', vocabularyBenchmark.pose_sha256],
]) {
  const asset = new URL(name, source);
  const rawAsset = await readFile(asset);
  let assetBuf = rawAsset;
  let assetChecksum = createHash('sha256').update(rawAsset).digest('hex');
  if (assetChecksum !== expected && name.endsWith('.json')) {
    const normalized = Buffer.from(rawAsset.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
    if (createHash('sha256').update(normalized).digest('hex') === expected) {
      assetChecksum = expected;
      assetBuf = normalized;
    }
  }
  if (assetChecksum !== expected) {
    throw new Error(`The bundled vocabulary asset ${name} differs from its report.`);
  }
  await writeFile(new URL(name, target), assetBuf);
}
await copyFile(new URL(numberReport, source), new URL(numberReport, target));
await cp(new URL('../node_modules/@mediapipe/tasks-vision/wasm/', import.meta.url), new URL('wasm/', target), { recursive: true });
