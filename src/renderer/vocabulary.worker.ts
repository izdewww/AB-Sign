import { FilesetResolver, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
import { classifyHand, type GeometryModel } from './geometry';

type NumberModel = GeometryModel & { frames: number; fps: number; minHands: number };
type Point = { x: number; y: number; z: number };
export type NumberCameraReport =
  | { kind: 'ready'; fps: number }
  | { kind: 'progress'; elapsed: number }
  | { kind: 'number'; id?: string; hands: boolean }
  | { kind: 'error'; message: string };

let hand: HandLandmarker | undefined;
let body: PoseLandmarker | undefined;
let model: NumberModel | undefined;
const sequence: number[][] = [];
let handsFound = 0;

function capture(pose: Point[], hands: Point[][], aspect: number) {
  if (pose.length < 33) return Array<number>(149).fill(0);
  const a = pose[11], b = pose[12];
  const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
  const scale = Math.max(.04, Math.hypot((a.x - b.x) * aspect, a.y - b.y));
  const coords = (points: Point[]) => points.flatMap(({ x, y, z }) =>
    [(x - center.x) * aspect / scale, (y - center.y) / scale, (z - center.z) / scale].map((value) => Math.max(-5, Math.min(5, value))));
  if (hands.some((points) => points.length === 21)) handsFound++;
  return [...coords([0, 11, 12, 13, 14, 15, 16].map((index) => pose[index])),
    ...hands.flatMap((points) => points.length === 21 ? [1, ...coords(points)] : Array<number>(64).fill(0))];
}

function send(report: NumberCameraReport) {
  self.postMessage(report);
}

function numberFeatures(frames: number[][]) {
  const shapes = frames.flatMap((frame) => [21, 85].flatMap((start) => {
    if (!frame[start]) return [];
    const shape = frame.slice(start + 1, start + 64).map((value, index) =>
      (value - frame[start + 1 + index % 3]) * (start === 21 && index % 3 === 0 ? -1 : 1));
    const size = Math.max(...Array.from({ length: 21 }, (_, index) => Math.hypot(...shape.slice(index * 3, index * 3 + 3))));
    return size > 1e-5 ? [shape.map((value) => value / size)] : [];
  }));
  if (!shapes.length) return Array<number>(252).fill(0);
  const columns = shapes[0].map((_, index) => shapes.map((shape) => shape[index]).sort((a, b) => a - b));
  const means = columns.map((values) => values.reduce((sum, value) => sum + value, 0) / values.length);
  const spread = columns.map((values, index) => Math.sqrt(values.reduce((sum, value) => sum + (value - means[index]) ** 2, 0) / values.length));
  const percentile = (fraction: number) => columns.map((values) => {
    const index = (values.length - 1) * fraction;
    const floor = Math.floor(index);
    return values[floor] + (values[Math.ceil(index)] - values[floor]) * (index - floor);
  });
  return [...means, ...spread, ...percentile(.2), ...percentile(.8)];
}

self.onmessage = async ({ data }: MessageEvent<{ kind: 'start'; term: string } | { kind: 'frame'; image: ImageBitmap }>) => {
  try {
    const asset = (name: string) => new URL('/vision/' + name, self.location.href).href;
    if (data.kind === 'start') {
      const response = await fetch(asset('fsl-numbers-v3.json'));
      if (!response.ok) throw new Error('Could not open the number model.');
      model = await response.json() as NumberModel;
      if (!/^2\d$/.test(data.term) || !model.labels.includes(data.term)) throw new Error('This sign has no number camera practice.');
      const wasm = await FilesetResolver.forVisionTasks(asset('wasm'), true);
      hand = await HandLandmarker.createFromOptions(wasm, {
        baseOptions: { modelAssetPath: asset('vocabulary-hands.task') },
        numHands: 2, minHandDetectionConfidence: .3, minHandPresenceConfidence: .3,
      });
      // MediaPipe clears its module factory after initializing each task.
      // Give the second module import a distinct URL so the loader runs again.
      body = await PoseLandmarker.createFromOptions({ ...wasm, wasmLoaderPath: wasm.wasmLoaderPath + '?task=pose' }, {
        baseOptions: { modelAssetPath: asset('vocabulary-pose.task') },
        minPoseDetectionConfidence: .3, minPosePresenceConfidence: .3,
      });
      send({ kind: 'ready', fps: model.fps });
      return;
    }
    if (!hand || !body || !model) throw new Error('The number camera is not ready.');
    const poses = body.detect(data.image).landmarks;
    const result = hand.detect(data.image);
    const both: Point[][] = [[], []];
    result.landmarks.forEach((points, index) => {
      both[result.handedness[index]?.[0]?.categoryName === 'Left' ? 0 : 1] = points;
    });
    sequence.push(capture(poses[0] ?? [], both, data.image.width / data.image.height));
    if (sequence.length < model.frames) send({ kind: 'progress', elapsed: Math.ceil(sequence.length / model.fps) });
    else {
      const hands = handsFound >= model.minHands;
      send({ kind: 'number', hands, id: hands ? classifyHand(model, numberFeatures(sequence)) : undefined });
      sequence.length = 0;
      handsFound = 0;
    }
  } catch (error) {
    send({ kind: 'error', message: String(error) });
  } finally {
    if (data.kind === 'frame') data.image.close();
  }
};
