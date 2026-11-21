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

const statusColors = {
  active: '#16a34a',
  closureDue: '#d97706',
  extended: '#2563eb',
  closed: '#64748b',
};

const resourceLevelColors = {
  sufficient: { bg: '#dcfce7', text: '#15803d' },
  low: { bg: '#fef3c7', text: '#b45309' },
  critical: { bg: '#fee2e2', text: '#b91c1c' },
};

function Badge({ color, children }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: '0.72rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        background: color,
        color: '#fff',
      }}
    >
      {children}
    </span>
  );
}

const formInputStyle = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  fontSize: '13px',
  boxSizing: 'border-box',
  background: '#ffffff',
  color: '#0f172a',
};

export default function ManagerDashboard({ user, onLogout }) {
  const [camps, setCamps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Modals
  const [extendingCamp, setExtendingCamp] = useState(null);
  const [extensionDays, setExtensionDays] = useState(30);
  const [customExtDate, setCustomExtDate] = useState('');
  const [extensionBusy, setExtensionBusy] = useState(false);

  const [editingCamp, setEditingCamp] = useState(null);
  const [editPopulation, setEditPopulation] = useState(0);
  const [editResources, setEditResources] = useState({});
  const [editBusy, setEditBusy] = useState(false);

  const loadMyCamps = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/camps/my');
      setCamps(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMyCamps();
  }, [loadMyCamps]);

  function openExtendModal(camp) {
    setExtendingCamp(camp);
    setExtensionDays(30);
    const base =
      camp.plannedClosureDate && new Date(camp.plannedClosureDate) > new Date()
        ? new Date(camp.plannedClosureDate)
        : new Date();
    const future = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
    setCustomExtDate(future.toISOString().split('T')[0]);
  }

  async function handleSaveExtension(e) {
    e.preventDefault();
    if (!extendingCamp) return;
    setExtensionBusy(true);
    try {
      await apiFetch(`/camps/${extendingCamp._id}/extend`, {
        method: 'POST',
        body: JSON.stringify({
          newClosureDate: customExtDate || undefined,
          daysToAdd: customExtDate ? undefined : extensionDays,
        }),
      });
      setExtendingCamp(null);
      loadMyCamps();
    } catch (err) {
      setError(err.message);
    } finally {
      setExtensionBusy(false);
    }
  }

  async function handleConfirmClosure(camp) {
    if (
      !window.confirm(
        `Confirm decommissioning of camp "${camp.name}"?\nThis officially marks the site as closed.`
      )
    ) {
      return;
    }
    try {
      await apiFetch(`/camps/${camp._id}/close`, { method: 'POST' });
      loadMyCamps();
    } catch (err) {
      setError(err.message);
    }
  }

  function openEditModal(camp) {
    setEditingCamp(camp);
    setEditPopulation(camp.population || 0);
    const resMap = {};
    (camp.resources || []).forEach((r) => {
      resMap[r.name] = r.level;
    });
    setEditResources(resMap);
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editingCamp) return;
    setEditBusy(true);
    try {
      const updatedResources = ['water', 'food', 'medicine', 'shelter'].map((name) => ({
        name,
        level: editResources[name] || 'sufficient',
        updatedAt: new Date(),
      }));

      await apiFetch(`/camps/${editingCamp._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          population: Number(editPopulation),
          resources: updatedResources,
        }),
      });
      setEditingCamp(null);
      loadMyCamps();
    } catch (err) {
      setError(err.message);
    } finally {
      setEditBusy(false);
    }
  }

  const closureDueCount = camps.filter((c) => c.status === 'closureDue').length;
  const activeCount = camps.filter((c) => c.status === 'active' || c.status === 'extended').length;

  return (
    <DashboardLayout
      user={user}
      onLogout={onLogout}
      portalTitle="Camp Manager Portal"
      title={`Welcome back, ${user.fullName}`}
      subtitle="Camp coordination, population management, essential supplies tracking, and decommissioning protocol."
    >
      <div className="dashboard-card">
        {/* Policy Alert Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 18px',
            background: '#eff6ff',
            borderRadius: 8,
            border: '1px solid #bfdbfe',
            marginBottom: 20,
            color: '#1e40af',
            fontSize: '13px',
          }}
        >
          <span style={{ fontSize: '20px' }}>ℹ️</span>
          <div>
            <strong>Camp Lifecycle Rule: </strong>
            <span>
              Camps <strong>never close automatically</strong>. As manager, you must formally{' '}
              <strong>confirm closure</strong> or <strong>grant an extension</strong> when the planned
              date is reached.
            </span>
          </div>
        </div>

        {/* Manager Workspace KPI overview */}
        <div
          style={{
            padding: 20,
            background: '#f8fafc',
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div style={{ padding: 16, background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              My Assigned Camps
            </span>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
              {camps.length} Sites
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>
              {activeCount} active operational sites
            </p>
          </div>

          <div
            style={{
              padding: 16,
              background: closureDueCount > 0 ? '#fffbeb' : '#ffffff',
              borderRadius: 8,
              border: closureDueCount > 0 ? '1px solid #f59e0b' : '1px solid #e2e8f0',
            }}
          >
            <span style={{ fontSize: '11px', color: '#b45309', fontWeight: 700, textTransform: 'uppercase' }}>
              Closure Reviews Due
            </span>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#d97706', marginTop: 4 }}>
              {closureDueCount} Action Needed
            </div>
            <p style={{ fontSize: '12px', color: '#b45309', margin: '4px 0 0' }}>
              Confirm decommissioning or extend date
            </p>
          </div>

          <div style={{ padding: 16, background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase' }}>
              Manager Permissions
            </span>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#16a34a', marginTop: 4 }}>
              Active
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>
              Authorized for field management
            </p>
          </div>
        </div>

        {error && <p className="feedback error">{error}</p>}
        {loading && <p className="feedback notice">Loading assigned camps…</p>}

        {!loading && camps.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 16px',
              color: '#64748b',
              background: '#f8fafc',
              borderRadius: 8,
              border: '1px dashed #cbd5e1',
            }}
          >
            <p style={{ margin: 0, fontWeight: 500 }}>No camps currently assigned to your account.</p>
            <p style={{ margin: '6px 0 0', fontSize: '12px' }}>
              Camp assignments are coordinated by system administrators.
            </p>
          </div>
        )}

        {/* ── Camps Cards ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {camps.map((camp) => {
            const occPercent =
              camp.capacity > 0
                ? Math.min(100, Math.round(((camp.population || 0) / camp.capacity) * 100))
                : 0;
            const isClosureDue = camp.status === 'closureDue';
            const isClosed = camp.status === 'closed';

            return (
              <div
                key={camp._id}
                style={{
                  border: isClosureDue ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: 20,
                  background: '#ffffff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
                        ⛺ {camp.name}
                      </h3>
                      <Badge color={statusColors[camp.status] || '#64748b'}>
                        {isClosureDue ? '⚠️ Closure Due' : camp.status}
                      </Badge>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                      Location: <strong>{camp.location?.name || 'General Field'}</strong>
                      {camp.plannedClosureDate && (
                        <span>
                          {' • '}
                          Planned Closure: <strong>{new Date(camp.plannedClosureDate).toLocaleDateString()}</strong>
                        </span>
                      )}
                    </p>
                  </div>

                  {!isClosed && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="dashboard-signout-btn"
                        style={{ background: '#2563eb', color: '#ffffff', borderColor: '#2563eb', fontWeight: 700 }}
                        onClick={() => openExtendModal(camp)}
                      >
                        ⏱️ Extend Duration
                      </button>
                      <button
                        type="button"
                        className="dashboard-signout-btn"
                        style={{ borderColor: isClosureDue ? '#f59e0b' : '#ef4444', color: isClosureDue ? '#b45309' : '#dc2626' }}
                        onClick={() => handleConfirmClosure(camp)}
                      >
                        Confirm Closure
                      </button>
                      <button
                        type="button"
                        className="dashboard-signout-btn"
                        onClick={() => openEditModal(camp)}
                      >
                        Update Supplies
                      </button>
                    </div>
                  )}
                </div>

                {isClosureDue && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 10,
                      background: '#fffbeb',
                      borderRadius: 6,
                      border: '1px solid #fde68a',
                      fontSize: '12px',
                      color: '#92400e',
                    }}
                  >
                    ⚠️ <strong>Closure Action Due: </strong> Camps never close automatically.
                    Confirm decommissioning or grant an extension above.
                  </div>
                )}

                {/* Occupancy */}
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: 4 }}>
                    <span>
                      Occupancy: {(camp.population || 0).toLocaleString()} / {(camp.capacity || 0).toLocaleString()} persons
                    </span>
                    <span style={{ fontWeight: 700, color: occPercent >= 90 ? '#dc2626' : '#16a34a' }}>
                      {occPercent}%
                    </span>
                  </div>
                  <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 999 }}>
                    <div
                      style={{
                        width: `${occPercent}%`,
                        height: '100%',
                        background: occPercent >= 90 ? '#dc2626' : '#16a34a',
                        borderRadius: 999,
                      }}
                    />
                  </div>
                </div>

                {/* Resources */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Supplies:</span>
                  {(camp.resources || []).map((r) => {
                    const styling = resourceLevelColors[r.level] || resourceLevelColors.sufficient;
                    return (
                      <span
                        key={r.name}
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: styling.bg,
                          color: styling.text,
                          textTransform: 'capitalize',
                        }}
                      >
                        {r.name}: {r.level}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Extend Modal ── */}
      {extendingCamp && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 100,
            padding: 16,
          }}
        >
          <div style={{ background: '#ffffff', borderRadius: 12, width: '100%', maxWidth: 480, padding: 24 }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
              Extend Camp: {extendingCamp.name}
            </h3>
            <p style={{ margin: '4px 0 16px', fontSize: '13px', color: '#64748b' }}>
              Select an extension duration. Camps never close automatically.
            </p>
            <form onSubmit={handleSaveExtension}>
              <div style={{ marginBottom: 16 }}>
                <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                  Extension Quick Options
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[30, 60, 90].map((days) => (
                    <button
                      key={days}
                      type="button"
                      className={`dashboard-filter-btn ${extensionDays === days ? 'active' : ''}`}
                      onClick={() => {
                        setExtensionDays(days);
                        const base =
                          extendingCamp.plannedClosureDate &&
                          new Date(extendingCamp.plannedClosureDate) > new Date()
                            ? new Date(extendingCamp.plannedClosureDate)
                            : new Date();
                        const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
                        setCustomExtDate(next.toISOString().split('T')[0]);
                      }}
                    >
                      +{days} Days
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 6 }}>
                  New Planned Closure Date
                </label>
                <input
                  type="date"
                  value={customExtDate}
                  onChange={(e) => setCustomExtDate(e.target.value)}
                  required
                  style={formInputStyle}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button type="button" onClick={() => setExtendingCamp(null)} className="dashboard-signout-btn">
                  Cancel
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={extensionBusy}
                  style={{ width: 'auto', margin: 0, padding: '8px 20px', minHeight: 'auto', background: '#2563eb' }}
                >
                  {extensionBusy ? 'Extending…' : 'Confirm Extension'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Supplies Modal ── */}
      {editingCamp && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 100,
            padding: 16,
          }}
        >
          <div style={{ background: '#ffffff', borderRadius: 12, width: '100%', maxWidth: 480, padding: 24 }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
              Update Supplies: {editingCamp.name}
            </h3>
            <form onSubmit={handleSaveEdit}>
              <div style={{ margin: '14px 0' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 6 }}>
                  Current Population
                </label>
                <input
                  type="number"
                  min="0"
                  value={editPopulation}
                  onChange={(e) => setEditPopulation(e.target.value)}
                  style={formInputStyle}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: 8 }}>
                  Resource Levels
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {['water', 'food', 'medicine', 'shelter'].map((rName) => (
                    <div key={rName}>
                      <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'capitalize' }}>
                        {rName}
                      </span>
                      <select
                        value={editResources[rName] || 'sufficient'}
                        onChange={(e) =>
                          setEditResources({ ...editResources, [rName]: e.target.value })
                        }
                        style={formInputStyle}
                      >
                        <option value="sufficient">Sufficient</option>
                        <option value="low">Low Warning</option>
                        <option value="critical">Critical Shortage</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button type="button" onClick={() => setEditingCamp(null)} className="dashboard-signout-btn">
                  Cancel
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={editBusy}
                  style={{ width: 'auto', margin: 0, padding: '8px 20px', minHeight: 'auto' }}
                >
                  {editBusy ? 'Saving…' : 'Save Supplies'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
