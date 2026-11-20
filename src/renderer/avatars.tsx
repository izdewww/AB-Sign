import type { FC, SVGProps } from 'react';
import frogImg from '../../docs/images/Frog.jfif';
import tigerImg from '../../docs/images/Tiger.png';
import lionImg from '../../docs/images/Lion.jfif';
import foxImg from '../../docs/images/Fox.png';
import bearImg from '../../docs/images/Bear.png';
import rabbitImg from '../../docs/images/Rabbit.png';

export type BuddyId = 'sprout' | 'hoot' | 'leo' | 'sparky' | 'barnaby' | 'pip';

export interface BuddyInfo {
  id: BuddyId;
  name: string;
  species: string;
  label: string;
  tagline: string;
  tone: 'mint' | 'peach' | 'yellow' | 'coral' | 'tan' | 'lavender';
  accentColor: string;
  bgColor: string;
  borderColor: string;
  imageSrc: string;
}

export const BUDDIES: Record<BuddyId, BuddyInfo> = {
  sprout: {
    id: 'sprout',
    name: 'Sprout',
    species: 'Frog',
    label: 'Sprout – Frog',
    tagline: 'Always leaping to learn new signs!',
    tone: 'mint',
    accentColor: '#16a34a',
    bgColor: '#e1eecb',
    borderColor: '#4ade80',
    imageSrc: frogImg,
  },
  hoot: {
    id: 'hoot',
    name: 'Hoot',
    species: 'Tiger',
    label: 'Hoot – Tiger',
    tagline: 'Bold, brave, and quick with your hands!',
    tone: 'peach',
    accentColor: '#ea580c',
    bgColor: '#ffe4d8',
    borderColor: '#fb923c',
    imageSrc: tigerImg,
  },
  leo: {
    id: 'leo',
    name: 'Leo',
    species: 'Lion',
    label: 'Leo – Lion',
    tagline: 'A roaring champion of sign language!',
    tone: 'yellow',
    accentColor: '#d97706',
    bgColor: '#fff0ba',
    borderColor: '#f59e0b',
    imageSrc: lionImg,
  },
  sparky: {
    id: 'sparky',
    name: 'Sparky',
    species: 'Fox',
    label: 'Sparky – Fox',
    tagline: 'Clever moves and lightning-fast signs!',
    tone: 'coral',
    accentColor: '#f97316',
    bgColor: '#fed7aa',
    borderColor: '#f97316',
    imageSrc: foxImg,
  },
  barnaby: {
    id: 'barnaby',
    name: 'Barnaby',
    species: 'Bear',
    label: 'Barnaby – Bear',
    tagline: 'Warm hugs and steady, mindful signing!',
    tone: 'tan',
    accentColor: '#8d5b4c',
    bgColor: '#f5ebe0',
    borderColor: '#a47148',
    imageSrc: bearImg,
  },
  pip: {
    id: 'pip',
    name: 'Pip',
    species: 'Rabbit',
    label: 'Pip – Rabbit',
    tagline: 'Bouncy ears and eager sign practice!',
    tone: 'lavender',
    accentColor: '#9333ea',
    bgColor: '#f0e1f8',
    borderColor: '#c084fc',
    imageSrc: rabbitImg,
  },
};

export const BUDDY_LIST: BuddyInfo[] = Object.values(BUDDIES);

export function getBuddy(id?: string): BuddyInfo {
  if (id && id in BUDDIES) {
    return BUDDIES[id as BuddyId];
  }
  return BUDDIES.sprout;
}

export function BuddyAvatar({ id, size = 64, className = '' }: { id?: string; size?: number; className?: string }) {
  const buddy = getBuddy(id);
  return (
    <div
      className={`buddy-avatar-wrapper ${className}`}
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        borderRadius: '50%',
        overflow: 'hidden',
        display: 'grid',
        placeItems: 'center',
        background: buddy.bgColor,
        boxShadow: '0 4px 10px rgba(0,0,0,0.06)',
        border: `2px solid ${buddy.borderColor}`,
      }}
      title={buddy.label}
      aria-label={buddy.label}
    >
      <img
        src={buddy.imageSrc}
        alt={buddy.label}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: '50%',
        }}
      />
    </div>
  );
}
