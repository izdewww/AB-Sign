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
await cp(new URL('../node_modules/@mediapipe/tasks-vision/wasm/', import.meta.url), new URL('wasm/', target), { recursive: true });
