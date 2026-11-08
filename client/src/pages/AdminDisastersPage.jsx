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
const statusColors = { active: '#16a34a', underControl: '#d97706', closed: '#6b7280' };

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

/* ───── Create disaster form ─────────────────────────────────────────────── */
function CreateDisasterForm({ onCreated }) {
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
    <form onSubmit={handleSubmit} style={{ marginBottom: 24, padding: 16, background: '#f9fafb', borderRadius: 8 }}>
      <h2 style={{ margin: '0 0 12px', fontSize: '1.1rem' }}>Create New Disaster</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label htmlFor="d-title">Title *</label>
          <input id="d-title" name="title" type="text" required style={inputStyle} />
        </div>
        <div>
          <label htmlFor="d-type">Type</label>
          <select id="d-type" name="type" style={inputStyle}>
            <option value="flood">Flood</option>
            <option value="earthquake">Earthquake</option>
            <option value="cyclone">Cyclone</option>
            <option value="drought">Drought</option>
            <option value="wildfire">Wildfire</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="d-desc">Description</label>
          <textarea id="d-desc" name="description" rows="2" style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
        <div>
          <label htmlFor="d-severity">Severity</label>
          <select id="d-severity" name="severity" style={inputStyle}>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <div>
          <label htmlFor="d-pop">Affected Population</label>
          <input id="d-pop" name="affectedPopulation" type="number" min="0" style={inputStyle} />
        </div>
        <div>
          <label htmlFor="d-city">City</label>
          <input id="d-city" name="city" type="text" style={inputStyle} />
        </div>
        <div>
          <label htmlFor="d-district">District</label>
          <input id="d-district" name="district" type="text" style={inputStyle} />
        </div>
        <div>
          <label htmlFor="d-province">Province</label>
          <input id="d-province" name="province" type="text" style={inputStyle} />
        </div>
        <div>
          <label htmlFor="d-date">Start Date</label>
          <input id="d-date" name="startDate" type="date" style={inputStyle} />
        </div>
      </div>
      {error && <p style={{ color: '#dc2626', margin: '8px 0 0' }}>{error}</p>}
      <button className="primary-button" type="submit" disabled={busy} style={{ marginTop: 12 }}>
        {busy ? 'Creating…' : 'Create Disaster'}
      </button>
    </form>
  );
}

const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' };

/* ───── Main page ────────────────────────────────────────────────────────── */
export default function AdminDisastersPage() {
  const [disasters, setDisasters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [commitments, setCommitments] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/admin/disasters');
      setDisasters(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Disasters</h2>
        <button className="primary-button" style={{ padding: '6px 16px', fontSize: '0.85rem' }}
          onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New Disaster'}
        </button>
      </div>

      {showForm && <CreateDisasterForm onCreated={() => { setShowForm(false); load(); }} />}

      {error && <p className="feedback error">{error}</p>}
      {loading && <p className="feedback notice">Loading…</p>}

      {!loading && disasters.length === 0 && (
        <p style={{ color: '#6b7280', textAlign: 'center', padding: '24px 0' }}>No disasters yet. Create one above.</p>
      )}

      {disasters.map((d) => (
        <div key={d._id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 12, background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>{d.title}</h3>
              <p style={{ margin: '4px 0', fontSize: '0.85rem', color: '#6b7280' }}>
                {d.type} • {d.location?.city}{d.location?.district ? `, ${d.location.district}` : ''}{d.location?.province ? `, ${d.location.province}` : ''}
                {d.affectedPopulation ? ` • ${d.affectedPopulation.toLocaleString()} affected` : ''}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Badge color={severityColors[d.severity]}>{d.severity}</Badge>
              <Badge color={statusColors[d.status]}>{d.status}</Badge>
            </div>
          </div>
          {d.description && <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: '#374151' }}>{d.description}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button className="text-button" style={{ fontSize: '0.8rem' }} onClick={() => toggleExpand(d._id)}>
              {expandedId === d._id ? 'Hide Responses' : 'View Responses'}
            </button>
            {d.status === 'active' && (
              <button className="text-button" style={{ fontSize: '0.8rem', color: '#d97706' }}
                onClick={() => changeStatus(d._id, 'underControl')}>Mark Under Control</button>
            )}
            {d.status !== 'closed' && (
              <button className="text-button" style={{ fontSize: '0.8rem', color: '#dc2626' }}
                onClick={() => changeStatus(d._id, 'closed')}>Close</button>
            )}
          </div>

          {expandedId === d._id && (
            <div style={{ marginTop: 12, padding: 12, background: '#f9fafb', borderRadius: 6 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem' }}>NGO Responses ({commitments.length})</h4>
              {commitments.length === 0 && <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>No NGOs have responded yet.</p>}
              {commitments.map((c) => (
                <div key={c._id} style={{ padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                  <strong>{c.ngoId?.organizationName || 'Unknown NGO'}</strong>
                  <span style={{ fontSize: '0.8rem', color: '#6b7280', marginLeft: 8 }}>
                    ({c.ngoId?.userId?.fullName} — {c.ngoId?.userId?.email})
                  </span>
                  <div style={{ fontSize: '0.85rem', marginTop: 4 }}>
                    <div><strong>Work Areas:</strong> {(c.workAreas || []).join(', ')}</div>
                    <div><strong>Activities:</strong> {(c.plannedActivities || []).join(', ')}</div>
                    {c.resourcesOffered?.length > 0 && (
                      <div><strong>Resources:</strong> {c.resourcesOffered.map((r) => `${r.type} (${r.quantity})`).join(', ')}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

