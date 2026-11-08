import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../components/DashboardLayout';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('cccm-token');
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'Request failed');
  return data;
}

const severityColors = { low: '#3b82f6', medium: '#d97706', high: '#ea580c', critical: '#dc2626' };

function Badge({ color, children }) {
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 999,
      fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.05em', background: color, color: '#fff',
    }}>
      {children}
    </span>
  );
}

const formInputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 6,
  border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box',
  background: '#ffffff', color: '#0f172a'
};

/* ───── Respond Form ─────────────────────────────────────────────────────── */
function RespondForm({ disaster, onDone, onCancel }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resources, setResources] = useState([{ type: '', quantity: '' }]);

  function addResource() {
    setResources([...resources, { type: '', quantity: '' }]);
  }

  function updateResource(i, field, value) {
    const copy = [...resources];
    copy[i] = { ...copy[i], [field]: value };
    setResources(copy);
  }

  function removeResource(i) {
    setResources(resources.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    try {
      const body = {
        workAreas: (fd.get('workAreas') || '').split(',').map((s) => s.trim()).filter(Boolean),
        plannedActivities: (fd.get('plannedActivities') || '').split(',').map((s) => s.trim()).filter(Boolean),
        resourcesOffered: resources
          .filter((r) => r.type.trim())
          .map((r) => ({ type: r.type.trim(), quantity: Number(r.quantity) || 0 })),
      };
      if (!body.workAreas.length) { setError('Enter at least one work area.'); setBusy(false); return; }
      if (!body.plannedActivities.length) { setError('Enter at least one activity.'); setBusy(false); return; }

      await apiFetch(`/ngo/disasters/${disaster._id}/respond`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{
      marginTop: 16, padding: 20, background: '#f0fdf4',
      borderRadius: 8, border: '1px solid #bbf7d0'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h4 style={{ margin: 0, fontSize: '15px', color: '#166534', fontWeight: 700 }}>
          Commitment Response for: {disaster.title}
        </h4>
        <button type="button" onClick={onCancel} className="dashboard-signout-btn" style={{ padding: '4px 10px', fontSize: '11px' }}>
          ✕ Close
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#166534', marginBottom: 6 }}>
            Operational Work Areas * <span style={{ fontWeight: 400, color: '#64748b' }}>(comma-separated)</span>
          </label>
          <input
            name="workAreas"
            type="text"
            placeholder="e.g. Shelter, WASH, Health, Food Security"
            required
            style={formInputStyle}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#166534', marginBottom: 6 }}>
            Planned Relief Activities * <span style={{ fontWeight: 400, color: '#64748b' }}>(comma-separated)</span>
          </label>
          <input
            name="plannedActivities"
            type="text"
            placeholder="e.g. Distribute water kits, Set up temporary camps, Mobile clinic"
            required
            style={formInputStyle}
          />
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#166534', marginBottom: 6 }}>
          Allocated Resources & Supplies <span style={{ fontWeight: 400, color: '#64748b' }}>(optional)</span>
        </label>
        {resources.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Item / Resource name (e.g. Family Tents, Hygiene Kits)"
              value={r.type}
              onChange={(e) => updateResource(i, 'type', e.target.value)}
              style={{ ...formInputStyle, flex: 2 }}
            />
            <input
              type="number"
              placeholder="Quantity"
              min="0"
              value={r.quantity}
              onChange={(e) => updateResource(i, 'quantity', e.target.value)}
              style={{ ...formInputStyle, flex: 1 }}
            />
            {resources.length > 1 && (
              <button
                type="button"
                onClick={() => removeResource(i)}
                style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '16px', padding: '4px 8px' }}
                title="Remove item"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addResource}
          style={{ background: 'none', border: 'none', color: '#166534', cursor: 'pointer', fontSize: '12px', fontWeight: 600, padding: 0 }}
        >
          + Add another supply line
        </button>
      </div>

      {error && <p className="feedback error">{error}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button
          className="primary-button"
          type="submit"
          disabled={busy}
          style={{ width: 'auto', margin: 0, padding: '8px 22px', minHeight: 'auto', background: '#16a34a', borderColor: '#16a34a' }}
        >
          {busy ? 'Submitting…' : 'Confirm & Submit Commitment'}
        </button>
        <button type="button" className="dashboard-signout-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ───── Main NGO Dashboard Page (Full-Width) ─────────────────────────────── */
export default function NgoDashboard({ user, onLogout }) {
  const [disasters, setDisasters] = useState([]);
  const [commitments, setCommitments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [respondingTo, setRespondingTo] = useState(null);
  const [tab, setTab] = useState('disasters');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [disasterData, commitmentData] = await Promise.all([
        apiFetch('/ngo/disasters'),
        apiFetch('/ngo/commitments'),
      ]);
      setDisasters(Array.isArray(disasterData) ? disasterData : []);
      setCommitments(Array.isArray(commitmentData) ? commitmentData : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeDisasterCount = disasters.length;
  const committedCount = commitments.length;

  return (
    <DashboardLayout
      user={user}
      onLogout={onLogout}
      portalTitle="NGO Partner Portal"
      title="NGO Operations & Response"
      subtitle="View active emergencies declared by authorities, respond with field commitments, and track ongoing operations."
    >
      <div className="dashboard-card">
        {/* Navigation Tabs */}
        <div className="dashboard-tab-bar">
          <button
            onClick={() => setTab('disasters')}
            className={`dashboard-tab-item ${tab === 'disasters' ? 'active' : ''}`}
          >
            Active Emergencies
            <span className="dashboard-tab-count">{activeDisasterCount}</span>
          </button>
          <button
            onClick={() => setTab('commitments')}
            className={`dashboard-tab-item ${tab === 'commitments' ? 'active' : ''}`}
          >
            My Response Commitments
            <span className="dashboard-tab-count">{committedCount}</span>
          </button>
        </div>

        {error && <p className="feedback error">{error}</p>}
        {loading && <p className="feedback notice">Loading operational data…</p>}

        {/* ── Active Disasters Tab ── */}
        {tab === 'disasters' && !loading && (
          <div>
            {disasters.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 16px', color: '#64748b', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
                <p style={{ margin: 0, fontWeight: 500 }}>No active emergencies requiring response at this time.</p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {disasters.map((d) => (
                <div
                  key={d._id}
                  style={{
                    border: '1px solid #e2e8f0', borderRadius: 10, padding: 20,
                    background: '#ffffff', transition: 'box-shadow 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{d.title}</h3>
                        <Badge color={severityColors[d.severity]}>{d.severity}</Badge>
                      </div>
                      <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748b' }}>
                        Category: <strong style={{ color: '#334155' }}>{d.type}</strong>
                        {d.location?.city ? ` • Location: ${[d.location.city, d.location.district, d.location.province].filter(Boolean).join(', ')}` : ''}
                        {d.affectedPopulation ? ` • ${d.affectedPopulation.toLocaleString()} affected` : ''}
                        {d.startDate ? ` • Date: ${new Date(d.startDate).toLocaleDateString()}` : ''}
                      </p>
                    </div>

                    <div>
                      {d.myCommitmentStatus ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '6px 14px', borderRadius: 20, background: '#f0fdf4',
                          color: '#166534', fontSize: '12px', fontWeight: 700, border: '1px solid #bbf7d0'
                        }}>
                          ✓ Committed ({d.myCommitmentStatus})
                        </span>
                      ) : (
                        <button
                          className="primary-button"
                          style={{
                            margin: 0, width: 'auto', padding: '8px 20px', minHeight: 'auto',
                            background: '#16a34a', borderColor: '#16a34a', fontSize: '13px'
                          }}
                          onClick={() => setRespondingTo(respondingTo === d._id ? null : d._id)}
                        >
                          {respondingTo === d._id ? 'Cancel' : 'I Will Respond'}
                        </button>
                      )}
                    </div>
                  </div>

                  {d.description && (
                    <p style={{ margin: '12px 0 0', fontSize: '13px', color: '#334155', lineHeight: 1.6, background: '#f8fafc', padding: 12, borderRadius: 6 }}>
                      {d.description}
                    </p>
                  )}

                  {respondingTo === d._id && (
                    <RespondForm
                      disaster={d}
                      onDone={() => { setRespondingTo(null); load(); }}
                      onCancel={() => setRespondingTo(null)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── My Commitments Tab ── */}
        {tab === 'commitments' && !loading && (
          <div>
            {commitments.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 16px', color: '#64748b', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
                <p style={{ margin: 0, fontWeight: 500 }}>Your organization has not committed to any emergencies yet.</p>
                <p style={{ margin: '6px 0 0', fontSize: '12px' }}>Browse the "Active Emergencies" tab to respond to declared incidents.</p>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
              {commitments.map((c) => (
                <div
                  key={c._id}
                  style={{
                    border: '1px solid #e2e8f0', borderRadius: 10, padding: 18,
                    background: '#ffffff', display: 'flex', flexDirection: 'column', gap: 10
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                        {c.disasterId?.title || 'Emergency Incident'}
                      </h4>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                        Type: {c.disasterId?.type} • Committed {c.committedAt ? new Date(c.committedAt).toLocaleDateString() : ''}
                      </p>
                    </div>
                    {c.disasterId?.severity && (
                      <Badge color={severityColors[c.disasterId.severity]}>{c.disasterId.severity}</Badge>
                    )}
                  </div>

                  <div style={{ fontSize: '12px', background: '#f8fafc', padding: 12, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Work Areas: </span>
                      <span style={{ color: '#0f172a' }}>{(c.workAreas || []).join(', ') || '—'}</span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Planned Activities: </span>
                      <span style={{ color: '#0f172a' }}>{(c.plannedActivities || []).join(', ') || '—'}</span>
                    </div>
                    {c.resourcesOffered && c.resourcesOffered.length > 0 && (
                      <div>
                        <span style={{ color: '#64748b', fontWeight: 600 }}>Resources Pledged: </span>
                        <span style={{ color: '#0f172a' }}>
                          {c.resourcesOffered.map((r) => `${r.type} (${r.quantity})`).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 6 }}>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      Status: <strong style={{ color: '#166534', textTransform: 'capitalize' }}>{c.status || 'Committed'}</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
