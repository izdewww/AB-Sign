import { useEffect, useRef, useState } from 'react';
import type { ClassroomStore } from './classroom';
import { Icon } from './icons';
import { labels, letters, type Letter } from './letters';
import { shuffle } from './quiz';

interface GuessRound {
  target: Letter;
  choices: string[];
}

interface GuessSignGameProps {
  store?: ClassroomStore;
  onExit: () => void;
}

const ROUND_COUNT = 10;
const SECONDS_PER_ROUND = 10;

export function GuessSignGame({ store, onExit }: GuessSignGameProps) {
  const [rounds, setRounds] = useState<GuessRound[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(SECONDS_PER_ROUND);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [feedbackBonus, setFeedbackBonus] = useState<string | null>(null);

  const initGame = () => {
    const shuffledLetters = shuffle([...letters]);
    const generatedRounds: GuessRound[] = [];

    for (let i = 0; i < ROUND_COUNT; i++) {
      const target = shuffledLetters[i % shuffledLetters.length];
      const distractors = shuffle(labels.filter((l) => l !== target.label)).slice(0, 3);
      const choices = shuffle([target.label, ...distractors]);
      generatedRounds.push({ target, choices });
    }

    setRounds(generatedRounds);
    setCurrentIndex(0);
    setTimeLeft(SECONDS_PER_ROUND);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setScore(0);
    setCorrectCount(0);
    setStreak(0);
    setBestStreak(0);
    setIsGameOver(false);
    setFeedbackBonus(null);
  };

  useEffect(() => {
    initGame();
  }, []);

  // Timer countdown
  useEffect(() => {
    if (isGameOver || isAnswered || rounds.length === 0) return;

    if (timeLeft <= 0) {
      // Time ran out
      handleAnswer(null);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((t) => t - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, isGameOver, isAnswered, rounds.length]);

  const handleAnswer = (choice: string | null) => {
    if (isAnswered) return;
    setIsAnswered(true);
    setSelectedAnswer(choice);

    const currentRound = rounds[currentIndex];
    const isCorrect = choice === currentRound.target.label;

    if (isCorrect) {
      const isFast = timeLeft >= 7; // Answered within first 3 seconds
      const pointsEarned = isFast ? 60 : 40;
      setScore((s) => s + pointsEarned);
      setCorrectCount((c) => c + 1);
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      if (nextStreak > bestStreak) setBestStreak(nextStreak);
      setFeedbackBonus(isFast ? '⚡ 1.5x Speed Bonus! +60 XP' : '+40 XP');
    } else {
      setStreak(0);
      setFeedbackBonus(choice ? 'Not quite!' : "Time's up!");
    }

    // Auto-advance to next round after 900ms
    setTimeout(() => {
      if (currentIndex + 1 >= ROUND_COUNT) {
        setIsGameOver(true);
        try {
          store?.record({
            activity: 'quick',
            title: 'Guess the Sign',
            score: isCorrect ? correctCount + 1 : correctCount,
            total: ROUND_COUNT,
            missed: [],
            lesson: 'game-guess',
          });
        } catch {
          // Safe fallback
        }
      } else {
        setCurrentIndex((prev) => prev + 1);
        setTimeLeft(SECONDS_PER_ROUND);
        setSelectedAnswer(null);
        setIsAnswered(false);
        setFeedbackBonus(null);
      }
    }, 950);
  };

  const currentRound = rounds[currentIndex];

  return (
    <div className="guess-game-arena">
      {/* Top Header */}
      <header className="game-arena-header paper">
        <div className="arena-header-left">
          <button type="button" className="button secondary btn-3d back-to-hub-btn" onClick={onExit}>
            <Icon name="back" />
            <span>Games Hub</span>
          </button>
          <div className="game-title-info">
            <span className="game-eyebrow-pill sky">RAPID IDENTIFICATION</span>
            <h1 className="game-screen-title">Guess the Sign</h1>
          </div>
        </div>

        <div className="arena-header-right">
          <div className="game-stat-pill">
            <span className="stat-label">Round</span>
            <strong className="stat-value">{currentIndex + 1} / {ROUND_COUNT}</strong>
          </div>
          <div className="game-stat-pill streak-pill">
            <span className="stat-label">Streak</span>
            <strong className="stat-value">🔥 {streak}</strong>
          </div>
          <div className="game-stat-pill score-pill">
            <span className="stat-label">Score</span>
            <strong className="stat-value">⭐ {score} XP</strong>
          </div>
        </div>
      </header>

      {/* Timer Progress Bar */}
      <div className="timer-bar-wrapper">
        <div
          className={`timer-bar-fill ${timeLeft <= 3 ? 'critical' : timeLeft <= 6 ? 'warning' : ''}`}
          style={{ width: `${(timeLeft / SECONDS_PER_ROUND) * 100}%` }}
        />
      </div>

      {/* Main Play Arena (Split Layout) */}
      {currentRound && !isGameOver && (
        <div className="guess-stage-workspace">
          {/* Left Column: Sign Image Preview Card */}
          <div className="guess-preview-card paper">
            <div className="guess-preview-header">
              <span className="preview-cue-badge">Which letter matches this sign?</span>
              <span className="timer-countdown-tag">{timeLeft}s remaining</span>
            </div>

            <div className="guess-media-frame">
              <img
                src={currentRound.target.photo}
                alt="FSL hand sign to identify"
                className="guess-sign-photo"
              />
            </div>

            {feedbackBonus && (
              <div className={`guess-floating-feedback ${selectedAnswer === currentRound.target.label ? 'success' : 'error'}`}>
                {feedbackBonus}
              </div>
            )}
          </div>

          {/* Right Column: 4 Choice Cards */}
          <div className="guess-choices-card paper">
            <div className="choices-instruction-row">
              <h2>Select the correct sign:</h2>
            </div>

            <div className="guess-options-grid">
              {currentRound.choices.map((choice) => {
                const isSelected = selectedAnswer === choice;
                const isCorrect = choice === currentRound.target.label;
                let btnStyle = 'secondary';
                if (isAnswered) {
                  if (isCorrect) btnStyle = 'choice-correct';
                  else if (isSelected) btnStyle = 'choice-incorrect';
                }

                return (
                  <button
                    key={choice}
                    type="button"
                    className={`button ${btnStyle} btn-3d guess-choice-btn`}
                    onClick={() => handleAnswer(choice)}
                    disabled={isAnswered}
                  >
                    <span className="choice-letter-text">{choice}</span>
                    {isAnswered && isCorrect && <Icon name="check" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Game Over Summary Modal */}
      {isGameOver && (
        <div className="game-modal-overlay">
          <div className="game-victory-modal paper">
            <div className="victory-badge-circle sky">
              <span>⚡</span>
            </div>
            <h2>Time Attack Complete!</h2>
            <p className="victory-subtitle">Rapid sign recognition round finished!</p>

            <div className="victory-stats-row">
              <div className="victory-stat-item">
                <span>Accuracy</span>
                <strong>{Math.round((correctCount / ROUND_COUNT) * 100)}%</strong>
              </div>
              <div className="victory-stat-item">
                <span>Best Streak</span>
                <strong>🔥 {bestStreak}</strong>
              </div>
              <div className="victory-stat-item highlight">
                <span>XP Earned</span>
                <strong>+{score} XP</strong>
              </div>
            </div>

            <div className="victory-actions-row">
              <button type="button" className="button primary btn-3d" onClick={initGame}>
                <Icon name="retry" />
                <span>Play Again</span>
              </button>
              <button type="button" className="button secondary btn-3d" onClick={onExit}>
                <Icon name="arrow" />
                <span>Back to Games Hub</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
