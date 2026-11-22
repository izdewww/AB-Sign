import { useEffect, useState } from 'react';
import type { ClassroomStore } from './classroom';
import { Icon } from './icons';
import { letters, type Letter } from './letters';
import { shuffle } from './quiz';

interface MemoryMatchGameProps {
  store?: ClassroomStore;
  onExit: () => void;
}

const PAIRS_PER_ROUND = 4;

export function MemoryMatchGame({ store, onExit }: MemoryMatchGameProps) {
  const [selectedLetters, setSelectedLetters] = useState<Letter[]>([]);
  const [shuffledImageCards, setShuffledImageCards] = useState<Letter[]>([]);
  const [shuffledLetterCards, setShuffledLetterCards] = useState<Letter[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Set<string>>(new Set());
  const [mismatchPair, setMismatchPair] = useState<{ image: string; letter: string } | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [isWon, setIsWon] = useState(false);

  // Initialize a fresh matching round
  const initGame = () => {
    const chosen: Letter[] = shuffle([...letters]).slice(0, PAIRS_PER_ROUND);
    setSelectedLetters(chosen);
    setShuffledImageCards(shuffle([...chosen]));
    setShuffledLetterCards(shuffle([...chosen]));
    setSelectedImage(null);
    setSelectedLetter(null);
    setMatchedPairs(new Set());
    setMismatchPair(null);
    setAttempts(0);
    setSeconds(0);
    setIsWon(false);
  };

  useEffect(() => {
    initGame();
  }, []);

  // Timer
  useEffect(() => {
    if (isWon) return;
    const timer = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isWon]);

  // Handle card selection
  const handleImageClick = (label: string) => {
    if (matchedPairs.has(label) || mismatchPair) return;
    setSelectedImage(label);

    if (selectedLetter) {
      checkMatch(label, selectedLetter);
    }
  };

  const handleLetterClick = (label: string) => {
    if (matchedPairs.has(label) || mismatchPair) return;
    setSelectedLetter(label);

    if (selectedImage) {
      checkMatch(selectedImage, label);
    }
  };

  const checkMatch = (imgLabel: string, letterLabel: string) => {
    setAttempts((a) => a + 1);

    if (imgLabel === letterLabel) {
      // Correct match!
      const nextMatched = new Set(matchedPairs);
      nextMatched.add(imgLabel);
      setMatchedPairs(nextMatched);
      setSelectedImage(null);
      setSelectedLetter(null);

      if (nextMatched.size === PAIRS_PER_ROUND) {
        setIsWon(true);
        try {
          store?.record({
            activity: 'match',
            title: 'Sign & Word Cards',
            score: PAIRS_PER_ROUND,
            total: PAIRS_PER_ROUND,
            missed: [],
            lesson: 'game-match',
          });
        } catch {
          // Safe fallback
        }
      }
    } else {
      // Mismatch
      setMismatchPair({ image: imgLabel, letter: letterLabel });
      setTimeout(() => {
        setSelectedImage(null);
        setSelectedLetter(null);
        setMismatchPair(null);
      }, 700);
    }
  };

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="memory-game-arena direct-match-arena">
      {/* Top Header Bar */}
      <header className="game-arena-header paper">
        <div className="arena-header-left">
          <button type="button" className="button secondary btn-3d back-to-hub-btn" onClick={onExit}>
            <Icon name="back" />
            <span>Games Hub</span>
          </button>
          <div className="game-title-info">
            <span className="game-eyebrow-pill">IMAGE &amp; LETTER MATCH</span>
            <h1 className="game-screen-title">Sign &amp; Word Cards</h1>
          </div>
        </div>

        <div className="arena-header-right">
          <div className="game-stat-pill">
            <span className="stat-label">Matched</span>
            <strong className="stat-value">{matchedPairs.size} / {PAIRS_PER_ROUND} Pairs</strong>
          </div>
          <div className="game-stat-pill">
            <span className="stat-label">Tries</span>
            <strong className="stat-value">{attempts}</strong>
          </div>
          <div className="game-stat-pill">
            <span className="stat-label">Time</span>
            <strong className="stat-value">{formatTime(seconds)}</strong>
          </div>
          <button type="button" className="button secondary btn-3d restart-game-btn" onClick={initGame} title="Restart with new signs">
            <Icon name="retry" />
            <span>Shuffle</span>
          </button>
        </div>
      </header>

      {/* Main Matching Stage: Images on Left, Letters on Right */}
      <div className="direct-match-workspace paper">
        <div className="match-instruction-banner">
          <p>Tap a <strong>Hand Sign Picture</strong> on the left, then tap its matching <strong>Letter</strong> on the right!</p>
        </div>

        <div className="direct-match-columns-grid">
          {/* Left Column: Hand Sign Pictures */}
          <div className="match-column images-column">
            <h2 className="match-column-heading">
              <span>📷</span> Hand Sign Pictures
            </h2>
            <div className="match-cards-stack">
              {shuffledImageCards.map((item) => {
                const isMatched = matchedPairs.has(item.label);
                const isSelected = selectedImage === item.label;
                const isError = mismatchPair?.image === item.label;

                return (
                  <button
                    key={`img-${item.label}`}
                    type="button"
                    className={`match-tile-card image-tile ${isSelected ? 'tile-selected' : ''} ${isMatched ? 'tile-matched' : ''} ${isError ? 'tile-error' : ''}`}
                    onClick={() => handleImageClick(item.label)}
                    disabled={isMatched || Boolean(mismatchPair)}
                    aria-label={`Hand sign for letter ${item.label}`}
                  >
                    <div className="match-image-frame">
                      <img src={item.photo} alt={item.description || `Sign for ${item.label}`} className="match-sign-img" />
                    </div>
                    <div className="match-tile-label">
                      {isMatched ? (
                        <span className="matched-indicator-badge">
                          <Icon name="check" /> Matched ({item.label})
                        </span>
                      ) : isSelected ? (
                        <span className="selected-indicator-badge">Selected</span>
                      ) : (
                        <span className="tap-hint-badge">Tap to pair</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Center Connector Divider */}
          <div className="match-divider-line" aria-hidden="true">
            <span className="divider-icon">⚡</span>
          </div>

          {/* Right Column: Letters */}
          <div className="match-column letters-column">
            <h2 className="match-column-heading">
              <span>🔤</span> Letter Tiles
            </h2>
            <div className="match-cards-stack">
              {shuffledLetterCards.map((item) => {
                const isMatched = matchedPairs.has(item.label);
                const isSelected = selectedLetter === item.label;
                const isError = mismatchPair?.letter === item.label;

                return (
                  <button
                    key={`let-${item.label}`}
                    type="button"
                    className={`match-tile-card letter-tile ${isSelected ? 'tile-selected' : ''} ${isMatched ? 'tile-matched' : ''} ${isError ? 'tile-error' : ''}`}
                    onClick={() => handleLetterClick(item.label)}
                    disabled={isMatched || Boolean(mismatchPair)}
                    aria-label={`Letter ${item.label}`}
                  >
                    <span className="large-letter-glyph">{item.label}</span>
                    <div className="match-tile-label">
                      {isMatched ? (
                        <span className="matched-indicator-badge">
                          <Icon name="check" /> Matched
                        </span>
                      ) : isSelected ? (
                        <span className="selected-indicator-badge">Selected</span>
                      ) : (
                        <span className="tap-hint-badge">Tap to pair</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Victory Celebration Modal */}
      {isWon && (
        <div className="game-modal-overlay">
          <div className="game-victory-modal paper">
            <div className="victory-badge-circle">
              <span>🎉</span>
            </div>
            <h2>Matching Master!</h2>
            <p className="victory-subtitle">You paired all sign images with their correct letters!</p>

            <div className="victory-stats-row">
              <div className="victory-stat-item">
                <span>Total Tries</span>
                <strong>{attempts}</strong>
              </div>
              <div className="victory-stat-item">
                <span>Time Taken</span>
                <strong>{formatTime(seconds)}</strong>
              </div>
              <div className="victory-stat-item highlight">
                <span>XP Earned</span>
                <strong>+30 XP</strong>
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
