import { FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision';
import { cameraSupports, type Label } from './letters';

export type FrameResult = { kind: 'frame'; hand: boolean; letter?: Label };
export type CameraReport = FrameResult | { kind: 'ready' } | { kind: 'error'; message: string };

let recognizer: GestureRecognizer | undefined;
const padded = new OffscreenCanvas(1, 1);
const crop = new OffscreenCanvas(1, 1);
const sample = crop.getContext('2d', { willReadFrequently: true })!;
const output = padded.getContext('2d')!;

function withMargin(frame: ImageBitmap) {
  const x = Math.round(frame.width * .2);
  const y = Math.round(frame.height * .2);
  const width = frame.width + 2 * x;
  const height = frame.height + 2 * y;
  if (crop.width !== frame.width || crop.height !== frame.height) {
    crop.width = frame.width;
    crop.height = frame.height;
    padded.width = width;
    padded.height = height;
  }
  sample.drawImage(frame, 0, 0);
  const size = Math.min(frame.width, frame.height, 8);
  const corners = [
    sample.getImageData(0, 0, size, size).data,
    sample.getImageData(frame.width - size, 0, size, size).data,
    sample.getImageData(0, frame.height - size, size, size).data,
    sample.getImageData(frame.width - size, frame.height - size, size, size).data,
  ];
  const rgb = [0, 1, 2].map((channel) => {
    const values = corners.flatMap((corner) => Array.from(corner.filter((_, index) => index % 4 === channel)));
    values.sort((a, b) => a - b);
    const middle = values.length / 2;
    return Math.round((values[middle - 1] + values[middle]) / 2);
  });
  output.fillStyle = `rgb(${rgb.join(',')})`;
  output.fillRect(0, 0, width, height);
  output.drawImage(crop, x, y);
  return padded;
}

self.onmessage = async ({ data }: MessageEvent<{ kind: 'start' } | { kind: 'frame'; image: ImageBitmap; time: number }>) => {
  try {
    if (data.kind === 'start') {
      const assets = new URL('/vision/wasm', self.location.href).href;
      recognizer = await GestureRecognizer.createFromOptions(await FilesetResolver.forVisionTasks(assets, true), {
        baseOptions: { modelAssetPath: new URL('/vision/fsl-az-v1.task', self.location.href).href },
        runningMode: 'VIDEO', numHands: 1, minHandDetectionConfidence: .25, minHandPresenceConfidence: .25,
      });
      self.postMessage({ kind: 'ready' } satisfies CameraReport);
      return;
    }
    const result = recognizer?.recognizeForVideo(withMargin(data.image), data.time);
    const prediction = result?.gestures[0]?.[0];
    const label = prediction && prediction.score >= .5 ? prediction.categoryName : undefined;
    const letter = cameraSupports(label) ? label : undefined;
    self.postMessage({ kind: 'frame', hand: Boolean(result?.landmarks.length), letter } satisfies CameraReport);
  } catch (error) {
    self.postMessage({ kind: 'error', message: String(error) } satisfies CameraReport);
  } finally {
    if (data.kind === 'frame') data.image.close();
  }
};
