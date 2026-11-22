import logo from '../../docs/images/logo.jpg';
import type { Student } from '../main/account-types.cjs';
import { BuddyAvatar } from './avatars';
import { Icon } from './icons';
import { getLearnerAvatar } from './learner-profile';

interface NavigationSidebarProps {
  student: Student;
  activeRoute: string;
  daysStreak: number;
  onSwitchAccount: () => void;
}

export function NavigationSidebar({
  student,
  activeRoute,
  daysStreak,
  onSwitchAccount,
}: NavigationSidebarProps) {
  const buddyId = getLearnerAvatar(student.id);

  const navItems = [
    { key: 'home', label: 'Dashboard', icon: 'home', href: '#home' },
    { key: 'path', label: 'Learning Path', icon: 'map', href: '#path' },
    { key: 'activities', label: 'Games & Practice', icon: 'game', href: '#activities' },
    { key: 'progress', label: 'My Progress', icon: 'chart', href: '#progress' },
    { key: 'camera', label: 'Free Camera', icon: 'camera', href: '#camera' },
  ] as const;

  return (
    <aside className="global-nav-sidebar" aria-label="Learner Navigation">
      {/* Top Brand Header */}
      <div className="sidebar-brand-header">
        <a href="#home" className="sidebar-brand-link" title="Return to Dashboard">
          <div className="brand-badge-emerald">
            <span className="brand-emoji-sign" aria-hidden="true">🤟</span>
          </div>
          <div className="brand-title-group">
            <span className="brand-title">A-B-Sign!</span>
            <span className="brand-subtitle">FSL Learning</span>
          </div>
        </a>
      </div>

      {/* Primary Navigation Links (5 Global Routes) */}
      <nav className="sidebar-nav-menu">
        {navItems.map((item) => {
          const isActive =
            activeRoute === item.key ||
            (item.key === 'path' && ['learn', 'category', 'lesson'].includes(activeRoute)) ||
            (item.key === 'activities' && ['match'].includes(activeRoute));

          return (
            <a
              key={item.key}
              href={item.href}
              className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="nav-item-icon-box">
                <Icon name={item.icon} />
              </div>
              <span className="nav-item-label">{item.label}</span>
              {isActive && <span className="active-indicator-pill" />}
            </a>
          );
        })}
      </nav>

      {/* Bottom Profile Footer */}
      <div className="sidebar-profile-footer">
        <div className="sidebar-profile-main">
          <BuddyAvatar id={buddyId} size={42} />
          <div className="sidebar-profile-info">
            <strong className="sidebar-student-name">{student.name}</strong>
            <span className="sidebar-student-streak">
              <Icon name="flame" /> {daysStreak} {daysStreak === 1 ? 'day' : 'days'}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="sidebar-settings-btn"
          title="Switch profile or accounts"
          aria-label="Switch account"
          onClick={onSwitchAccount}
        >
          <Icon name="settings" />
          <span>Switch account</span>
        </button>
      </div>
    </aside>
  );
}
