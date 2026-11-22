import { useEffect, useState } from 'react';
import type { Student } from '../main/account-types.cjs';
import type { ClassroomStore } from './classroom';
import { Icon } from './icons';
import { labels, letters } from './letters';
import { shuffle } from './quiz';
import { vocabulary } from './vocabulary';

interface VocabQuestion {
  term: string;
  category: string;
  photo?: string;
  prompt: string;
  choices: string[];
  correct: string;
}

interface VocabChallengeGameProps {
  store?: ClassroomStore;
  student?: Student;
  onExit: () => void;
}

const TOTAL_QUESTIONS = 5;

export function VocabChallengeGame({ store, student, onExit }: VocabChallengeGameProps) {
  const [questions, setQuestions] = useState<VocabQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  // Generate 5 daily quest questions mixing numbers, alphabet signs, and vocabulary
  const initChallenge = () => {
    const list: VocabQuestion[] = [];

    // 1. First 2 questions: Everyday Numbers & Vocabulary signs
    const numberTerms = vocabulary.find((v) => v.category === 'numbers')?.terms || [];
    const validTerms = numberTerms.filter((t) => t.term);

    const shuffledVocab = shuffle([...validTerms]);
    shuffledVocab.slice(0, 2).forEach((item) => {
      const distractors = shuffle(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].filter((t) => t !== item.term)).slice(0, 3);
      list.push({
        term: item.term,
        category: 'Numbers & Counting',
        prompt: `What number does this FSL sign represent?`,
        choices: shuffle([item.term, ...distractors]),
        correct: item.term,
      });
    });

    // 2. Next 3 questions: Core Alphabet / Word Signs
    const shuffledLetters = shuffle([...letters]);
    shuffledLetters.slice(0, 3).forEach((item) => {
      const distractors = shuffle(labels.filter((l) => l !== item.label)).slice(0, 3);
      list.push({
        term: item.label,
        category: 'Alphabet & Words',
        photo: item.photo,
        prompt: `Identify the FSL sign for letter ${item.label}:`,
        choices: shuffle([item.label, ...distractors]),
        correct: item.label,
      });
    });

    setQuestions(list.slice(0, TOTAL_QUESTIONS));
    setCurrentIndex(0);
    setSelectedChoice(null);
    setIsAnswered(false);
    setScore(0);
    setIsCompleted(false);
  };

  useEffect(() => {
    initChallenge();
  }, []);

  const handleSelect = (choice: string) => {
    if (isAnswered) return;
    setIsAnswered(true);
    setSelectedChoice(choice);

    const q = questions[currentIndex];
    const isCorrect = choice === q.correct;

    if (isCorrect) {
      setScore((s) => s + 1);
    }

    setTimeout(() => {
      if (currentIndex + 1 >= TOTAL_QUESTIONS) {
        setIsCompleted(true);
        try {
          store?.record({
            activity: 'daily',
            title: 'Vocabulary Challenge',
            score: isCorrect ? score + 1 : score,
            total: TOTAL_QUESTIONS,
            missed: [],
            lesson: 'daily-vocabulary',
          });
        } catch {
          // Safe fallback
        }
      } else {
        setCurrentIndex((i) => i + 1);
        setSelectedChoice(null);
        setIsAnswered(false);
      }
    }, 950);
  };

  const currentQ = questions[currentIndex];

  return (
    <div className="vocab-challenge-arena">
      {/* Top Header */}
      <header className="game-arena-header paper">
        <div className="arena-header-left">
          <button type="button" className="button secondary btn-3d back-to-hub-btn" onClick={onExit}>
            <Icon name="back" />
            <span>Games Hub</span>
          </button>
          <div className="game-title-info">
            <span className="game-eyebrow-pill peach">DAILY QUEST</span>
            <h1 className="game-screen-title">Vocabulary Challenge</h1>
          </div>
        </div>

        <div className="arena-header-right">
          <div className="game-stat-pill">
            <span className="stat-label">Daily Quest</span>
            <strong className="stat-value">{currentIndex + 1} of {TOTAL_QUESTIONS}</strong>
          </div>
          <div className="game-stat-pill score-pill">
            <span className="stat-label">Score</span>
            <strong className="stat-value">{score} / {currentIndex + (isAnswered ? 1 : 0)}</strong>
          </div>
        </div>
      </header>

      {/* Progress Dots */}
      <div className="quest-progress-dots">
        {questions.map((_, idx) => (
          <span
            key={idx}
            className={`quest-dot ${idx < currentIndex ? 'completed' : idx === currentIndex ? 'current' : ''}`}
          />
        ))}
      </div>

      {/* Main Challenge Stage */}
      {currentQ && !isCompleted && (
        <div className="vocab-quest-workspace paper">
          <div className="quest-card-header">
            <span className="quest-category-badge">{currentQ.category}</span>
            <h2 className="quest-prompt-title">{currentQ.prompt}</h2>
          </div>

          {currentQ.photo ? (
            <div className="quest-media-box">
              <img src={currentQ.photo} alt="FSL gesture" className="quest-sign-image" />
            </div>
          ) : (
            <div className="quest-media-box text-sign-box">
              <span className="quest-term-hero">{currentQ.term}</span>
              <span className="quest-hint-label">Find the matching sign key</span>
            </div>
          )}

          <div className="quest-options-grid">
            {currentQ.choices.map((choice) => {
              const isSelected = selectedChoice === choice;
              const isCorrect = choice === currentQ.correct;
              let btnClass = 'secondary';
              if (isAnswered) {
                if (isCorrect) btnClass = 'choice-correct';
                else if (isSelected) btnClass = 'choice-incorrect';
              }

              return (
                <button
                  key={choice}
                  type="button"
                  className={`button ${btnClass} btn-3d quest-choice-btn`}
                  onClick={() => handleSelect(choice)}
                  disabled={isAnswered}
                >
                  <span>{choice}</span>
                  {isAnswered && isCorrect && <Icon name="check" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Daily Quest Complete Modal */}
      {isCompleted && (
        <div className="game-modal-overlay">
          <div className="game-victory-modal paper">
            <div className="victory-badge-circle peach">
              <span>🔥</span>
            </div>
            <h2>Daily Quest Defended!</h2>
            <p className="victory-subtitle">
              {student ? `Way to go, ${student.name}! Your daily streak is safe.` : 'Great job! Daily quest complete.'}
            </p>

            <div className="victory-stats-row">
              <div className="victory-stat-item">
                <span>Signs Solved</span>
                <strong>{score} / {TOTAL_QUESTIONS}</strong>
              </div>
              <div className="victory-stat-item">
                <span>Streak Status</span>
                <strong>Active 🔥</strong>
              </div>
              <div className="victory-stat-item highlight">
                <span>Daily Reward</span>
                <strong>+60 XP</strong>
              </div>
            </div>

            <div className="victory-actions-row">
              <button type="button" className="button primary btn-3d" onClick={initChallenge}>
                <Icon name="retry" />
                <span>Practice Again</span>
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
