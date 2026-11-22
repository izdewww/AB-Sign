export type Activity = 'lesson' | 'check' | 'match' | 'memory' | 'quick' | 'spell' | 'daily' | 'camera' | 'quiz';
export type Attempt = { id: string; activity: Activity; title: string; score: number; total: number; date: string; missed: string[]; lesson?: string };
export type Progress = { attempts: Attempt[]; completed: string[]; badges: string[]; resume: string; sound: boolean };
export type Student = { id: string; name: string };
export type ChallengeMode = 'letters' | 'mixed';
export type ChallengeScores = Partial<Record<ChallengeMode, { best: number; latest: number }>>;
export type ChallengeRanking = { id: string; name: string; best: number };
export type AccountState = {
  students: Student[];
  challenge?: { scores: ChallengeScores; leaderboard: Record<ChallengeMode, ChallengeRanking[]> };
  active: { role: 'student'; student: Student; progress: Progress } | { role: 'teacher'; setup: boolean } | null;
};
export type AccountCommand =
  | { action: 'state' | 'logout' }
  | { action: 'create'; name: string }
  | { action: 'select' | 'remove' | 'student-progress'; id: string }
  | { action: 'rename'; id: string; name: string }
  | { action: 'login'; password: string }
  | { action: 'password'; current: string; password: string }
  | { action: 'save-challenge'; mode: ChallengeMode; score: number }
  | { action: 'save-progress'; id: string; progress: Progress };
export type AccountReply = { ok: true; state: AccountState; progress?: Progress } | { ok: false; error: string };
