type Point = { x: number; y: number; z: number };
type DenseLayer = { weights: number[]; biases: number[] };

export type GeometryModel = { labels: string[]; threshold: number; layers: DenseLayer[] };

export function handFeatures(screen: readonly Point[], world: readonly Point[], left: boolean, aspect: number) {
  if (screen.length !== 21 || world.length !== 21) return;
  function normalize(points: readonly Point[], ratio: number) {
    const wrist = points[0];
    const coordinates = points.map(({ x, y, z }) => [(x - wrist.x) * ratio * (left ? -1 : 1), y - wrist.y, z - wrist.z]);
    const size = Math.max(1e-5, ...coordinates.map(([x, y, z]) => Math.hypot(x, y, z)));
    return coordinates.flatMap((point) => point.map((value) => value / size));
  }
  return [...normalize(screen, aspect), ...normalize(world, 1)];
}

export function classifyHand(model: GeometryModel, features: readonly number[]) {
  let input = features;
  for (const [index, layer] of model.layers.entries()) {
    const last = index === model.layers.length - 1;
    input = layer.biases.map((bias, unit) => {
      let value = bias;
      const offset = unit * input.length;
      for (let i = 0; i < input.length; i++) value += layer.weights[offset + i] * input[i];
      return last ? value : Math.max(value, 0);
    });
  }
  const peak = Math.max(...input);
  const confidence = 1 / input.reduce((sum, value) => sum + Math.exp(value - peak), 0);
  return confidence >= model.threshold ? model.labels[input.indexOf(peak)] : undefined;
}
