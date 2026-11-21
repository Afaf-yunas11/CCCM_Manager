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

export default function AdminCampsPage() {
  const [camps, setCamps] = useState([]);
  const [summary, setSummary] = useState(null);
  const [managers, setManagers] = useState([]);
  const [disasters, setDisasters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [extendingCamp, setExtendingCamp] = useState(null);
  const [extensionDays, setExtensionDays] = useState(30);
  const [customExtDate, setCustomExtDate] = useState('');
  const [extensionBusy, setExtensionBusy] = useState(false);

  const [editingCamp, setEditingCamp] = useState(null);
  const [editPopulation, setEditPopulation] = useState(0);
  const [editCapacity, setEditCapacity] = useState(0);
  const [editResources, setEditResources] = useState({});
  const [editBusy, setEditBusy] = useState(false);

  const loadCamps = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());

      const qs = params.toString() ? `?${params.toString()}` : '';
      const data = await apiFetch(`/admin/camps${qs}`);
      setCamps(data.camps || []);
      setSummary(data.summary || null);
      if (data.availableManagers) setManagers(data.availableManagers);
      if (data.activeDisasters) setDisasters(data.activeDisasters);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm]);

  useEffect(() => {
    loadCamps();
  }, [loadCamps]);

  // Handle Camp Creation
  async function handleCreateCamp(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    const facilities = [];
    ['water', 'health', 'latrines', 'security', 'solar', 'childcare', 'waste'].forEach((key) => {
      const val = fd.get(`fac_${key}`);
      if (val) facilities.push(val);
    });

    const resources = [
      { name: 'water', level: fd.get('res_water') || 'sufficient' },
      { name: 'food', level: fd.get('res_food') || 'sufficient' },
      { name: 'medicine', level: fd.get('res_medicine') || 'sufficient' },
      { name: 'shelter', level: fd.get('res_shelter') || 'sufficient' },
    ];

    try {
      await apiFetch('/admin/camps', {
        method: 'POST',
        body: JSON.stringify({
          name: fd.get('name'),
          capacity: Number(fd.get('capacity')),
          population: Number(fd.get('population')) || 0,
          managerId: fd.get('managerId') || undefined,
          disasterId: fd.get('disasterId') || undefined,
          location: { name: fd.get('locationName') || '' },
          plannedClosureDate: fd.get('plannedClosureDate') || undefined,
          facilities,
          resources,
        }),
      });
      setShowCreateForm(false);
      loadCamps();
    } catch (err) {
      setError(err.message);
    }
  }

  // Open Extension Modal
  function openExtendModal(camp) {
    setExtendingCamp(camp);
    setExtensionDays(30);
    // calculate default 30 days from now or current closure date
    const base = camp.plannedClosureDate && new Date(camp.plannedClosureDate) > new Date()
      ? new Date(camp.plannedClosureDate)
      : new Date();
    const future = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
    setCustomExtDate(future.toISOString().split('T')[0]);
  }

  // Save Extension
  async function handleSaveExtension(e) {
    e.preventDefault();
    if (!extendingCamp) return;
    setExtensionBusy(true);
    try {
      await apiFetch(`/admin/camps/${extendingCamp._id}/extend`, {
        method: 'POST',
        body: JSON.stringify({
          newClosureDate: customExtDate || undefined,
          daysToAdd: customExtDate ? undefined : extensionDays,
        }),
      });
      setExtendingCamp(null);
      loadCamps();
    } catch (err) {
      setError(err.message);
    } finally {
      setExtensionBusy(false);
    }
  }

  // Confirm Closure
  async function handleConfirmClosure(camp) {
    if (
      !window.confirm(
        `Are you sure you want to confirm closure for "${camp.name}"?\nThis marks the camp as officially decommissioned.`
      )
    ) {
      return;
    }
    try {
      await apiFetch(`/admin/camps/${camp._id}/close`, { method: 'POST' });
      loadCamps();
    } catch (err) {
      setError(err.message);
    }
  }

  // Reopen Camp
  async function handleReopenCamp(camp) {
    const datePrompt = window.prompt(
      `Reopen camp "${camp.name}". Enter new planned closure date (YYYY-MM-DD):`,
      new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    );
    if (!datePrompt) return;
    try {
      await apiFetch(`/admin/camps/${camp._id}/reopen`, {
        method: 'POST',
        body: JSON.stringify({ plannedClosureDate: datePrompt }),
      });
      loadCamps();
    } catch (err) {
      setError(err.message);
    }
  }

  // Open Edit Modal
  function openEditModal(camp) {
    setEditingCamp(camp);
    setEditPopulation(camp.population || 0);
    setEditCapacity(camp.capacity || 0);
    const resMap = {};
    (camp.resources || []).forEach((r) => {
      resMap[r.name] = r.level;
    });
    setEditResources(resMap);
  }

  // Save Edit
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

      await apiFetch(`/admin/camps/${editingCamp._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          population: Number(editPopulation),
          capacity: Number(editCapacity),
          resources: updatedResources,
        }),
      });
      setEditingCamp(null);
      loadCamps();
    } catch (err) {
      setError(err.message);
    } finally {
      setEditBusy(false);
    }
  }

  // Delete Camp
  async function handleDeleteCamp(camp) {
    if (!window.confirm(`Are you sure you want to permanently delete camp "${camp.name}"?`)) {
      return;
    }
    try {
      await apiFetch(`/admin/camps/${camp._id}`, { method: 'DELETE' });
      loadCamps();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      {/* ── Policy Notice Banner ── */}
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
          <strong>CCCM Camp Decommissioning Policy: </strong>
          <span>
            Camps <strong>never close automatically</strong>. When a planned closure date arrives,
            the status changes to <em>Closure Due</em>. An authorized manager or administrator must
            explicitly review the field situation to either <strong>confirm closure</strong> or{' '}
            <strong>grant an operational extension</strong>.
          </span>
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      {summary && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              padding: 16,
              background: '#ffffff',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Total Sites
            </span>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
              {summary.total}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: 4 }}>
              {summary.active + summary.extended} active/extended sites
            </div>
          </div>

          <div
            style={{
              padding: 16,
              background: '#ffffff',
              borderRadius: 8,
              border: summary.closureDue > 0 ? '1px solid #f59e0b' : '1px solid #e2e8f0',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              backgroundColor: summary.closureDue > 0 ? '#fffbeb' : '#ffffff',
            }}
          >
            <span style={{ fontSize: '11px', color: '#b45309', fontWeight: 700, textTransform: 'uppercase' }}>
              Closure Due
            </span>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#d97706', marginTop: 4 }}>
              {summary.closureDue}
            </div>
            <div style={{ fontSize: '12px', color: '#b45309', marginTop: 4 }}>
              Action required: Confirm or Extend
            </div>
          </div>

          <div
            style={{
              padding: 16,
              background: '#ffffff',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <span style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: 700, textTransform: 'uppercase' }}>
              Extended Sites
            </span>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#2563eb', marginTop: 4 }}>
              {summary.extended}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: 4 }}>
              Extension granted by manager
            </div>
          </div>

          <div
            style={{
              padding: 16,
              background: '#ffffff',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <span style={{ fontSize: '11px', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>
              Closed Sites
            </span>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#64748b', marginTop: 4 }}>
              {summary.closed}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: 4 }}>
              Decommissioned
            </div>
          </div>

          <div
            style={{
              padding: 16,
              background: '#ffffff',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <span style={{ fontSize: '11px', color: '#15803d', fontWeight: 700, textTransform: 'uppercase' }}>
              Total Population
            </span>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#16a34a', marginTop: 4 }}>
              {summary.totalPopulation.toLocaleString()}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: 4 }}>
              Occupancy: {summary.occupancyRate}% of {summary.totalCapacity.toLocaleString()} cap
            </div>
          </div>
        </div>
      )}

      {/* ── Search & Actions Bar ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1, minWidth: 280 }}>
          <input
            type="text"
            placeholder="Search camp by name, location, manager…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ ...formInputStyle, maxWidth: 360 }}
          />

          <div className="dashboard-filter-group" style={{ margin: 0 }}>
            {[
              { key: '', label: 'All Statuses' },
              { key: 'active', label: 'Active' },
              { key: 'closureDue', label: '⚠️ Closure Due' },
              { key: 'extended', label: 'Extended' },
              { key: 'closed', label: 'Closed' },
            ].map((s) => (
              <button
                key={s.key || 'all-camps'}
                className={`dashboard-filter-btn ${statusFilter === s.key ? 'active' : ''}`}
                onClick={() => setStatusFilter(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <button
          className="primary-button"
          style={{ width: 'auto', margin: 0, padding: '9px 20px', minHeight: 'auto', fontSize: '13px' }}
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? 'Close Form' : '+ Establish New Camp'}
        </button>
      </div>

      {/* ── Establish New Camp Form ── */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateCamp}
          style={{
            marginBottom: 24,
            padding: 24,
            background: '#f8fafc',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                Establish New Relief Camp Site
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                Register site parameters, assign manager, and set the planned operational timeline.
              </p>
            </div>
            <button type="button" onClick={() => setShowCreateForm(false)} className="dashboard-filter-btn">
              Cancel
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Camp Name *
              </label>
              <input
                name="name"
                type="text"
                placeholder="e.g. Camp Jalozai Sector Alpha"
                required
                style={formInputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Linked Disaster Incident
              </label>
              <select name="disasterId" style={formInputStyle}>
                <option value="">-- Standalone / General Emergency --</option>
                {disasters.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.title} ({d.type} - {d.severity})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Assigned Camp Manager *
              </label>
              <select name="managerId" style={formInputStyle}>
                {managers.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.fullName} ({m.email}) [{m.role}]
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Location / District *
              </label>
              <input
                name="locationName"
                type="text"
                placeholder="e.g. Nowshera District, KP"
                required
                style={formInputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Maximum Shelter Capacity (persons) *
              </label>
              <input
                name="capacity"
                type="number"
                min="10"
                placeholder="e.g. 2500"
                required
                style={formInputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Current Sheltered Population
              </label>
              <input
                name="population"
                type="number"
                min="0"
                defaultValue="0"
                placeholder="e.g. 450"
                style={formInputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Planned Closure Date *
              </label>
              <input
                name="plannedClosureDate"
                type="date"
                defaultValue={
                  new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                }
                required
                style={formInputStyle}
              />
            </div>
          </div>

          {/* Initial Supplies Status */}
          <div style={{ marginTop: 16 }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: 8 }}>
              Initial Essential Resources Supply Status
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {['water', 'food', 'medicine', 'shelter'].map((res) => (
                <div key={res}>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'capitalize' }}>
                    {res} Availability
                  </span>
                  <select name={`res_${res}`} defaultValue="sufficient" style={formInputStyle}>
                    <option value="sufficient">Sufficient Supply</option>
                    <option value="low">Low Supply Warning</option>
                    <option value="critical">Critical Shortage</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Facilities Checkboxes */}
          <div style={{ marginTop: 16 }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: 8 }}>
              Established Camp Infrastructure & Facilities
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: '13px', color: '#334155' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: 0 }}>
                <input type="checkbox" name="fac_water" value="Clean Water Network" defaultChecked /> Clean Water Network
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: 0 }}>
                <input type="checkbox" name="fac_latrines" value="Sanitation Latrines" defaultChecked /> Latrines & Washrooms
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: 0 }}>
                <input type="checkbox" name="fac_health" value="Emergency Clinic" defaultChecked /> Emergency Clinic
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: 0 }}>
                <input type="checkbox" name="fac_security" value="Perimeter Security" defaultChecked /> Perimeter Security
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: 0 }}>
                <input type="checkbox" name="fac_solar" value="Solar Lighting" defaultChecked /> Solar Lighting
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: 0 }}>
                <input type="checkbox" name="fac_childcare" value="Child-Friendly Space" /> Child-Friendly Space
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: 0 }}>
                <input type="checkbox" name="fac_waste" value="Waste Disposal Pit" /> Waste Disposal Pit
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <button
              className="primary-button"
              type="submit"
              style={{ width: 'auto', margin: 0, padding: '9px 24px', minHeight: 'auto' }}
            >
              Establish Camp
            </button>
            <button type="button" onClick={() => setShowCreateForm(false)} className="dashboard-signout-btn">
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && <p className="feedback error">{error}</p>}
      {loading && <p className="feedback notice">Loading relief camps…</p>}

      {!loading && camps.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 16px',
            color: '#64748b',
            background: '#f8fafc',
            borderRadius: 8,
            border: '1px dashed #cbd5e1',
          }}
        >
          <p style={{ margin: 0, fontWeight: 500 }}>No camp sites found matching current filters.</p>
          <p style={{ margin: '6px 0 0', fontSize: '12px' }}>
            Click "+ Establish New Camp" above to create and initialize the first site.
          </p>
        </div>
      )}

      {/* ── Camps Cards List ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {camps.map((camp) => {
          const occPercent =
            camp.capacity > 0 ? Math.min(100, Math.round(((camp.population || 0) / camp.capacity) * 100)) : 0;
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
                boxShadow: isClosureDue ? '0 2px 8px rgba(245, 158, 11, 0.15)' : 'none',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
                      ⛺ {camp.name}
                    </h3>
                    <Badge color={statusColors[camp.status] || '#64748b'}>
                      {isClosureDue ? '⚠️ Closure Due' : camp.status}
                    </Badge>
                    {camp.disasterId && (
                      <span
                        style={{
                          fontSize: '11px',
                          color: '#0369a1',
                          background: '#e0f2fe',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontWeight: 600,
                        }}
                      >
                        🌪️ {camp.disasterId.title}
                      </span>
                    )}
                  </div>

                  <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748b' }}>
                    Location: <strong style={{ color: '#334155' }}>{camp.location?.name || 'General Area'}</strong>
                    {' • '}
                    Manager:{' '}
                    <strong style={{ color: '#334155' }}>
                      {camp.managerId?.fullName || 'Assigned Manager'}
                    </strong>{' '}
                    ({camp.managerId?.email})
                  </p>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {!isClosed ? (
                    <>
                      <button
                        type="button"
                        className="dashboard-signout-btn"
                        style={{
                          background: '#2563eb',
                          borderColor: '#2563eb',
                          color: '#ffffff',
                          fontWeight: 700,
                        }}
                        onClick={() => openExtendModal(camp)}
                        title="Extend operational timeline"
                      >
                        ⏱️ Extend Duration
                      </button>

                      <button
                        type="button"
                        className="dashboard-signout-btn"
                        style={{
                          borderColor: isClosureDue ? '#f59e0b' : '#ef4444',
                          color: isClosureDue ? '#b45309' : '#dc2626',
                          fontWeight: isClosureDue ? 700 : 500,
                        }}
                        onClick={() => handleConfirmClosure(camp)}
                        title="Confirm closure of camp"
                      >
                        Confirm Closure
                      </button>

                      <button
                        type="button"
                        className="dashboard-signout-btn"
                        onClick={() => openEditModal(camp)}
                      >
                        Edit Supplies & Pop
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="dashboard-signout-btn"
                      style={{ color: '#16a34a', borderColor: '#bbf7d0' }}
                      onClick={() => handleReopenCamp(camp)}
                    >
                      Reopen Camp
                    </button>
                  )}

                  <button
                    type="button"
                    className="dashboard-signout-btn"
                    style={{ borderColor: '#cbd5e1', color: '#64748b' }}
                    onClick={() => handleDeleteCamp(camp)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Closure Due Alert Box */}
              {isClosureDue && (
                <div
                  style={{
                    marginTop: 14,
                    padding: 12,
                    background: '#fffbeb',
                    borderRadius: 6,
                    border: '1px solid #fde68a',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: '13px',
                    color: '#92400e',
                  }}
                >
                  <span style={{ fontSize: '18px' }}>⚠️</span>
                  <div>
                    <strong>Action Required: Planned closure date has arrived. </strong>
                    <span>
                      Under CCCM standard operating procedures,{' '}
                      <strong>camps never close automatically</strong>. The assigned manager or admin
                      must either click <strong>"Confirm Closure"</strong> to decommission, or{' '}
                      <strong>"Extend Duration"</strong> to keep the camp active.
                    </span>
                  </div>
                </div>
              )}

              {/* Population & Capacity Occupancy Bar */}
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: 6 }}>
                  <span>
                    <strong>Population:</strong> {(camp.population || 0).toLocaleString()} /{' '}
                    {(camp.capacity || 0).toLocaleString()} persons
                  </span>
                  <span style={{ fontWeight: 700, color: occPercent >= 90 ? '#dc2626' : '#16a34a' }}>
                    {occPercent}% Occupied
                  </span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: 8,
                    background: '#e2e8f0',
                    borderRadius: 999,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${occPercent}%`,
                      height: '100%',
                      background: occPercent >= 90 ? '#dc2626' : occPercent >= 75 ? '#ea580c' : '#16a34a',
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>

              {/* Resource Monitors & Dates */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginTop: 16,
                  paddingTop: 12,
                  borderTop: '1px solid #f1f5f9',
                }}
              >
                {/* 4 Essential Resources */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Resources:</span>
                  {(camp.resources || []).map((r) => {
                    const styling = resourceLevelColors[r.level] || resourceLevelColors.sufficient;
                    return (
                      <span
                        key={r.name}
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
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

                {/* Dates */}
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  {camp.plannedClosureDate && (
                    <span>
                      Planned Closure:{' '}
                      <strong style={{ color: isClosureDue ? '#d97706' : '#334155' }}>
                        {new Date(camp.plannedClosureDate).toLocaleDateString()}
                      </strong>
                    </span>
                  )}
                  {camp.closedAt && (
                    <span style={{ marginLeft: 8 }}>
                      • Closed:{' '}
                      <strong style={{ color: '#64748b' }}>
                        {new Date(camp.closedAt).toLocaleDateString()}
                      </strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Facilities tags */}
              {camp.facilities && camp.facilities.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  {camp.facilities.map((fac, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: '11px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        padding: '2px 8px',
                        borderRadius: 4,
                        color: '#475569',
                      }}
                    >
                      ✓ {fac}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Extension Modal ── */}
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
          <div
            style={{
              background: '#ffffff',
              borderRadius: 12,
              width: '100%',
              maxWidth: 500,
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
              Extend Camp Duration: {extendingCamp.name}
            </h3>
            <p style={{ margin: '6px 0 16px', fontSize: '13px', color: '#64748b' }}>
              Set a new operational timeline. Under CCCM policy, camps only close upon manual confirmation.
            </p>

            <form onSubmit={handleSaveExtension}>
              <div style={{ marginBottom: 16 }}>
                <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                  Quick Extension Intervals
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[30, 60, 90, 180].map((days) => (
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
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  New Planned Closure Date *
                </label>
                <input
                  type="date"
                  value={customExtDate}
                  onChange={(e) => setCustomExtDate(e.target.value)}
                  required
                  style={formInputStyle}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  onClick={() => setExtendingCamp(null)}
                  className="dashboard-signout-btn"
                >
                  Cancel
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={extensionBusy}
                  style={{ width: 'auto', margin: 0, padding: '8px 22px', minHeight: 'auto', background: '#2563eb' }}
                >
                  {extensionBusy ? 'Extending…' : 'Confirm Extension'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Supplies & Population Modal ── */}
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
          <div
            style={{
              background: '#ffffff',
              borderRadius: 12,
              width: '100%',
              maxWidth: 520,
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
              Update Camp Parameters: {editingCamp.name}
            </h3>
            <p style={{ margin: '6px 0 16px', fontSize: '13px', color: '#64748b' }}>
              Adjust live population headcount and report essential resource shortage levels.
            </p>

            <form onSubmit={handleSaveEdit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                    Current Population
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editPopulation}
                    onChange={(e) => setEditPopulation(e.target.value)}
                    required
                    style={formInputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                    Maximum Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editCapacity}
                    onChange={(e) => setEditCapacity(e.target.value)}
                    required
                    style={formInputStyle}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                  Resource Shortage / Sufficiency Status
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  onClick={() => setEditingCamp(null)}
                  className="dashboard-signout-btn"
                >
                  Cancel
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={editBusy}
                  style={{ width: 'auto', margin: 0, padding: '8px 22px', minHeight: 'auto' }}
                >
                  {editBusy ? 'Saving…' : 'Save Parameters'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
