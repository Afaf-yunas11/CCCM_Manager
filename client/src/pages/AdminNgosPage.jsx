import React, { useState, useEffect, useCallback } from 'react';
import AdminDisastersPage from './AdminDisastersPage';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('cccm-token');
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || data.error || 'Request failed');
  return data;
}

function StatusBadge({ status }) {
  const colors = { pending: '#d97706', approved: '#16a34a', rejected: '#dc2626' };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 999,
      fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.05em', background: colors[status] || '#6b7280', color: '#fff',
    }}>
      {status}
    </span>
  );
}

/* ───── NGO Approvals Tab ────────────────────────────────────────────────── */
function NgoApprovalsTab() {
  const [ngos, setNgos] = useState([]);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionBusy, setActionBusy] = useState(null);

  const loadNgos = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = filterStatus ? `?status=${filterStatus}` : '';
      const data = await apiFetch(`/admin/ngos${qs}`);
      setNgos(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { loadNgos(); }, [loadNgos]);

  async function handleAction(ngoId, action) {
    setActionBusy(ngoId);
    try {
      await apiFetch(`/admin/ngos/${ngoId}`, { method: 'PATCH', body: JSON.stringify({ status: action }) });
      await loadNgos();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionBusy(null);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['pending', 'approved', 'rejected', ''].map((s) => (
          <button key={s || 'all'} className={filterStatus === s ? 'primary-button' : 'text-button'}
            style={{ padding: '6px 14px', fontSize: '0.85rem' }}
            onClick={() => setFilterStatus(s)}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {error && <p className="feedback error">{error}</p>}
      {loading && <p className="feedback notice">Loading…</p>}

      {!loading && ngos.length === 0 && (
        <p style={{ color: '#6b7280', textAlign: 'center', padding: '32px 0' }}>
          No NGO applications found{filterStatus ? ` with status "${filterStatus}"` : ''}.
        </p>
      )}

      {ngos.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px' }}>Organization</th>
                <th style={{ padding: '8px 12px' }}>Contact</th>
                <th style={{ padding: '8px 12px' }}>Registered</th>
                <th style={{ padding: '8px 12px' }}>Status</th>
                <th style={{ padding: '8px 12px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {ngos.map((ngo) => {
                const busy = actionBusy === ngo._id;
                return (
                  <tr key={ngo._id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <strong>{ngo.organizationName}</strong>
                      {ngo.userId && <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{ngo.userId.fullName}</div>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>{ngo.userId?.email || '—'}</td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      {ngo.userId?.createdAt ? new Date(ngo.userId.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}><StatusBadge status={ngo.approvalStatus} /></td>
                    <td style={{ padding: '10px 12px' }}>
                      {ngo.approvalStatus === 'pending' && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="primary-button"
                            style={{ padding: '4px 12px', fontSize: '0.8rem', background: '#16a34a' }}
                            disabled={busy} onClick={() => handleAction(ngo._id, 'approved')}>
                            {busy ? '…' : 'Approve'}
                          </button>
                          <button className="primary-button"
                            style={{ padding: '4px 12px', fontSize: '0.8rem', background: '#dc2626' }}
                            disabled={busy} onClick={() => handleAction(ngo._id, 'rejected')}>
                            {busy ? '…' : 'Reject'}
                          </button>
                        </div>
                      )}
                      {ngo.approvalStatus !== 'pending' && (
                        <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                          {ngo.approvedBy ? `by ${ngo.approvedBy.fullName}` : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ───── Main Admin Page (tabbed) ─────────────────────────────────────────── */
export default function AdminNgosPage({ user, onLogout }) {
  const [tab, setTab] = useState('disasters');

  const tabs = [
    { key: 'disasters', label: 'Disasters' },
    { key: 'ngos', label: 'NGO Approvals' },
  ];

  return (
    <main className="shell">
      <section className="auth-card" style={{ maxWidth: 900, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <p className="eyebrow">ADMIN PANEL</p>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>CCCM Administration</h1>
          </div>
          <button className="text-button" onClick={onLogout}>Sign out</button>
        </div>
        <p style={{ color: '#6b7280', marginBottom: 16 }}>
          Logged in as <strong>{user.fullName}</strong> ({user.email})
        </p>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e5e7eb', marginBottom: 20 }}>
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                padding: '10px 20px', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                background: 'none', border: 'none',
                borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent',
                color: tab === t.key ? '#2563eb' : '#6b7280',
                marginBottom: -2,
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'disasters' && <AdminDisastersPage />}
        {tab === 'ngos' && <NgoApprovalsTab />}
      </section>
    </main>
  );
}
