import type { Attempt, Progress, Student } from '../main/account-types.cjs';
import { type BuddyId, getBuddy, type BuddyInfo } from './avatars';
import { streak, today } from './classroom';
import { categories, categoryFor, type Lesson, type TeacherLibrary } from './lessons';

export interface DailyGoalProgress {
  target: number;
  completedToday: number;
  remainingToday: number;
  percentage: number;
  isComplete: boolean;
}

export interface RecommendedReview {
  id: string;
  name: string;
  handShape: string;
  tip: string;
  cameraSupported: boolean;
}

export interface LearnerStats {
  student: Student;
  buddy: BuddyInfo;
  level: number;
  levelTitle: string;
  encouragement: string;
  points: number;
  streakDays: number;
  completedCount: number;
  masteredCount: number;
  accuracyPercentage: number;
  currentCategory: { id: string; title: string };
  currentLesson: Lesson | null;
  currentLessonIndex: number;
  totalLessonsInCurrentUnit: number;
  currentLessonProgressPercent: number;
  dailyGoal: DailyGoalProgress;
  recommendedReview: RecommendedReview;
  recentBadges: Array<{ id: string; title: string; desc: string; icon: string; tone: string }>;
}

const AVATAR_KEY_PREFIX = 'ab_sign_learner_avatar_';

export function getLearnerAvatar(studentId: string): BuddyId {
  try {
    const saved = localStorage.getItem(AVATAR_KEY_PREFIX + studentId);
    if (saved && ['sprout', 'hoot', 'leo', 'sparky', 'barnaby', 'pip'].includes(saved)) {
      return saved as BuddyId;
    }
  } catch {
    // Ignore localStorage read errors in sandboxed environments
  }
  // Deterministic fallback based on student id
  const fallbackList: BuddyId[] = ['sprout', 'hoot', 'leo', 'sparky', 'barnaby', 'pip'];
  const hash = studentId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return fallbackList[hash % fallbackList.length];
}

export function setLearnerAvatar(studentId: string, avatarId: BuddyId): void {
  try {
    localStorage.setItem(AVATAR_KEY_PREFIX + studentId, avatarId);
  } catch {
    // Ignore localStorage write errors
  }
}

export function getDailyGoalProgress(attempts: Attempt[], target = 5): DailyGoalProgress {
  const todayStr = today();
  const completedToday = attempts.filter((att) => att.date === todayStr && att.score > 0).length;
  const remainingToday = Math.max(0, target - completedToday);
  const percentage = Math.min(100, Math.round((completedToday / target) * 100));
  return {
    target,
    completedToday,
    remainingToday,
    percentage,
    isComplete: completedToday >= target,
  };
}

const REVIEW_TIPS: Record<string, { handShape: string; tip: string }> = {
  B: { handShape: 'Flat Palm', tip: 'Remember to keep your thumb tucked neatly across your palm!' },
  A: { handShape: 'Fist with Thumb Up', tip: 'Rest your thumb firmly against the side of your index finger.' },
  C: { handShape: 'Curved Cup', tip: 'Curve your fingers smoothly like holding a small cup.' },
  D: { handShape: 'Pointing Finger', tip: 'Point your index finger straight up and touch your thumb to other fingers.' },
  E: { handShape: 'Clawed Curl', tip: 'Curl all four fingertips so they rest on the top of your thumb.' },
  F: { handShape: 'Circle & Feathers', tip: 'Touch your index finger and thumb together in an OK circle.' },
  G: { handShape: 'Horizontal Pinch', tip: 'Point your index finger forward horizontally with thumb parallel.' },
  H: { handShape: 'Two-Finger Bridge', tip: 'Keep index and middle fingers together pointing sideways.' },
  I: { handShape: 'Pinky Stand', tip: 'Make a fist and stand your little pinky finger straight up!' },
  L: { handShape: 'Right Angle L', tip: 'Make an L-shape with your index finger and thumb pointing wide.' },
  M: { handShape: 'Three Finger Drape', tip: 'Drape three fingers over your thumb so your thumb peeks under.' },
  O: { handShape: 'Full Circle', tip: 'Touch all four fingertips to the tip of your thumb to form an O.' },
  S: { handShape: 'Locked Fist', tip: 'Make a tight fist and cross your thumb firmly over the front.' },
  V: { handShape: 'Victory V', tip: 'Spread your index and middle fingers apart in a clear peace sign.' },
  W: { handShape: 'Three-Prong Fork', tip: 'Spread index, middle, and ring fingers upward like a W.' },
  Y: { handShape: 'Phone Shaka', tip: 'Stick your thumb and pinky out while holding middle fingers down.' },
};

export function getRecommendedReview(attempts: Attempt[]): RecommendedReview {
  // Check missed signs from attempts
  const missedSigns = attempts.flatMap((att) => att.missed || []);
  const candidateLetter = missedSigns.length > 0 ? missedSigns[0].toUpperCase() : 'B';
  const info = REVIEW_TIPS[candidateLetter] || {
    handShape: 'Clear Hand Shape',
    tip: 'Keep your wrist steady and face your palm forward toward the camera.',
  };

  return {
    id: candidateLetter,
    name: `Letter ${candidateLetter} – ${info.handShape}`,
    handShape: info.handShape,
    tip: info.tip,
    cameraSupported: true,
  };
}

