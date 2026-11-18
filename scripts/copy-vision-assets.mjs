import { createHash } from 'node:crypto';
import { copyFile, cp, mkdir, readFile } from 'node:fs/promises';

const source = new URL('../model-training/artifacts/', import.meta.url);
const target = new URL('../dist/vision/', import.meta.url);
const modelName = 'fsl-az-v2.task';
const model = new URL(modelName, source);
const profile = new URL('fsl-az-v2.json', source);
const benchmark = JSON.parse(await readFile(profile, 'utf8'));
const checksum = createHash('sha256').update(await readFile(model)).digest('hex');

if (benchmark.model !== modelName || checksum !== benchmark.model_sha256 || benchmark.labels.join('') !== 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
  throw new Error('The bundled alphabet model differs from its report.');
}

await mkdir(target, { recursive: true });
await copyFile(model, new URL(modelName, target));
await copyFile(profile, new URL('benchmark.json', target));
await cp(new URL('../node_modules/@mediapipe/tasks-vision/wasm/', import.meta.url), new URL('wasm/', target), { recursive: true });
