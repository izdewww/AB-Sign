import { useState } from 'react';
import type { Student } from '../main/account-types.cjs';
import type { ClassroomStore } from './classroom';
import { GuessSignGame } from './guess-sign-game';
import { Icon } from './icons';
import { deriveLearnerStats } from './learner-profile';
import { type TeacherLibrary } from './lessons';
import { MemoryMatchGame } from './memory-match-game';
import { SignCameraGame } from './sign-camera-game';
import { VocabChallengeGame } from './vocab-challenge-game';

interface ActivitiesHubProps {
  library: TeacherLibrary;
  store: ClassroomStore;
  student: Student;
  mode?: string;
}

export function ActivitiesHub({ library, store, student, mode }: ActivitiesHubProps) {
  const stats = deriveLearnerStats(student, store.data, library);
  const [selectedScoreCard, setSelectedScoreCard] = useState<string | null>(null);

  // Dedicated game arenas mapped accordingly to their names
  if (mode === 'cards') {
    return <MemoryMatchGame store={store} onExit={() => { window.location.hash = '#activities'; }} />;
  }
  if (mode === 'guess') {
    return <GuessSignGame store={store} onExit={() => { window.location.hash = '#activities'; }} />;
  }
  if (mode === 'words') {
    return <VocabChallengeGame store={store} student={student} onExit={() => { window.location.hash = '#activities'; }} />;
  }
  if (mode === 'sign' || mode === 'camera') {
    return <SignCameraGame store={store} onExit={() => { window.location.hash = '#activities'; }} />;
  }

  // 2x2 Game Cards definitions
  const gameCards = [
    {
      id: 'cards',
      eyebrow: 'IMAGE & LETTER MATCH',
      title: 'Sign & Word Cards',
      description: 'Match FSL hand-sign pictures directly with their corresponding letters.',
      icon: 'spark',
      tone: 'mint',
      bestScore: '100% Match',
      pills: ['4 Pairs', 'Visual Matching', '+30 XP'],
      href: '#activities/cards',
    },
    {
      id: 'guess',
      eyebrow: 'RAPID IDENTIFICATION',
      title: 'Guess the Sign',
      description: 'Timed recognition challenge to identify fast-moving signs before time runs out.',
      icon: 'game',
      tone: 'sky',
      bestScore: '92% Accuracy',
      pills: ['10 Rounds', 'Time Attack', '+40 XP'],
      href: '#activities/guess',
    },
    {
      id: 'words',
      eyebrow: 'DAILY QUEST',
      title: 'Vocabulary Challenge',
      description: 'Daily 5-sign challenge for greetings, food, and family to defend your streak.',
      icon: 'trophy',
      tone: 'peach',
      bestScore: `${stats.dailyGoal.completedToday} of 5 Done`,
      pills: ['5 Signs Today', 'Daily Streak', '+60 XP'],
      href: '#activities/words',
    },
    {
      id: 'sign',
      eyebrow: 'CAMERA CHALLENGE',
      title: 'Sign on Camera',
      description: 'Look at the prompt letter and form the FSL sign in front of your live camera.',
      icon: 'camera',
      tone: 'yellow',
      bestScore: '100% Detected',
      pills: ['5 Signs', 'AI Detection', '+50 XP'],
      href: '#activities/sign',
    },
  ];

  return (
    <div className="activities-hub-page">
      {/* Header Banner */}
      <header className="activities-header-banner paper">
        <div className="activities-header-left">
          <div className="hub-tag-row">
            <span className="hub-pill-badge">Free Play Hub</span>
            <span className="hub-sub-pill">Play anytime • No unlock required</span>
          </div>
          <h1 className="activities-page-title">Activities &amp; Games</h1>
          <p className="activities-page-subtitle">
            Practice signs with fun mini-games at your own speed!
          </p>
        </div>

        <div className="activities-header-right">
          <div className="stars-summary-pill">
            <span className="star-icon">⭐</span>
            <div className="stars-summary-text">
              <strong>{stats.points} Points</strong>
              <span>Total Stars Earned</span>
            </div>
          </div>
        </div>
      </header>

      {/* 2x2 Tactile 3D Game Cards Grid */}
      <div className="activities-games-grid">
        {gameCards.map((card) => (
          <div key={card.id} className={`tactile-game-card paper ${card.tone}`}>
            <div className="game-card-top">
              <div className="game-card-icon-badge">
                <Icon name={card.icon as any} />
              </div>
              <span className="game-card-eyebrow">{card.eyebrow}</span>
              <span className="game-best-score-pill">{card.bestScore}</span>
            </div>

            <div className="game-card-info">
              <h2 className="game-card-title">{card.title}</h2>
              <p className="game-card-desc">{card.description}</p>
            </div>

            <div className="game-card-pills-row">
              {card.pills.map((pill, idx) => (
                <span key={idx} className="game-meta-pill">
                  {pill}
                </span>
              ))}
            </div>

            <div className="game-card-action-bar">
              <a href={card.href} className="button primary play-game-btn">
                <span>PLAY GAME</span>
                <Icon name="arrow" />
              </a>

              <a
                href={card.href}
                className="button secondary action-icon-btn"
                title="Restart Game"
                aria-label="Restart Game"
              >
                <Icon name="retry" />
              </a>

              <button
                type="button"
                className="button secondary action-icon-btn"
                title="View High Score"
                aria-label="High Score"
                onClick={() => setSelectedScoreCard(selectedScoreCard === card.id ? null : card.id)}
              >
                <Icon name="trophy" />
              </button>
            </div>

            {selectedScoreCard === card.id && (
              <div className="game-score-flyout paper">
                <strong>High Score:</strong> {card.bestScore} • +XP Multiplier Active
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer Adaptation Notice */}
      <footer className="activities-footer-bar paper">
        <span className="footer-info-icon">ℹ️</span>
        <p>Games adapt automatically to your learning speed and recent signs.</p>
      </footer>
    </div>
  );
}
