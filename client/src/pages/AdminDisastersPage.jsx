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
const statusColors = { active: '#16a34a', underControl: '#d97706', closed: '#64748b' };

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

/* ───── Create Disaster Form ─────────────────────────────────────────────── */
function CreateDisasterForm({ onCreated, onCancel }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    try {
      const body = {
        title: fd.get('title'),
        type: fd.get('type'),
        description: fd.get('description'),
        severity: fd.get('severity'),
        affectedPopulation: Number(fd.get('affectedPopulation')) || 0,
        startDate: fd.get('startDate') || undefined,
        location: {
          city: fd.get('city'),
          district: fd.get('district'),
          province: fd.get('province'),
        },
      };
      await apiFetch('/admin/disasters', { method: 'POST', body: JSON.stringify(body) });
      e.currentTarget.reset();
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{
      marginBottom: 28, padding: 24, background: '#f8fafc',
      borderRadius: 10, border: '1px solid #e2e8f0'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Declare New Disaster / Emergency</h3>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
            Registered NGOs will be notified and will be able to review and respond with commitments.
          </p>
        </div>
        <button type="button" onClick={onCancel} className="dashboard-filter-btn">
          Cancel
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
            Incident Title *
          </label>
          <input name="title" type="text" placeholder="e.g. Flash Floods - Khyber District" required style={formInputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
            Disaster Category
          </label>
          <select name="type" style={formInputStyle}>
            <option value="flood">Flood</option>
            <option value="earthquake">Earthquake</option>
            <option value="cyclone">Cyclone</option>
            <option value="drought">Drought</option>
            <option value="wildfire">Wildfire</option>
            <option value="displacement">Internal Displacement</option>
            <option value="other">Other Incident</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
            Severity Level
          </label>
          <select name="severity" defaultValue="high" style={formInputStyle}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical / Level 3</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
            Estimated Affected Population
          </label>
          <input name="affectedPopulation" type="number" min="0" placeholder="e.g. 50000" style={formInputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
            City / Tehsil
          </label>
          <input name="city" type="text" placeholder="e.g. Nowshera" style={formInputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
            District
          </label>
          <input name="district" type="text" placeholder="e.g. Nowshera District" style={formInputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
            Province / State
          </label>
          <input name="province" type="text" placeholder="e.g. KP" style={formInputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
            Incident Date
          </label>
          <input name="startDate" type="date" defaultValue={new Date().toISOString().split('T')[0]} style={formInputStyle} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
            Situation Overview & Priority Needs
          </label>
          <textarea
            name="description"
            rows="3"
            placeholder="Details about displacement, damaged infrastructure, water and shelter needs..."
            style={{ ...formInputStyle, resize: 'vertical' }}
          />
        </div>
      </div>

      {error && <p className="feedback error">{error}</p>}
      <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
        <button
          className="primary-button"
          type="submit"
          disabled={busy}
          style={{ width: 'auto', margin: 0, padding: '10px 24px', minHeight: 'auto' }}
        >
          {busy ? 'Publishing…' : 'Publish Disaster Incident'}
        </button>
        <button type="button" onClick={onCancel} className="dashboard-signout-btn">
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ───── Main Admin Disasters Page ────────────────────────────────────────── */
export default function AdminDisastersPage() {
  const [disasters, setDisasters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [commitments, setCommitments] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : '';
      const data = await apiFetch(`/admin/disasters${qs}`);
      setDisasters(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function toggleExpand(id) {
    if (expandedId === id) { setExpandedId(null); return; }
    try {
      const data = await apiFetch(`/admin/disasters/${id}`);
      setCommitments(data.commitments || []);
      setExpandedId(id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function changeStatus(id, status) {
    try {
      await apiFetch(`/admin/disasters/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      {/* Top action row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div className="dashboard-filter-group" style={{ margin: 0 }}>
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, marginRight: 4 }}>Filter:</span>
          {[
            { key: '', label: 'All Incidents' },
            { key: 'active', label: 'Active' },
            { key: 'underControl', label: 'Under Control' },
            { key: 'closed', label: 'Closed' },
          ].map((s) => (
            <button
              key={s.key || 'all'}
              className={`dashboard-filter-btn ${statusFilter === s.key ? 'active' : ''}`}
              onClick={() => setStatusFilter(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <button
          className="primary-button"
          style={{ width: 'auto', margin: 0, padding: '8px 20px', minHeight: 'auto', fontSize: '13px' }}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Close Form' : '+ Declare New Disaster'}
        </button>
      </div>

      {showForm && (
        <CreateDisasterForm
          onCreated={() => { setShowForm(false); load(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {error && <p className="feedback error">{error}</p>}
      {loading && <p className="feedback notice">Loading disaster records…</p>}

      {!loading && disasters.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: '#64748b', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
          <p style={{ margin: 0, fontWeight: 500 }}>No disaster incidents found{statusFilter ? ` with status "${statusFilter}"` : ''}.</p>
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
                  <Badge color={statusColors[d.status]}>{d.status}</Badge>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748b' }}>
                  Category: <strong style={{ color: '#334155' }}>{d.type}</strong>
                  {d.location?.city ? ` • Location: ${[d.location.city, d.location.district, d.location.province].filter(Boolean).join(', ')}` : ''}
                  {d.affectedPopulation ? ` • Population: ${d.affectedPopulation.toLocaleString()} affected` : ''}
                  {d.startDate ? ` • Date: ${new Date(d.startDate).toLocaleDateString()}` : ''}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="dashboard-signout-btn"
                  onClick={() => toggleExpand(d._id)}
                >
                  {expandedId === d._id ? '▲ Hide Responses' : '▼ View NGO Commitments'}
                </button>
                {d.status === 'active' && (
                  <button
                    type="button"
                    className="dashboard-signout-btn"
                    style={{ borderColor: '#f59e0b', color: '#b45309' }}
                    onClick={() => changeStatus(d._id, 'underControl')}
                  >
                    Mark Under Control
                  </button>
                )}
                {d.status !== 'closed' && (
                  <button
                    type="button"
                    className="dashboard-signout-btn"
                    style={{ borderColor: '#ef4444', color: '#dc2626' }}
                    onClick={() => changeStatus(d._id, 'closed')}
                  >
                    Close Incident
                  </button>
                )}
              </div>
            </div>

            {d.description && (
              <p style={{ margin: '14px 0 0', fontSize: '13px', color: '#334155', lineHeight: 1.6, background: '#f8fafc', padding: 12, borderRadius: 6 }}>
                {d.description}
              </p>
            )}

            {/* Commitments collapsible panel */}
            {expandedId === d._id && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                    Committed NGOs ({commitments.length})
                  </h4>
                </div>

                {commitments.length === 0 && (
                  <p style={{ color: '#64748b', fontSize: '13px', margin: 0, fontStyle: 'italic' }}>
                    No NGO has committed to this disaster yet.
                  </p>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
                  {commitments.map((c) => (
                    <div
                      key={c._id}
                      style={{
                        padding: 14, background: '#f8fafc', borderRadius: 8,
                        border: '1px solid #e2e8f0'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                            {c.ngoId?.organizationName || 'NGO Partner'}
                          </strong>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {c.ngoId?.userId?.fullName} ({c.ngoId?.userId?.email})
                          </div>
                        </div>
                        <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {c.committedAt ? new Date(c.committedAt).toLocaleDateString() : ''}
                        </span>
                      </div>

                      <div style={{ fontSize: '12px', marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div>
                          <span style={{ color: '#64748b', fontWeight: 600 }}>Work Areas: </span>
                          <span style={{ color: '#0f172a' }}>{(c.workAreas || []).join(', ') || '—'}</span>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', fontWeight: 600 }}>Activities: </span>
                          <span style={{ color: '#0f172a' }}>{(c.plannedActivities || []).join(', ') || '—'}</span>
                        </div>
                        {c.resourcesOffered && c.resourcesOffered.length > 0 && (
                          <div>
                            <span style={{ color: '#64748b', fontWeight: 600 }}>Resources: </span>
                            <span style={{ color: '#0f172a' }}>
                              {c.resourcesOffered.map((r) => `${r.type} (${r.quantity})`).join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
