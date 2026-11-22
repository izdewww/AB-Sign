import { useEffect, useState } from 'react';
import { Camera } from './camera';
import type { ClassroomStore } from './classroom';
import { Icon } from './icons';
import { cameraSupports, labels, type Label } from './letters';
import { shuffle } from './quiz';

interface SignCameraGameProps {
  store?: ClassroomStore;
  onExit: () => void;
}

const TOTAL_ROUNDS = 5;

export function SignCameraGame({ store, onExit }: SignCameraGameProps) {
  const [roundLetters, setRoundLetters] = useState<Label[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [recentMatchNotice, setRecentMatchNotice] = useState<string | null>(null);

  const initGame = () => {
    const supported = labels.filter(cameraSupports);
    const chosen = shuffle([...supported]).slice(0, TOTAL_ROUNDS) as Label[];
    setRoundLetters(chosen);
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setIsCompleted(false);
    setRecentMatchNotice(null);
  };

  useEffect(() => {
    initGame();
  }, []);

  const handleSignMatched = () => {
    const currentLetter = roundLetters[currentIndex];
    const nextScore = score + 1;
    const nextStreak = streak + 1;
    setScore(nextScore);
    setStreak(nextStreak);
    setRecentMatchNotice(`✓ Great job! You signed letter ${currentLetter}!`);

    setTimeout(() => {
      setRecentMatchNotice(null);
      if (currentIndex + 1 >= TOTAL_ROUNDS) {
        setIsCompleted(true);
        try {
          store?.record({
            activity: 'camera',
            title: 'Sign on Camera',
            score: nextScore,
            total: TOTAL_ROUNDS,
            missed: [],
            lesson: 'game-camera',
          });
        } catch {
          // Safe fallback
        }
      } else {
        setCurrentIndex((i) => i + 1);
      }
    }, 1200);
  };

  const handleSkip = () => {
    setStreak(0);
    if (currentIndex + 1 >= TOTAL_ROUNDS) {
      setIsCompleted(true);
      try {
        store?.record({
          activity: 'camera',
          title: 'Sign on Camera',
          score,
          total: TOTAL_ROUNDS,
          missed: [],
          lesson: 'game-camera',
        });
      } catch {
        // Safe fallback
      }
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  const currentLetter = roundLetters[currentIndex] || 'A';

  return (
    <div className="sign-camera-arena">
      {/* Top Header */}
      <header className="game-arena-header paper">
        <div className="arena-header-left">
          <button type="button" className="button secondary btn-3d back-to-hub-btn" onClick={onExit}>
            <Icon name="back" />
            <span>Games Hub</span>
          </button>
          <div className="game-title-info">
            <span className="game-eyebrow-pill mint">CAMERA CHALLENGE</span>
            <h1 className="game-screen-title">Sign on Camera</h1>
          </div>
        </div>

        <div className="arena-header-right">
          <div className="game-stat-pill">
            <span className="stat-label">Sign</span>
            <strong className="stat-value">{currentIndex + 1} of {TOTAL_ROUNDS}</strong>
          </div>
          <div className="game-stat-pill streak-pill">
            <span className="stat-label">Streak</span>
            <strong className="stat-value">🔥 {streak}</strong>
          </div>
          <div className="game-stat-pill score-pill">
            <span className="stat-label">Detected</span>
            <strong className="stat-value">⭐ {score}</strong>
          </div>
        </div>
      </header>

      {/* Match Notification Alert */}
      {recentMatchNotice && (
        <div className="camera-game-match-banner" role="status">
          <span>{recentMatchNotice}</span>
        </div>
      )}

      {/* Main Interactive Camera Stage */}
      {!isCompleted && roundLetters.length > 0 && (
        <div className="sign-camera-stage-wrapper">
          <Camera
            key={`cam-target-${currentLetter}-${currentIndex}`}
            target={currentLetter}
            match={handleSignMatched}
            fallback={
              <button type="button" className="button secondary btn-3d" onClick={handleSkip}>
                <span>Skip sign</span>
                <Icon name="arrow" />
              </button>
            }
            quizContext={{
              questionNumber: currentIndex + 1,
              totalQuestions: TOTAL_ROUNDS,
              onSkip: handleSkip,
            }}
          />
        </div>
      )}

      {/* Victory Celebration Modal */}
      {isCompleted && (
        <div className="game-modal-overlay">
          <div className="game-victory-modal paper">
            <div className="victory-badge-circle">
              <span>🌟</span>
            </div>
            <h2>Camera Signing Master!</h2>
            <p className="victory-subtitle">You showed your signs to the camera!</p>

            <div className="victory-stats-row">
              <div className="victory-stat-item">
                <span>Signs Detected</span>
                <strong>{score} / {TOTAL_ROUNDS}</strong>
              </div>
              <div className="victory-stat-item">
                <span>Best Streak</span>
                <strong>🔥 {streak}</strong>
              </div>
              <div className="victory-stat-item highlight">
                <span>XP Earned</span>
                <strong>+{score * 10} XP</strong>
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
