import { FilesetResolver, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
import { classifyHand, type GeometryModel } from './geometry';

type SignModel = GeometryModel & { minHands: number };
type WordModel = SignModel & { frames: number; fps: number; layout?: 'xy' | 'xyz' };
type Point = { x: number; y: number; z: number };
export type WordCameraReport =
  | { kind: 'ready'; fps: number }
  | { kind: 'progress'; elapsed: number }
  | { kind: 'word'; id?: string; hands: boolean }
  | { kind: 'error'; message: string };

let hand: HandLandmarker | undefined;
let body: PoseLandmarker | undefined;
let model: WordModel | undefined;
let classifier: SignModel | undefined;
let numbers = false;
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

function send(report: WordCameraReport) {
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
  if (!shapes.length) return Array<number>(126).fill(0);
  const columns = shapes[0].map((_, index) => shapes.map((shape) => shape[index]).sort((a, b) => a - b));
  const mid = Math.floor(shapes.length / 2);
  return [...columns.map((values) => (values[mid] + values[Math.floor((values.length - 1) / 2)]) / 2),
    ...columns.map((values) => {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
    })];
}

self.onmessage = async ({ data }: MessageEvent<{ kind: 'start'; term: string } | { kind: 'frame'; image: ImageBitmap }>) => {
  try {
    const asset = (name: string) => new URL('/vision/' + name, self.location.href).href;
    if (data.kind === 'start') {
      numbers = /^2\d$/.test(data.term);
      const response = await fetch(asset(numbers ? 'fsl-vocabulary-v1.json' : 'fsl-words-v3.json'));
      if (!response.ok) throw new Error('Could not open the vocabulary model.');
      const bundle = await response.json() as WordModel & { numbers: SignModel };
      model = bundle;
      classifier = numbers ? bundle.numbers : bundle;
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
    if (!hand || !body || !model || !classifier) throw new Error('The vocabulary camera is not ready.');
    const poses = body.detect(data.image).landmarks;
    const result = hand.detect(data.image);
    const both: Point[][] = [[], []];
    result.landmarks.forEach((points, index) => {
      both[result.handedness[index]?.[0]?.categoryName === 'Left' ? 0 : 1] = points;
    });
    const landmarks = capture(poses[0] ?? [], both, data.image.width / data.image.height);
    if (!numbers && model.layout === 'xy') {
      for (const [start, end] of [[2, 21], [24, 85], [88, 149]]) {
        for (let i = start; i < end; i += 3) landmarks[i] = 0;
      }
    }
    sequence.push(landmarks);
    if (sequence.length < model.frames) send({ kind: 'progress', elapsed: Math.ceil(sequence.length / model.fps) });
    else {
      const hands = handsFound >= classifier.minHands;
      send({ kind: 'word', hands, id: hands ? classifyHand(classifier, numbers ? numberFeatures(sequence) : sequence.flat()) : undefined });
      sequence.length = 0;
      handsFound = 0;
    }
  } catch (error) {
    send({ kind: 'error', message: String(error) });
  } finally {
    if (data.kind === 'frame') data.image.close();
  }
};
