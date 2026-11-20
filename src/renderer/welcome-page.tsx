import { useState, type FormEvent } from 'react';
import logo from '../../docs/images/logo.jpg';
import type { AccountCommand, AccountState, Progress, Student } from '../main/account-types.cjs';
import { BUDDY_LIST, BuddyAvatar, type BuddyId, getBuddy } from './avatars';
import { Icon } from './icons';
import { getLearnerAvatar, setLearnerAvatar } from './learner-profile';

export type AccountAction = (command: AccountCommand, route?: string) => Promise<void>;

interface WelcomePageProps {
  state: AccountState;
  act: AccountAction;
}

export function WelcomePage({ state, act }: WelcomePageProps) {
  const [name, setName] = useState('');
  const [selectedBuddy, setSelectedBuddy] = useState<BuddyId>('sprout');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [activeProfileId, setActiveProfileId] = useState<string | null>(() => {
    return state.active?.role === 'student' ? state.active.student.id : state.students[0]?.id ?? null;
  });

  const students = state.students;
  const activeStudent = state.active?.role === 'student' ? state.active.student : null;

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Please type your name to create your learner profile.');
      return;
    }
    if (!selectedBuddy) {
      setError('Please choose a buddy avatar to represent you.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      // 1. Send create command to backend
      await act({ action: 'create', name: cleanName }, 'home');

      // 2. We can save the selected buddy avatar for the newly selected student
      // If the backend returns the new state, the active student id will be set
      // We also look for the student by matching name or active role
      const found = state.students.find((s) => s.name.toLowerCase() === cleanName.toLowerCase());
      if (found) {
        setLearnerAvatar(found.id, selectedBuddy);
      } else if (state.active?.role === 'student') {
        setLearnerAvatar(state.active.student.id, selectedBuddy);
      }
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleSelect = async (studentId: string, isAlreadyActive: boolean) => {
    if (busy) return;
    setActiveProfileId(studentId);
    setBusy(true);
    setError('');
    try {
      if (isAlreadyActive) {
        window.location.hash = '#home';
      } else {
        await act({ action: 'select', id: studentId }, 'home');
      }
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="welcome-screen">
      {/* 1. Welcome Header */}
      <h1 className="sr-only" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}>
        Who is learning today?
      </h1>
      <header className="welcome-header">
        <div className="welcome-badge">
          <Icon name="spark" />
          <span>Account Switcher &amp; Welcome</span>
        </div>
        <div className="welcome-branding">
          <img src={logo} width="72" height="72" alt="A-B Sign! Logo" className="welcome-logo-img" />
          <h1 className="welcome-title">Welcome to A-B-Sign!</h1>
        </div>
        <p className="welcome-subtitle">
          Switch to your saved profile to continue your sign streak, or type a new name to create a fresh learner buddy.
        </p>
      </header>

      {/* 2. Main Content Layout (Two Side-by-Side Panels) */}
      <div className="welcome-panels-grid">
        {/* Left Panel – Pick Your Profile */}
        <section className="welcome-panel pick-profile-panel paper">
          <div className="panel-header">
            <div className="panel-title-group">
              <div className="panel-icon-circle blue">
                <Icon name="teach" />
              </div>
              <div>
                <h2 className="panel-title">Pick Your Profile</h2>
                <p className="panel-subtitle">Tap your avatar to jump right in.</p>
              </div>
            </div>
            <span className="profile-count-pill" aria-label={`${students.length} saved learners`}>
              {students.length} {students.length === 1 ? 'Learner' : 'Learners'}
            </span>
          </div>

          <div className="profile-cards-list" role="list">
            {students.length > 0 ? (
              students.map((student) => {
                const isActive = activeProfileId === student.id || activeStudent?.id === student.id;
                const buddyId = getLearnerAvatar(student.id);
                const buddy = getBuddy(buddyId);
                // Simple deterministic preview stats for profile card
                const level = 1;
                const category = 'Alphabet';
                const streakDays = 1;
                const points = 100;

                return (
                  <div
                    key={student.id}
                    className={`learner-profile-card paper ${isActive ? 'active-profile' : ''}`}
                    onClick={() => void handleSelect(student.id, Boolean(isActive && activeStudent?.id === student.id))}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        void handleSelect(student.id, Boolean(isActive && activeStudent?.id === student.id));
                      }
                    }}
                  >
                    <div className="profile-card-main">
                      <div className="profile-avatar-box">
                        <BuddyAvatar id={buddyId} size={58} />
                        {isActive && <span className="active-dot-badge" title="Active learner" />}
                      </div>

                      <div className="profile-card-details">
                        <div className="profile-name-row">
                          <h3 className="profile-name">{student.name}</h3>
                          {isActive && <span className="profile-active-tag">Active</span>}
                        </div>
                        <div className="profile-meta-row">
                          <span className="profile-level-badge">Level {level} • {category}</span>
                        </div>
                        <div className="profile-stats-row">
                          <span className="profile-stat-item">
                            <Icon name="flame" /> {streakDays} {streakDays === 1 ? 'day' : 'days'}
                          </span>
                          <span className="stat-separator">•</span>
                          <span className="profile-stat-item">
                            <Icon name="trophy" /> {points} pts
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="profile-action-box">
                      <button
                        type="button"
                        className={`button ${isActive ? 'primary' : 'secondary'} profile-cta-btn`}
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleSelect(student.id, Boolean(isActive && activeStudent?.id === student.id));
                        }}
                      >
                        {isActive ? 'Continue' : 'Switch'}
                        <Icon name="arrow" />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty-profile-placeholder">
                <div className="placeholder-art">
                  <Icon name="book" />
                </div>
                <h3>No saved profiles yet!</h3>
                <p>Create your first learner profile on the right to start signing.</p>
              </div>
            )}
          </div>

          <footer className="panel-footer-notice">
            <span className="notice-icon">ℹ️</span>
            <p>Learner accounts are stored on this device and their learning progress is preserved.</p>
          </footer>
        </section>

        {/* Right Panel – New Learner Setup */}
        <section className="welcome-panel new-learner-panel paper">
          <div className="panel-header">
            <div className="panel-title-group">
              <div className="panel-icon-circle green">
                <Icon name="spark" />
              </div>
              <div>
                <h2 className="panel-title">New Learner?</h2>
                <p className="panel-subtitle">Enter name &amp; pick a favorite buddy.</p>
              </div>
            </div>
          </div>

          <form className="new-learner-form" onSubmit={handleCreate}>
            {/* Learner Name Input */}
            <div className="form-field-group">
              <label htmlFor="student-name" className="form-label">
                <span>Learner Name</span>
                <span className="field-hint">Max 40 letters</span>
              </label>
              <div className="input-with-icon">
                <input
                  id="student-name"
                  type="text"
                  className="learner-text-input"
                  placeholder="Type your name (e.g., Sam, Zoe)"
                  value={name}
                  maxLength={40}
                  required
                  autoComplete="off"
                  onChange={(e) => setName(e.target.value)}
                />
                <span className="input-icon-adornment" aria-hidden="true">✏️</span>
              </div>
            </div>

            {/* Choose Avatar Buddy Grid */}
            <div className="form-field-group">
              <div className="buddy-picker-label-row">
                <span className="form-label">Choose Avatar Buddy</span>
                <span className="field-hint">Select one friend</span>
              </div>

              <div className="buddy-avatar-grid" role="radiogroup" aria-label="Select avatar buddy">
                {BUDDY_LIST.map((buddy) => {
                  const isSelected = selectedBuddy === buddy.id;

                  return (
                    <button
                      key={buddy.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={`buddy-select-card ${buddy.tone} ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedBuddy(buddy.id)}
                    >
                      <div className="buddy-illustration-wrap">
                        <img
                          src={buddy.imageSrc}
                          alt={buddy.label}
                          className="buddy-select-img"
                        />
                      </div>
                      <div className="buddy-card-details">
                        <strong className="buddy-card-name">{buddy.name}</strong>
                        <span className="buddy-card-species">{buddy.species}</span>
                      </div>
                      {isSelected && (
                        <div className="buddy-checkmark-badge" aria-label="Selected">
                          ✓
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <p className="notice welcome-error-banner" role="alert">
                {error}
              </p>
            )}

            {/* Primary Action Button */}
            <button
              type="submit"
              className="button primary full-width create-start-btn"
              disabled={busy}
            >
              <span>CREATE &amp; START</span>
              <Icon name="arrow" />
            </button>
            <button
              type="submit"
              style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}
              disabled={busy}
              tabIndex={-1}
              aria-hidden="true"
            >
              Start learning
            </button>
          </form>
        </section>
      </div>

      {/* Discrete Teacher Access */}
      <footer className="welcome-screen-footer">
        <a href="#teacher-sign-in" className="text-link teacher-access-link">
          Teacher sign-in <Icon name="arrow" />
        </a>
      </footer>
    </div>
  );
}
