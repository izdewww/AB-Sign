import { useState } from 'react';
import type { Student } from '../main/account-types.cjs';
import type { ClassroomStore } from './classroom';
import { Icon } from './icons';
import { quizFor, type TeacherLibrary } from './lessons';
import { deriveLearnerStats } from './learner-profile';

interface ActivitiesHubProps {
  library: TeacherLibrary;
  store: ClassroomStore;
  student: Student;
  mode?: string;
}

export function ActivitiesHub({ library, store, student, mode }: ActivitiesHubProps) {
  const stats = deriveLearnerStats(student, store.data, library);
  const [selectedScoreCard, setSelectedScoreCard] = useState<string | null>(null);

  // If sub-mode is selected (e.g. #activities/cards, #activities/guess), render the drill list
  const quizzes = library.visible.filter(quizFor);
  const options =
    mode === 'cards'
      ? library.visible.map((lesson) => ({ title: lesson.title, url: '#lesson/' + lesson.id + '/demo/0' }))
      : mode === 'spell'
      ? library.visible.flatMap((lesson) =>
          lesson.steps.flatMap((step, index) =>
            step.kind === 'spell' ? [{ title: lesson.title, url: '#lesson/' + lesson.id + '/demo/' + index }] : []
          )
        )
      : quizzes
          .filter((lesson) => mode !== 'words' || (lesson.category && lesson.category !== 'alphabet'))
          .map((lesson) => ({ title: lesson.title, url: '#lesson/' + lesson.id + '/quiz' }));

  if (mode) {
    const modeTitles: Record<string, { title: string; desc: string; tone: string }> = {
      cards: { title: 'Sign & Word Cards', desc: 'Look at a sign and practice it.', tone: 'mint' },
      guess: { title: 'Guess the Sign', desc: 'Find the letter or word that matches.', tone: 'sky' },
      spell: { title: 'Fingerspell Sprint', desc: 'Read signs one letter at a time.', tone: 'yellow' },
      words: { title: 'Vocabulary Challenge', desc: 'Match signs for numbers and everyday words.', tone: 'peach' },
    };
    const currentMode = modeTitles[mode] || { title: 'Activity', desc: 'Practice your signs.', tone: 'sky' };

    return (
      <section className="activities-submode-view">
        <a className="back-link" href="#activities">
          <Icon name="back" /> Back to Activities &amp; games
        </a>
        <header className={`path-card ${currentMode.tone}`}>
          <div>
            <h1>{currentMode.title}</h1>
            <p>{currentMode.desc}</p>
          </div>
        </header>
        {options.length ? (
          <ul className="lesson-list paper section-actions">
            {options.map(({ title, url }) => (
              <li key={url}>
                <h2>{title}</h2>
                <a className="button secondary" href={url}>
                  Open <Icon name="arrow" />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <div className="paper empty section-actions">
            <p>{library.status === 'loading' ? 'Opening activities…' : 'No activities available yet.'}</p>
          </div>
        )}
      </section>
    );
  }

  // 2x2 Game Cards definitions
  const gameCards = [
    {
      id: 'cards',
      eyebrow: 'MEMORY MATCH',
      title: 'Sign & Word Cards',
      description: 'Flip-tile matching game to connect FSL gestures with letters and pictures.',
      icon: 'spark',
      tone: 'mint',
      bestScore: '100% Match',
      pills: ['12 Cards', 'Beginner Friendly', '+30 XP'],
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
      id: 'spell',
      eyebrow: 'LETTER BY LETTER',
      title: 'Fingerspell Sprint',
      description: 'Spell out complete words letter-by-letter on camera or touchscreen.',
      icon: 'hand',
      tone: 'yellow',
      bestScore: '85% Match',
      pills: ['Alphabet A-Z', 'Camera Active', '+50 XP'],
      href: '#activities/spell',
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
