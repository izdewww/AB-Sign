import imageA from './assets/sign-a.jpg';
import imageB from './assets/sign-b.jpg';
import imageC from './assets/sign-c.jpg';
import imageD from './assets/sign-d.jpg';
import imageE from './assets/sign-e.jpg';
import imageF from './assets/sign-f.jpg';
import imageG from './assets/sign-g.jpg';
import imageH from './assets/sign-h.jpg';
import imageI from './assets/sign-i.jpg';
import imageJ from './assets/sign-j.jpg';
import imageK from './assets/sign-k.jpg';
import imageL from './assets/sign-l.jpg';
import imageM from './assets/sign-m.jpg';
import imageN from './assets/sign-n.jpg';
import imageO from './assets/sign-o.jpg';
import imageP from './assets/sign-p.jpg';
import imageQ from './assets/sign-q.jpg';
import imageR from './assets/sign-r.jpg';
import imageS from './assets/sign-s.jpg';
import imageT from './assets/sign-t.jpg';
import imageU from './assets/sign-u.jpg';
import imageV from './assets/sign-v.jpg';
import imageW from './assets/sign-w.jpg';
import imageX from './assets/sign-x.jpg';
import imageY from './assets/sign-y.jpg';
import imageZ from './assets/sign-z.jpg';

export const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'] as const;
export type Label = typeof labels[number];
export type Letter = { label: Label; photo: string; tone: 'peach' | 'mint' | 'sky'; description: string };

const photos = [imageA, imageB, imageC, imageD, imageE, imageF, imageG, imageH, imageI, imageJ, imageK, imageL, imageM, imageN, imageO, imageP, imageQ, imageR, imageS, imageT, imageU, imageV, imageW, imageX, imageY, imageZ];
const tones = ['peach', 'mint', 'sky'] as const;
const descriptions: Partial<Record<Label, string>> = {
  A: 'A closed hand with the thumb beside the fingers.',
  B: 'Four fingers pointing up with the thumb folded across the palm.',
  C: 'The fingers and thumb curve around an open space.',
};

export const letters: Letter[] = labels.map((label, index) => ({
  label, photo: photos[index], tone: tones[index % tones.length],
  description: descriptions[label] ?? `Hand shape for letter ${label}.`,
}));

export function isLabel(value: unknown): value is Label {
  return typeof value === 'string' && /^[A-Z]$/.test(value);
}

export function findLetter(label: Label): Letter {
  return letters[label.charCodeAt(0) - 65];
}

export const moves = (label: Label) => label === 'J' || label === 'Z';

export function cameraSupports(value: unknown): value is Exclude<Label, 'J' | 'Z'> {
  return isLabel(value) && !moves(value);
}
