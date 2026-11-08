import React, { useState } from 'react';
import DashboardLayout from './components/DashboardLayout';
import AdminNgosPage from './pages/AdminNgosPage';
import NgoDashboard from './pages/NgoDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import ResidentDashboard from './pages/ResidentDashboard';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const roles = [
  { value: 'admin', label: 'Administrator' },
  { value: 'ngo', label: 'NGO partner' },
  { value: 'campManager', label: 'Camp manager' },
  { value: 'affectedPerson', label: 'Community member' },
];

async function request(path, body) {
  const response = await fetch(`${API_URL}/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error || 'The request could not be completed.');
    error.details = result;
    throw error;
  }
  return result;
}

export default function App() {
  const [page, setPage] = useState('login');
  const [notice, setNotice] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cccm-user') || 'null');
    } catch {
      return null;
    }
  });

  function showPage(nextPage) {
    setPage(nextPage);
    setNotice('');
    setErrorMessage('');
  }

  async function submit(event, action) {
    const form = event.currentTarget;
    event.preventDefault();
    setBusy(true);
    setNotice('');
    setErrorMessage('');
    try {
      await action();
    } catch (error) {
      if (error.details?.needsVerification) {
        setEmail(error.details.email);
        setPage('verify');
      }
      if (error.details?.accountCreated) {
        setEmail(form.elements.namedItem('email')?.value || email);
        setPage('verify');
      }
      setErrorMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSignup(event) {
    const values = new FormData(event.currentTarget);
    setEmail(String(values.get('email') || ''));
    await submit(event, async () => {
      const result = await request('signup', Object.fromEntries(values));
      setEmail(result.email);
      setPage('verify');
      setNotice(result.message);
    });
  }

  async function handleLogin(event) {
    const values = new FormData(event.currentTarget);
    await submit(event, async () => {
      const result = await request('login', Object.fromEntries(values));
      localStorage.setItem('cccm-token', result.token);
      localStorage.setItem('cccm-user', JSON.stringify(result.user));
      setUser(result.user);
    });
  }

  async function handleVerification(event) {
    const values = new FormData(event.currentTarget);
    await submit(event, async () => {
      const result = await request('verify-email', {
        email,
        code: values.get('code'),
      });
      setPage('login');
      setNotice(result.message);
    });
  }

  async function resendCode() {
    setBusy(true);
    setNotice('');
    setErrorMessage('');
    try {
      const result = await request('resend-verification', { email });
      setNotice(result.message);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem('cccm-token');
    localStorage.removeItem('cccm-user');
    setUser(null);
    showPage('login');
  }

  // ── Role-based routing ────────────────────────────────────────────────────
  if (user) {
    if (user.role === 'admin') return <AdminNgosPage user={user} onLogout={logout} />;
    if (user.role === 'ngo') return <NgoDashboard user={user} onLogout={logout} />;
    if (user.role === 'campManager') return <ManagerDashboard user={user} onLogout={logout} />;
    if (user.role === 'affectedPerson') return <ResidentDashboard user={user} onLogout={logout} />;

    // Fallback for unrecognised roles
    return (
      <DashboardLayout
        user={user}
        onLogout={logout}
        portalTitle="User Portal"
        title={`Welcome, ${user.fullName}`}
        subtitle="Your CCCM account is active."
      >
        <div className="dashboard-card" style={{ maxWidth: 600 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '16px' }}>Account Information</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '13px', color: '#475569' }}>
            <div><strong>Email:</strong> {user.email}</div>
            <div><strong>Role:</strong> {roles.find((r) => r.value === user.role)?.label || user.role}</div>
            <div><strong>Status:</strong> {user.accountStatus}</div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ── Auth pages (login / signup / verify) ─────────────────────────────────
  return (
    <main className="shell">
      <section className="auth-card" aria-labelledby="form-title">
        <Brand />
        {page === 'verify' ? (
          <form onSubmit={handleVerification}>
            <p className="eyebrow">EMAIL VERIFICATION</p>
            <h1 id="form-title">Check your inbox.</h1>
            <p className="intro">Enter the six-digit code sent to <strong>{email}</strong>.</p>
            <label htmlFor="code">Verification code</label>
            <input id="code" name="code" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength="6" autoComplete="one-time-code" required />
            <Feedback notice={notice} error={errorMessage} />
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? 'Verifying…' : 'Verify email'}
            </button>
            <button className="text-button" type="button" onClick={resendCode} disabled={busy}>Resend code</button>
            <button className="text-button" type="button" onClick={() => showPage('login')}>Back to login</button>
          </form>
        ) : page === 'signup' ? (
          <form onSubmit={handleSignup}>
            <p className="eyebrow">CREATE AN ACCOUNT</p>
            <h1 id="form-title">Join the response.</h1>
            <p className="intro">Create an account to coordinate support and services.</p>
            <label htmlFor="fullName">Full name</label>
            <input id="fullName" name="fullName" type="text" autoComplete="name" maxLength="100" required />
            <label htmlFor="signupEmail">Email address</label>
            <input id="signupEmail" name="email" type="email" autoComplete="email" maxLength="254" required />
            <label htmlFor="role">I'm joining as</label>
            <select id="role" name="role" defaultValue="affectedPerson" required>
              {roles.map((role) => <option value={role.value} key={role.value}>{role.label}</option>)}
            </select>
            <label htmlFor="organizationName">Organization name <span className="optional">(NGO partners)</span></label>
            <input id="organizationName" name="organizationName" type="text" maxLength="120" />
            <label htmlFor="signupPassword">Password</label>
            <input id="signupPassword" name="password" type="password" autoComplete="new-password" minLength="8" maxLength="128" required />
            <Feedback notice={notice} error={errorMessage} />
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? 'Creating account…' : 'Create account'}
            </button>
            <p className="switch-copy">Already registered? <button className="inline-button" type="button" onClick={() => showPage('login')}>Log in</button></p>
          </form>
        ) : (
          <form onSubmit={handleLogin}>
            <p className="eyebrow">WELCOME BACK</p>
            <h1 id="form-title">Sign in to continue.</h1>
            <p className="intro">Access your CCCM coordination workspace.</p>
            <label htmlFor="loginEmail">Email address</label>
            <input id="loginEmail" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            <label htmlFor="loginPassword">Password</label>
            <input id="loginPassword" name="password" type="password" autoComplete="current-password" required />
            <Feedback notice={notice} error={errorMessage} />
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Log in'}
            </button>
            <p className="switch-copy">New to CCCM Manager? <button className="inline-button" type="button" onClick={() => showPage('signup')}>Create an account</button></p>
          </form>
        )}
      </section>
      <p className="footer-note">Coordination starts with connection.</p>
    </main>
  );
}

function Brand() {
  return (
    <a className="brand" href="/" aria-label="CCCM Manager home">
      <span className="brand-mark" aria-hidden="true">C</span>
      <span>CCCM <strong>MANAGER</strong></span>
    </a>
  );
}

function Feedback({ notice, error }) {
  return (
    <>
      {notice && <p className="feedback notice" role="status">{notice}</p>}
      {error && <p className="feedback error" role="alert">{error}</p>}
    </>
  );
}
