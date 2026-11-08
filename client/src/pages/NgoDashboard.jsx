import React, { useState, useEffect, useCallback } from 'react';

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
      display: 'inline-block', padding: '2px 10px', borderRadius: 999,
      fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.05em', background: color, color: '#fff',
    }}>
      {children}
    </span>
  );
}

const inputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box',
};

/* ───── Response form ────────────────────────────────────────────────────── */
function RespondForm({ disasterId, onDone, onCancel }) {
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

      await apiFetch(`/ngo/disasters/${disasterId}/respond`, {
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
    <form onSubmit={handleSubmit} style={{ marginTop: 12, padding: 16, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
      <h4 style={{ margin: '0 0 12px', fontSize: '1rem', color: '#166534' }}>Submit Your Response</h4>

      <div style={{ marginBottom: 12 }}>
        <label htmlFor={`wa-${disasterId}`} style={{ fontWeight: 600, fontSize: '0.85rem' }}>
          Work Areas <span style={{ fontWeight: 400, color: '#6b7280' }}>(comma-separated)</span>
        </label>
        <input id={`wa-${disasterId}`} name="workAreas" type="text"
          placeholder="e.g. Shelter Management, Water Distribution, Medical Aid"
          required style={inputStyle} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label htmlFor={`act-${disasterId}`} style={{ fontWeight: 600, fontSize: '0.85rem' }}>
          Planned Activities <span style={{ fontWeight: 400, color: '#6b7280' }}>(comma-separated)</span>
        </label>
        <input id={`act-${disasterId}`} name="plannedActivities" type="text"
          placeholder="e.g. Distribute relief kits, Set up medical camps, Provide clean water"
          required style={inputStyle} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: 6 }}>
          Resources Offered <span style={{ fontWeight: 400, color: '#6b7280' }}>(optional)</span>
        </label>
        {resources.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
            <input type="text" placeholder="Resource type (e.g. Tents)"
              value={r.type} onChange={(e) => updateResource(i, 'type', e.target.value)}
              style={{ ...inputStyle, flex: 2 }} />
            <input type="number" placeholder="Qty" min="0"
              value={r.quantity} onChange={(e) => updateResource(i, 'quantity', e.target.value)}
              style={{ ...inputStyle, flex: 1 }} />
            {resources.length > 1 && (
              <button type="button" onClick={() => removeResource(i)}
                style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '1.1rem', padding: '4px' }}>
                ✕
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={addResource} className="text-button"
          style={{ fontSize: '0.8rem', marginTop: 2 }}>
          + Add resource
        </button>
      </div>

      {error && <p style={{ color: '#dc2626', margin: '8px 0', fontSize: '0.85rem' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="primary-button" type="submit" disabled={busy}
          style={{ padding: '8px 20px', background: '#16a34a' }}>
          {busy ? 'Submitting…' : 'Submit Response'}
        </button>
        <button type="button" className="text-button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

/* ───── Main NGO Dashboard ───────────────────────────────────────────────── */
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

  return (
    <main className="shell">
      <section className="auth-card" style={{ maxWidth: 900, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <a className="brand" href="/" aria-label="CCCM Manager home">
              <span className="brand-mark" aria-hidden="true">C</span>
              <span>CCCM <strong>MANAGER</strong></span>
            </a>
            <p className="eyebrow" style={{ marginTop: 8 }}>NGO PORTAL</p>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Welcome, {user.fullName}</h1>
          </div>
          <button className="text-button" onClick={onLogout}>Sign out</button>
        </div>
        <p style={{ color: '#6b7280', marginBottom: 16 }}>{user.email}</p>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e5e7eb', marginBottom: 20 }}>
          {[{ key: 'disasters', label: 'Active Disasters' }, { key: 'commitments', label: 'My Commitments' }].map((t) => (
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

        {error && <p className="feedback error">{error}</p>}
        {loading && <p className="feedback notice">Loading…</p>}

        {/* ── Active Disasters Tab ──────────────────────────────────────── */}
        {tab === 'disasters' && !loading && (
          <>
            {disasters.length === 0 && (
              <p style={{ color: '#6b7280', textAlign: 'center', padding: '32px 0' }}>
                No active disasters at this time.
              </p>
            )}
            {disasters.map((d) => (
              <div key={d._id} style={{
                border: '1px solid #e5e7eb', borderRadius: 8, padding: 16,
                marginBottom: 12, background: '#fff',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>{d.title}</h3>
                    <p style={{ margin: '4px 0', fontSize: '0.85rem', color: '#6b7280' }}>
                      {d.type} • {d.location?.city}{d.location?.district ? `, ${d.location.district}` : ''}{d.location?.province ? `, ${d.location.province}` : ''}
                      {d.affectedPopulation ? ` • ${d.affectedPopulation.toLocaleString()} affected` : ''}
                      {d.startDate ? ` • Started ${new Date(d.startDate).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <Badge color={severityColors[d.severity]}>{d.severity}</Badge>
                </div>
                {d.description && <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: '#374151' }}>{d.description}</p>}

                {d.myCommitmentStatus ? (
                  <p style={{
                    marginTop: 10, padding: '6px 14px', borderRadius: 6,
                    background: '#f0fdf4', color: '#166534', fontSize: '0.85rem', fontWeight: 600,
                  }}>
                    ✓ You have responded — status: {d.myCommitmentStatus}
                  </p>
                ) : respondingTo === d._id ? (
                  <RespondForm disasterId={d._id}
                    onDone={() => { setRespondingTo(null); load(); }}
                    onCancel={() => setRespondingTo(null)} />
                ) : (
                  <button className="primary-button"
                    style={{ marginTop: 10, padding: '8px 20px', background: '#16a34a' }}
                    onClick={() => setRespondingTo(d._id)}>
                    I Will Respond
                  </button>
                )}
              </div>
            ))}
          </>
        )}

        {/* ── My Commitments Tab ────────────────────────────────────────── */}
        {tab === 'commitments' && !loading && (
          <>
            {commitments.length === 0 && (
              <p style={{ color: '#6b7280', textAlign: 'center', padding: '32px 0' }}>
                You haven't responded to any disasters yet.
              </p>
            )}
            {commitments.map((c) => (
              <div key={c._id} style={{
                border: '1px solid #e5e7eb', borderRadius: 8, padding: 16,
                marginBottom: 12, background: '#fff',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>{c.disasterId?.title || 'Unknown Disaster'}</h3>
                  <Badge color={severityColors[c.disasterId?.severity]}>{c.disasterId?.severity}</Badge>
                </div>
                <p style={{ margin: '4px 0', fontSize: '0.85rem', color: '#6b7280' }}>
                  {c.disasterId?.type} • Status: {c.disasterId?.status}
                  {c.committedAt ? ` • Committed ${new Date(c.committedAt).toLocaleDateString()}` : ''}
                </p>
                <div style={{ marginTop: 8, fontSize: '0.85rem' }}>
                  <div><strong>Work Areas:</strong> {(c.workAreas || []).join(', ')}</div>
                  <div><strong>Activities:</strong> {(c.plannedActivities || []).join(', ')}</div>
                  {c.resourcesOffered?.length > 0 && (
                    <div><strong>Resources:</strong> {c.resourcesOffered.map((r) => `${r.type} (${r.quantity})`).join(', ')}</div>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </section>
    </main>
  );
}