export function deriveLearnerStats(
  student: Student,
  progress: Progress,
  library: TeacherLibrary
): LearnerStats {
  const buddyId = getLearnerAvatar(student.id);
  const buddy = getBuddy(buddyId);
  const streakDays = streak(progress.attempts);
  const completedCount = progress.completed.length;

  // Level computation: Level 1 + 1 for every 2 completed lessons
  const level = Math.max(1, Math.floor(completedCount / 2) + 1);
  const levelTitles = [
    'Sign Explorer',
    'Sign Explorer',
    'Rising Star',
    'Hand Shape Hero',
    'FSL Champion',
    'Sign Language Master',
  ];
  const levelTitle = levelTitles[Math.min(level, levelTitles.length - 1)];

  const encouragements = [
    "You're just getting started! Every sign is a new superpower.",
    "You're on a roll! Keep up the great signing streak!",
    "Fantastic progress! Your signs are looking super sharp!",
    "Amazing dedication! You're becoming a true sign master!",
    "Unstoppable! Keep inspiring your friends with your signs!",
  ];
  const encouragement = encouragements[(level - 1) % encouragements.length];

  // Points computation: Base points + lessons + attempts + streak
  const points = 50 + completedCount * 100 + progress.attempts.length * 25 + streakDays * 50;

  // Accuracy computation
  let totalScore = 0;
  let totalPossible = 0;
  for (const att of progress.attempts) {
    totalScore += att.score;
    totalPossible += att.total;
  }
  const accuracyPercentage = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 94;

  // Current category & active lesson
  const resumeId = progress.resume.startsWith('lesson/')
    ? progress.resume.split('/')[1]
    : null;
  const resumeLesson = resumeId ? library.visible.find((l) => l.id === resumeId) : null;
  const nextUnfinishedLesson = library.visible.find((l) => !progress.completed.includes(l.id));
  const currentLesson = resumeLesson || nextUnfinishedLesson || library.visible[0] || null;

  const currentCatId = currentLesson?.category || 'alphabet';
  const currentCategory = categoryFor(currentCatId);

  // Lesson index in category
  const categoryLessons = library.visible.filter((l) => (l.category || 'alphabet') === currentCatId);
  const currentLessonIndex = currentLesson
    ? Math.max(1, categoryLessons.findIndex((l) => l.id === currentLesson.id) + 1)
    : 1;
  const totalLessonsInCurrentUnit = Math.max(1, categoryLessons.length);

  // Progress percent of current lesson (if partially completed, or default estimation)
  const currentLessonProgressPercent = currentLesson
    ? progress.completed.includes(currentLesson.id)
      ? 100
      : progress.resume.startsWith(`lesson/${currentLesson.id}/`)
      ? 50
      : 25
    : 0;

  // Mastered signs
  const masteredSet = new Set<string>();
  for (const att of progress.attempts) {
    if (att.score === att.total && att.total > 0) {
      if (att.activity === 'camera' && att.title.includes('·')) {
        masteredSet.add(att.title.split('·')[1].trim());
      }
    }
  }
  // Also add letters from completed alphabet lessons
  for (const lesson of library.visible) {
    if (progress.completed.includes(lesson.id)) {
      for (const step of lesson.steps) {
        if ('letter' in step && typeof step.letter === 'string') {
          masteredSet.add(step.letter);
        }
      }
    }
  }
  const masteredCount = Math.max(masteredSet.size, completedCount > 0 ? completedCount * 2 : 0);

  // Daily goal
  const dailyGoal = getDailyGoalProgress(progress.attempts, 5);

  // Recommended review
  const recommendedReview = getRecommendedReview(progress.attempts);

  // Gamified badges list
  const recentBadges = [
    {
      id: 'first-sprout',
      title: 'First Sprout',
      desc: 'Completed 1st Sign or Lesson',
      icon: 'sprout',
      tone: 'mint',
    },
    {
      id: 'streak-halo',
      title: `${Math.max(streakDays, 1)}-Day Halo`,
      desc: `${Math.max(streakDays, 1)}-day sign activity streak`,
      icon: 'flame',
      tone: 'yellow',
    },
    {
      id: 'camera-star',
      title: 'Camera Star',
      desc: 'Active camera sign-ups & practice',
      icon: 'camera',
      tone: 'sky',
    },
  ];

  return {
    student,
    buddy,
    level,
    levelTitle,
    encouragement,
    points,
    streakDays,
    completedCount,
    masteredCount,
    accuracyPercentage,
    currentCategory: { id: currentCategory.id, title: currentCategory.title },
    currentLesson,
    currentLessonIndex,
    totalLessonsInCurrentUnit,
    currentLessonProgressPercent,
    dailyGoal,
    recommendedReview,
    recentBadges,
  };
}
