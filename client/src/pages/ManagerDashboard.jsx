import React from 'react';

export default function ManagerDashboard({ user, onLogout }) {
  return (
    <main className="shell">
      <section className="auth-card welcome-card" aria-labelledby="mgr-title">
        <a className="brand" href="/" aria-label="CCCM Manager home">
          <span className="brand-mark" aria-hidden="true">C</span>
          <span>CCCM <strong>MANAGER</strong></span>
        </a>
        <p className="eyebrow">CAMP MANAGER PORTAL</p>
        <h1 id="mgr-title">Welcome, {user.fullName}.</h1>
        <p className="intro">Your camp management dashboard is coming soon.</p>
        <div className="account-summary">
          <span>{user.email}</span>
          <span>Camp Manager</span>
        </div>
        <button className="primary-button" onClick={onLogout}>Sign out</button>
      </section>
    </main>
  );
}

