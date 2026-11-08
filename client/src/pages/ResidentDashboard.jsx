import React from 'react';

export default function ResidentDashboard({ user, onLogout }) {
  return (
    <main className="shell">
      <section className="auth-card welcome-card" aria-labelledby="res-title">
        <a className="brand" href="/" aria-label="CCCM Manager home">
          <span className="brand-mark" aria-hidden="true">C</span>
          <span>CCCM <strong>MANAGER</strong></span>
        </a>
        <p className="eyebrow">COMMUNITY MEMBER PORTAL</p>
        <h1 id="res-title">Welcome, {user.fullName}.</h1>
        <p className="intro">Your community services dashboard is coming soon.</p>
        <div className="account-summary">
          <span>{user.email}</span>
          <span>Community Member</span>
        </div>
        <button className="primary-button" onClick={onLogout}>Sign out</button>
      </section>
    </main>
  );
}

