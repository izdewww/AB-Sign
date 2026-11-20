import { useState } from 'react';
import type { Student } from '../main/account-types.cjs';
import { BuddyAvatar } from './avatars';
import type { ClassroomStore } from './classroom';
import { Icon } from './icons';
import { StepProgress } from './learning-ui';
import { categories, categoryFor, type TeacherLibrary } from './lessons';
import { deriveLearnerStats, type LearnerStats } from './learner-profile';

interface LearnerDashboardProps {
  student: Student;
  store: ClassroomStore;
  library: TeacherLibrary;
}

export function LearnerDashboard({ student, store, library }: LearnerDashboardProps) {
  const stats: LearnerStats = deriveLearnerStats(student, store.data, library);
  const [showGoalCelebration, setShowGoalCelebration] = useState(false);

  // Resume link for continue lesson button
  const continueUrl = store.data.resume
    ? '#' + store.data.resume
    : stats.currentLesson
    ? `#lesson/${stats.currentLesson.id}`
    : '#path';

  // Learning units mapped from categories
  const units = [
    {
      unitNum: 1,
      id: 'alphabet',
      title: 'The Alphabet',
      description: 'A to Z Hand Shapes & Letters',
      status: store.data.completed.some((id) => library.visible.find((l) => l.id === id && (l.category || 'alphabet') === 'alphabet'))
        ? 'IN PROGRESS'
        : 'NEXT',
      icon: 'book',
      tone: 'mint',
      lessonsCount: library.visible.filter((l) => (l.category || 'alphabet') === 'alphabet').length,
      finishedCount: library.visible.filter((l) => (l.category || 'alphabet') === 'alphabet' && store.data.completed.includes(l.id)).length,
      isLocked: false,
    },
    {
      unitNum: 2,
      id: 'greetings',
      title: 'Greetings & Basics',
      description: 'Hello, Salamat, Please, Bye',
      status: store.data.completed.length >= 2 ? 'IN PROGRESS' : 'NEXT',
      icon: 'teach',
      tone: 'sky',
      lessonsCount: library.visible.filter((l) => l.category === 'greetings').length || 4,
      finishedCount: library.visible.filter((l) => l.category === 'greetings' && store.data.completed.includes(l.id)).length,
      isLocked: false,
    },
    {
      unitNum: 3,
      id: 'food',
      title: 'Food & Colors',
      description: 'Requires Unit 2 completion',
      status: 'LOCKED',
      icon: 'trophy',
      tone: 'peach',
      lessonsCount: library.visible.filter((l) => l.category === 'food').length || 6,
      finishedCount: 0,
      isLocked: true,
    },
  ];

  return (
    <div className="learner-dashboard-container">
      {/* 1. Welcome Header (Full-Width Horizontal Card) */}
      <header className="dashboard-welcome-banner paper">
        <div className="banner-avatar-section">
          <BuddyAvatar id={stats.buddy.id} size={78} />
        </div>

        <div className="banner-info-section">
          <div className="banner-pill-badge">
            <span className="sparkle-icon">✨</span>
            <span>WELCOME BACK!</span>
          </div>
          <h1 className="banner-greeting">Hi, {student.name}! Ready to sign?</h1>
          <p className="banner-status-text">
            <strong>Level {stats.level} • {stats.levelTitle}:</strong> {stats.encouragement}
          </p>
        </div>

        <div className="banner-actions-section">
          <a href="#camera-setup" className="button secondary check-camera-btn">
            <Icon name="camera" />
            <span>Check Camera</span>
          </a>
        </div>
      </header>

      {/* 2. Main Dashboard Layout (Two Columns) */}
      <div className="dashboard-columns-grid">
        {/* ========================================================= */}
        {/* LEFT COLUMN: Primary Learning Activities & Review        */}
        {/* ========================================================= */}
        <div className="dashboard-left-col">
          {/* Card A: Continue Learning – Current Lesson (Dark Green Background) */}
          <section className="continue-lesson-card paper">
            <div className="continue-card-top-row">
              <span className="up-next-badge">
                <span className="pulse-indicator" />
                UP NEXT
              </span>
              <span className="lesson-indicator-text">
                Lesson {stats.currentLessonIndex} of {stats.totalLessonsInCurrentUnit}
              </span>
            </div>

            <div className="continue-card-body">
              <div className="continue-lesson-icon-box">
                <Icon name="book" />
              </div>
              <div className="continue-lesson-text">
                <h2 className="continue-lesson-title">
                  {stats.currentLesson?.title ?? 'Letters & Signs A, B, C'}
                </h2>
                <p className="continue-lesson-category">
                  FSL Hand Shapes • {stats.currentLesson?.steps.length ?? 3} steps
                </p>
              </div>
            </div>

            <div className="continue-card-progress-section">
              <div className="progress-label-row">
                <span>Progress</span>
                <strong>{stats.currentLessonProgressPercent}%</strong>
              </div>
              <div className="custom-progress-track">
                <div
                  className="custom-progress-fill"
                  style={{ width: `${Math.max(10, stats.currentLessonProgressPercent)}%` }}
                />
              </div>
            </div>

            <div className="continue-card-action">
              <a href={continueUrl} className="button primary continue-lesson-btn">
                <span>CONTINUE LESSON</span>
                <Icon name="arrow" />
              </a>
            </div>
          </section>

          {/* Card B: Learning Path */}
          <section className="dashboard-card paper learning-path-section">
            <div className="card-header-row">
              <div>
                <h2 className="section-title">Learning Path</h2>
                <p className="section-subtitle">Step-by-step units designed for easy progress.</p>
              </div>
              <a href="#path" className="text-link view-path-link">
                View Learning Path <Icon name="arrow" />
              </a>
            </div>

            <div className="learning-units-list">
              {units.map((unit) => {
                const statusColor =
                  unit.status === 'IN PROGRESS' ? 'badge-in-progress' : unit.status === 'NEXT' ? 'badge-next' : 'badge-locked';

                return (
                  <div
                    key={unit.id}
                    className={`learning-unit-card paper ${unit.tone} ${unit.isLocked ? 'unit-locked' : ''}`}
                  >
                    <div className="unit-card-left">
                      <div className="unit-number-badge">Unit {unit.unitNum}</div>
                      <div className="unit-info">
                        <div className="unit-title-row">
                          <h3 className="unit-title">{unit.title}</h3>
                          <span className={`unit-status-tag ${statusColor}`}>{unit.status}</span>
                        </div>
                        <p className="unit-description">{unit.description}</p>
                      </div>
                    </div>

                    <div className="unit-card-right">
                      {!unit.isLocked ? (
                        <a
                          href={`#category/${unit.id}`}
                          className="button secondary unit-open-btn"
                          aria-label={`Open ${unit.title}`}
                        >
                          <span>{unit.status === 'IN PROGRESS' ? 'Continue' : 'Start'}</span>
                          <Icon name="arrow" />
                        </a>
                      ) : (
                        <div className="locked-pill" title="Complete previous units to unlock">
                          <span>🔒 Locked</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Card C: Recommended Review */}
          <section className="dashboard-card paper recommended-review-section">
            <div className="card-header-row">
              <div>
                <h2 className="section-title">Recommended Review</h2>
                <p className="section-subtitle">
                  Quick 1-minute replay to strengthen the signs you missed earlier.
                </p>
              </div>
              <span className="needs-practice-badge">
                <span className="dot-warn" /> Needs Practice
              </span>
            </div>

            <div className="recommended-sign-card paper">
              <div className="recommended-sign-art">
                <div className="sign-letter-circle">
                  <span>{stats.recommendedReview.id}</span>
                </div>
              </div>

              <div className="recommended-sign-details">
                <h3 className="recommended-sign-name">{stats.recommendedReview.name}</h3>
                <p className="recommended-sign-tip">
                  <span className="tip-bulb">💡</span> {stats.recommendedReview.tip}
                </p>
              </div>

              <div className="recommended-sign-action">
                <a
                  href={`#camera/${stats.recommendedReview.id}`}
                  className="button primary camera-practice-btn"
                >
                  <Icon name="camera" />
                  <span>PRACTICE WITH CAMERA</span>
                </a>
              </div>
            </div>
          </section>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: Goals, Statistics & Gamification           */}
        {/* ========================================================= */}
        <div className="dashboard-right-col">
          {/* Card A: Daily Goal */}
          <section className="dashboard-card paper daily-goal-card">
            <div className="card-header-row">
              <h2 className="section-title">Daily Goal</h2>
              <span className="daily-goal-pill">
                {stats.dailyGoal.completedToday} of {stats.dailyGoal.target} Signs Done
              </span>
            </div>

            <div className="daily-goal-body">
              <div className="target-label-row">
                <div className="target-icon-wrap">
                  <span className="target-icon">🎯</span>
                  <strong>Today&apos;s Target</strong>
                </div>
                <span className="target-percent-text">{stats.dailyGoal.percentage}%</span>
              </div>

              <div className="custom-progress-track">
                <div
                  className="custom-progress-fill green"
                  style={{ width: `${Math.max(5, stats.dailyGoal.percentage)}%` }}
                />
              </div>

              <p className="daily-goal-message">
                {stats.dailyGoal.isComplete ? (
                  <span className="goal-achieved-highlight">
                    🎉 Hooray! You reached your daily goal! Streak safe for tomorrow!
                  </span>
                ) : (
                  <>
                    Sign <strong>{stats.dailyGoal.remainingToday} more signs</strong> today to keep your{' '}
                    <strong>{Math.max(1, stats.streakDays)}-day streak</strong>!
                  </>
                )}
              </p>
            </div>
          </section>

          {/* Card B: Progress Overview */}
          <section className="dashboard-card paper progress-overview-card">
            <div className="card-header-row">
              <h2 className="section-title">Progress Overview</h2>
              <a href="#progress" className="text-link">
                View All Progress <Icon name="arrow" />
              </a>
            </div>

            <div className="stat-cards-grid">
              <div className="stat-tile paper sky">
                <div className="stat-tile-icon blue">
                  <Icon name="book" />
                </div>
                <div className="stat-tile-data">
                  <span className="stat-big-number">{stats.completedCount}</span>
                  <span className="stat-caption">Lessons Completed</span>
                  <span className="stat-subtext">Across {stats.completedCount > 0 ? 'Alphabet' : 'Starter'} Unit</span>
                </div>
              </div>

              <div className="stat-tile paper mint">
                <div className="stat-tile-icon green">
                  <Icon name="spark" />
                </div>
                <div className="stat-tile-data">
                  <span className="stat-big-number">{stats.masteredCount}</span>
                  <span className="stat-caption">Signs Mastered</span>
                  <span className="stat-subtext">FSL Hand Shapes</span>
                </div>
              </div>
            </div>

            <div className="accuracy-meter-row paper">
              <div className="accuracy-label-col">
                <span className="accuracy-title">Sign Match Accuracy</span>
                <span className="accuracy-desc">Camera &amp; Quiz Match Score</span>
              </div>
              <div className="accuracy-badge">
                <span>{stats.accuracyPercentage}%</span>
              </div>
            </div>
          </section>

          {/* Card C: Recent Badges */}
          <section className="dashboard-card paper recent-badges-card">
            <div className="card-header-row">
              <h2 className="section-title">Recent Badges</h2>
              <a href="#progress" className="text-link">
                View Achievements <Icon name="arrow" />
              </a>
            </div>

            <div className="badges-stack">
              {stats.recentBadges.map((badge) => (
                <div key={badge.id} className={`badge-card paper ${badge.tone}`}>
                  <div className="badge-visual">
                    {badge.icon === 'sprout' && <span className="badge-emoji">🌱</span>}
                    {badge.icon === 'flame' && <span className="badge-emoji">🔥</span>}
                    {badge.icon === 'camera' && <span className="badge-emoji">⭐</span>}
                  </div>
                  <div className="badge-copy">
                    <strong className="badge-title">{badge.title}</strong>
                    <p className="badge-description">{badge.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
