import { createHash } from 'node:crypto';
import { copyFile, cp, mkdir, readFile } from 'node:fs/promises';

const source = new URL('../model-training/artifacts/', import.meta.url);
const target = new URL('../dist/vision/', import.meta.url);
const model = new URL('fsl-abc-v1.task', source);
const baseline = JSON.parse(await readFile(new URL('fsl-abc-v1.json', source), 'utf8'));
const profile = new URL('fsl-abc-v2.json', source);
const checksum = createHash('sha256').update(await readFile(model)).digest('hex');

if (checksum !== baseline.model_sha256) throw new Error('The bundled A/B/C model checksum differs from its report.');

await mkdir(target, { recursive: true });
await copyFile(model, new URL('fsl-abc-v1.task', target));
await copyFile(profile, new URL('benchmark.json', target));
await cp(new URL('../node_modules/@mediapipe/tasks-vision/wasm/', import.meta.url), new URL('wasm/', target), { recursive: true });
