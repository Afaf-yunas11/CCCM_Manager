import React from 'react';

const roleLabels = {
  admin: 'Administrator',
  ngo: 'NGO Partner',
  campManager: 'Camp Manager',
  affectedPerson: 'Community Member',
};

export default function DashboardLayout({
  user,
  onLogout,
  portalTitle,
  title,
  subtitle,
  actions,
  children,
}) {
  const roleKey = user?.role || 'default';
  const displayRole = portalTitle || roleLabels[roleKey] || roleKey;

  return (
    <div className="dashboard-layout">
      {/* Top Navbar */}
      <header className="dashboard-header">
        <div className="dashboard-nav-container">
          <div className="dashboard-brand-group">
            <a className="dashboard-brand" href="/" aria-label="CCCM Manager Home">
              <span className="dashboard-brand-mark">C</span>
              <span>CCCM <strong>MANAGER</strong></span>
            </a>
            <span className={`dashboard-portal-pill ${roleKey}`}>
              {displayRole}
            </span>
          </div>

          <div className="dashboard-user-actions">
            <div className="dashboard-user-profile">
              <span className="dashboard-user-name">{user?.fullName || 'User'}</span>
              <span className="dashboard-user-email">{user?.email || ''}</span>
            </div>
            <button
              type="button"
              className="dashboard-signout-btn"
              onClick={onLogout}
              title="Sign out of your account"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Title & Action Banner */}
      {(title || subtitle || actions) && (
        <section className="dashboard-title-banner">
          <div className="dashboard-title-container">
            <div>
              {title && <h1 className="dashboard-page-title">{title}</h1>}
              {subtitle && <p className="dashboard-page-subtitle">{subtitle}</p>}
            </div>
            {actions && <div className="dashboard-banner-actions">{actions}</div>}
          </div>
        </section>
      )}

      {/* Main Full-Width Content */}
      <main className="dashboard-main-content">
        {children}
      </main>
    </div>
  );
}

