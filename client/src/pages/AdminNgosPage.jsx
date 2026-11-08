import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../components/DashboardLayout';
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
      display: 'inline-block', padding: '3px 12px', borderRadius: 999,
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
      <div className="dashboard-filter-group">
        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, marginRight: 4 }}>Filter by status:</span>
        {[
          { key: 'pending', label: 'Pending Approval' },
          { key: 'approved', label: 'Approved' },
          { key: 'rejected', label: 'Rejected' },
          { key: '', label: 'All Applications' },
        ].map((s) => (
          <button
            key={s.key || 'all'}
            className={`dashboard-filter-btn ${filterStatus === s.key ? 'active' : ''}`}
            onClick={() => setFilterStatus(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error && <p className="feedback error">{error}</p>}
      {loading && <p className="feedback notice">Loading NGO applications…</p>}

      {!loading && ngos.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: '#64748b', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
          <p style={{ margin: 0, fontWeight: 500 }}>No NGO applications found{filterStatus ? ` with status "${filterStatus}"` : ''}.</p>
        </div>
      )}

      {ngos.length > 0 && (
        <div className="dashboard-table-container">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Organization</th>
                <th>Contact Representative</th>
                <th>Registered Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {ngos.map((ngo) => {
                const busy = actionBusy === ngo._id;
                return (
                  <tr key={ngo._id}>
                    <td>
                      <strong style={{ fontSize: '14px', color: '#0f172a' }}>{ngo.organizationName}</strong>
                      {ngo.operatingAreas && ngo.operatingAreas.length > 0 && (
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: 2 }}>
                          Areas: {ngo.operatingAreas.join(', ')}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{ngo.userId?.fullName || '—'}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{ngo.userId?.email || '—'}</div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap', color: '#64748b' }}>
                      {ngo.userId?.createdAt ? new Date(ngo.userId.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td><StatusBadge status={ngo.approvalStatus} /></td>
                    <td>
                      {ngo.approvalStatus === 'pending' && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            className="primary-button"
                            style={{
                              margin: 0, minHeight: 'auto', padding: '6px 14px',
                              fontSize: '12px', background: '#16a34a', borderColor: '#16a34a',
                              width: 'auto'
                            }}
                            disabled={busy}
                            onClick={() => handleAction(ngo._id, 'approved')}
                          >
                            {busy ? '…' : 'Approve'}
                          </button>
                          <button
                            className="primary-button"
                            style={{
                              margin: 0, minHeight: 'auto', padding: '6px 14px',
                              fontSize: '12px', background: '#dc2626', borderColor: '#dc2626',
                              width: 'auto'
                            }}
                            disabled={busy}
                            onClick={() => handleAction(ngo._id, 'rejected')}
                          >
                            {busy ? '…' : 'Reject'}
                          </button>
                        </div>
                      )}
                      {ngo.approvalStatus !== 'pending' && (
                        <span style={{ color: '#64748b', fontSize: '12px' }}>
                          {ngo.approvedBy ? `Reviewed by ${ngo.approvedBy.fullName}` : 'Processed'}
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

/* ───── Main Admin Page (Full-Width Tabbed Layout) ───────────────────────── */
export default function AdminNgosPage({ user, onLogout }) {
  const [tab, setTab] = useState('disasters');

  const tabs = [
    { key: 'disasters', label: 'Disaster Management' },
    { key: 'ngos', label: 'NGO Approvals & Profiles' },
  ];

  return (
    <DashboardLayout
      user={user}
      onLogout={onLogout}
      portalTitle="Admin Portal"
      title="CCCM Administration"
      subtitle="Coordinate disaster relief operations, manage active incidents, and review partner NGO registrations."
    >
      <div className="dashboard-card">
        {/* Navigation Tabs */}
        <div className="dashboard-tab-bar">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`dashboard-tab-item ${tab === t.key ? 'active' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'disasters' && <AdminDisastersPage />}
        {tab === 'ngos' && <NgoApprovalsTab />}
      </div>
    </DashboardLayout>
  );
}
