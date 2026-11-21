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

const priorityColors = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#d97706',
  low: '#2563eb',
};

const statusColors = {
  pending: '#d97706',
  in_progress: '#2563eb',
  resolved: '#16a34a',
  rejected: '#64748b',
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

export default function AdminRequestsPage() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Selected item for detail / resolution modal
  const [activeModalItem, setActiveModalItem] = useState(null);
  const [modalStatus, setModalStatus] = useState('');
  const [modalPriority, setModalPriority] = useState('');
  const [modalAdminNotes, setModalAdminNotes] = useState('');
  const [modalResolution, setModalResolution] = useState('');
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState('');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.append('type', typeFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (priorityFilter) params.append('priority', priorityFilter);
      if (categoryFilter) params.append('category', categoryFilter);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());

      const qs = params.toString() ? `?${params.toString()}` : '';
      const data = await apiFetch(`/admin/requests${qs}`);
      setItems(data.items || []);
      setSummary(data.summary || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter, priorityFilter, categoryFilter, searchTerm]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Quick status update (e.g. from table buttons)
  async function quickStatusChange(id, nextStatus) {
    try {
      await apiFetch(`/admin/requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      loadRequests();
    } catch (err) {
      setError(err.message);
    }
  }

  // Open resolution & detail modal
  function openModal(item) {
    setActiveModalItem(item);
    setModalStatus(item.status);
    setModalPriority(item.priority || 'medium');
    setModalAdminNotes(item.adminNotes || '');
    setModalResolution(item.resolutionDetails || '');
    setModalError('');
  }

  // Save changes from modal
  async function saveModalChanges(e) {
    e.preventDefault();
    if (!activeModalItem) return;
    setModalBusy(true);
    setModalError('');
    try {
      await apiFetch(`/admin/requests/${activeModalItem._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: modalStatus,
          priority: modalPriority,
          adminNotes: modalAdminNotes,
          resolutionDetails: modalResolution,
        }),
      });
      setActiveModalItem(null);
      loadRequests();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setModalBusy(false);
    }
  }

  // Delete item
  async function handleDelete(id) {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      await apiFetch(`/admin/requests/${id}`, { method: 'DELETE' });
      setActiveModalItem(null);
      loadRequests();
    } catch (err) {
      setError(err.message);
    }
  }

  // New Request / Complaint submission
  async function handleCreate(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await apiFetch('/admin/requests', {
        method: 'POST',
        body: JSON.stringify({
          title: fd.get('title'),
          type: fd.get('type'),
          category: fd.get('category'),
          priority: fd.get('priority'),
          location: fd.get('location'),
          details: fd.get('details'),
        }),
      });
      setShowForm(false);
      loadRequests();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
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
              Total Logs
            </span>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
              {summary.total}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: 4 }}>
              {summary.requests} requests • {summary.complaints} complaints
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
            <span style={{ fontSize: '11px', color: '#b45309', fontWeight: 700, textTransform: 'uppercase' }}>
              Pending Review
            </span>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#d97706', marginTop: 4 }}>
              {summary.pending}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: 4 }}>
              Awaiting triage
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
              In Progress
            </span>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#2563eb', marginTop: 4 }}>
              {summary.in_progress}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: 4 }}>
              Assigned to field teams
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
              Resolved
            </span>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#16a34a', marginTop: 4 }}>
              {summary.resolved}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: 4 }}>
              Action completed
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
            <span style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 700, textTransform: 'uppercase' }}>
              Critical / High
            </span>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#dc2626', marginTop: 4 }}>
              {(summary.critical || 0) + (summary.high || 0)}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: 4 }}>
              Needs immediate action
            </div>
          </div>
        </div>
      )}

      {/* ── Top Bar with Search & Action ── */}
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
            placeholder="Search by title, citizen name, details, location…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ ...formInputStyle, maxWidth: 380 }}
          />
        </div>

        <button
          className="primary-button"
          style={{ width: 'auto', margin: 0, padding: '9px 20px', minHeight: 'auto', fontSize: '13px' }}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Close Form' : '+ Log Complaint / Request'}
        </button>
      </div>

      {/* ── Log New Request / Complaint Form ── */}
      {showForm && (
        <form
          onSubmit={handleCreate}
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
                Log Community Complaint or Assistance Request
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                Record issues submitted directly by residents or reported from the field.
              </p>
            </div>
            <button type="button" onClick={() => setShowForm(false)} className="dashboard-filter-btn">
              Cancel
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Title / Subject *
              </label>
              <input
                name="title"
                type="text"
                placeholder="e.g. Broken water pipeline near Sector 3"
                required
                style={formInputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Type *
              </label>
              <select name="type" defaultValue="complaint" style={formInputStyle}>
                <option value="complaint">Complaint</option>
                <option value="request">Assistance Request</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Category *
              </label>
              <select name="category" defaultValue="water" style={formInputStyle}>
                <option value="food">Food & Nutrition</option>
                <option value="water">Clean Water (WASH)</option>
                <option value="medicine">Medicine & Health</option>
                <option value="shelter">Shelter & Non-Food Items</option>
                <option value="sanitation">Sanitation & Waste</option>
                <option value="protection">Protection / Vulnerability</option>
                <option value="problem">Camp Infrastructure Problem</option>
                <option value="other">Other Concern</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Priority Level
              </label>
              <select name="priority" defaultValue="high" style={formInputStyle}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical (Immediate)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Location / Sector / Camp
              </label>
              <input
                name="location"
                type="text"
                placeholder="e.g. Block B, Tent #42 or Sector 2"
                style={formInputStyle}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Full Details & Specific Needs *
              </label>
              <textarea
                name="details"
                rows="3"
                placeholder="Describe the problem, affected families, and any safety or health risks..."
                required
                style={{ ...formInputStyle, resize: 'vertical' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
            <button
              className="primary-button"
              type="submit"
              style={{ width: 'auto', margin: 0, padding: '9px 24px', minHeight: 'auto' }}
            >
              Submit & Register
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="dashboard-signout-btn">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── Filter Buttons Bar ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {/* Type Filter */}
        <div className="dashboard-filter-group" style={{ margin: 0 }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginRight: 4 }}>Type:</span>
          {[
            { key: '', label: 'All Types' },
            { key: 'complaint', label: 'Complaints Only' },
            { key: 'request', label: 'Requests Only' },
          ].map((t) => (
            <button
              key={t.key || 'all-type'}
              className={`dashboard-filter-btn ${typeFilter === t.key ? 'active' : ''}`}
              onClick={() => setTypeFilter(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="dashboard-filter-group" style={{ margin: 0 }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginRight: 4 }}>Status:</span>
          {[
            { key: '', label: 'All Statuses' },
            { key: 'pending', label: 'Pending' },
            { key: 'in_progress', label: 'In Progress' },
            { key: 'resolved', label: 'Resolved' },
            { key: 'rejected', label: 'Rejected' },
          ].map((s) => (
            <button
              key={s.key || 'all-status'}
              className={`dashboard-filter-btn ${statusFilter === s.key ? 'active' : ''}`}
              onClick={() => setStatusFilter(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Priority Filter */}
        <div className="dashboard-filter-group" style={{ margin: 0 }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginRight: 4 }}>Priority:</span>
          {[
            { key: '', label: 'All Priorities' },
            { key: 'critical', label: 'Critical' },
            { key: 'high', label: 'High' },
            { key: 'medium', label: 'Medium' },
            { key: 'low', label: 'Low' },
          ].map((p) => (
            <button
              key={p.key || 'all-priority'}
              className={`dashboard-filter-btn ${priorityFilter === p.key ? 'active' : ''}`}
              onClick={() => setPriorityFilter(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="feedback error">{error}</p>}
      {loading && <p className="feedback notice">Loading complaints and requests…</p>}

      {!loading && items.length === 0 && (
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
          <p style={{ margin: 0, fontWeight: 500 }}>No complaints or requests matching current filters.</p>
        </div>
      )}

      {/* ── Table of Requests & Complaints ── */}
      {items.length > 0 && (
        <div className="dashboard-table-container">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Type & Category</th>
                <th>Subject & Details</th>
                <th>Submitter</th>
                <th>Location</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isComplaint = item.type === 'complaint';
                return (
                  <tr key={item._id}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: isComplaint ? '#fee2e2' : '#e0f2fe',
                            color: isComplaint ? '#991b1b' : '#0369a1',
                            width: 'fit-content',
                          }}
                        >
                          {isComplaint ? '⚠️ Complaint' : '📦 Request'}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'capitalize' }}>
                          {item.category}
                        </span>
                        {item.isRestricted && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 2,
                              fontSize: '10px',
                              fontWeight: 700,
                              color: '#991b1b',
                            }}
                          >
                            🔒 Restricted
                          </span>
                        )}
                      </div>
                    </td>

                    <td style={{ maxWidth: 300 }}>
                      <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>
                        {item.title || `${item.category} issue`}
                      </strong>
                      <p
                        style={{
                          margin: '4px 0 0',
                          fontSize: '12px',
                          color: '#475569',
                          lineHeight: 1.4,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {item.details}
                      </p>
                      {item.resolutionDetails && (
                        <div
                          style={{
                            marginTop: 6,
                            padding: '4px 8px',
                            background: '#f0fdf4',
                            borderRadius: 4,
                            fontSize: '11px',
                            color: '#166534',
                          }}
                        >
                          <strong>Resolution:</strong> {item.resolutionDetails}
                        </div>
                      )}
                    </td>

                    <td>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{item.userId?.fullName || 'Anonymous'}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{item.userId?.email || '—'}</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'capitalize' }}>
                        Role: {item.userId?.role || 'Citizen'}
                      </div>
                    </td>

                    <td style={{ whiteSpace: 'nowrap', fontSize: '12px', color: '#334155' }}>
                      <div>{item.location || item.campId?.name || 'General Field'}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                        {new Date(item.createdAt).toLocaleDateString()}
                      </div>
                    </td>

                    <td>
                      <Badge color={priorityColors[item.priority] || '#d97706'}>
                        {item.priority || 'medium'}
                      </Badge>
                    </td>

                    <td>
                      <Badge color={statusColors[item.status] || '#64748b'}>
                        {item.status}
                      </Badge>
                    </td>

                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {item.status === 'pending' && (
                          <button
                            type="button"
                            className="dashboard-signout-btn"
                            style={{ padding: '4px 8px', fontSize: '11px', color: '#2563eb', borderColor: '#bfdbfe' }}
                            onClick={() => quickStatusChange(item._id, 'in_progress')}
                            title="Mark In Progress"
                          >
                            Start Work
                          </button>
                        )}
                        {item.status !== 'resolved' && (
                          <button
                            type="button"
                            className="dashboard-signout-btn"
                            style={{ padding: '4px 8px', fontSize: '11px', color: '#16a34a', borderColor: '#bbf7d0' }}
                            onClick={() => quickStatusChange(item._id, 'resolved')}
                            title="Mark Resolved"
                          >
                            Resolve
                          </button>
                        )}
                        <button
                          type="button"
                          className="dashboard-signout-btn"
                          style={{ padding: '4px 10px', fontSize: '11px' }}
                          onClick={() => openModal(item)}
                        >
                          Review & Notes
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Detail / Resolution Modal ── */}
      {activeModalItem && (
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
              maxWidth: 620,
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    background: activeModalItem.type === 'complaint' ? '#fee2e2' : '#e0f2fe',
                    color: activeModalItem.type === 'complaint' ? '#991b1b' : '#0369a1',
                    marginBottom: 6,
                  }}
                >
                  {activeModalItem.type === 'complaint' ? '⚠️ Complaint' : '📦 Assistance Request'}
                </span>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                  {activeModalItem.title || 'Record Details'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalItem(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {/* Resident Details Readout */}
            <div
              style={{
                background: '#f8fafc',
                padding: 16,
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                marginBottom: 20,
                fontSize: '13px',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <div>
                  <span style={{ color: '#64748b' }}>Submitter: </span>
                  <strong>{activeModalItem.userId?.fullName || 'Citizen'}</strong> ({activeModalItem.userId?.email})
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Location: </span>
                  <strong>{activeModalItem.location || 'Not specified'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Category: </span>
                  <strong style={{ textTransform: 'capitalize' }}>{activeModalItem.category}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Logged on: </span>
                  <strong>{new Date(activeModalItem.createdAt).toLocaleString()}</strong>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
                <span style={{ color: '#64748b', display: 'block', marginBottom: 4, fontWeight: 600 }}>
                  Description:
                </span>
                <p style={{ margin: 0, color: '#0f172a', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {activeModalItem.details}
                </p>
              </div>
            </div>

            {/* Management Form */}
            <form onSubmit={saveModalChanges}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                    Status
                  </label>
                  <select
                    value={modalStatus}
                    onChange={(e) => setModalStatus(e.target.value)}
                    style={formInputStyle}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                    Priority
                  </label>
                  <select
                    value={modalPriority}
                    onChange={(e) => setModalPriority(e.target.value)}
                    style={formInputStyle}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Resolution Details & Feedback to Citizen
                </label>
                <textarea
                  rows="2"
                  value={modalResolution}
                  onChange={(e) => setModalResolution(e.target.value)}
                  placeholder="e.g. Water truck dispatched to Sector 3. Repaired pipeline."
                  style={{ ...formInputStyle, resize: 'vertical' }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Internal Admin Notes (Private)
                </label>
                <textarea
                  rows="2"
                  value={modalAdminNotes}
                  onChange={(e) => setModalAdminNotes(e.target.value)}
                  placeholder="Notes for administration and camp coordinators..."
                  style={{ ...formInputStyle, resize: 'vertical' }}
                />
              </div>

              {modalError && <p className="feedback error">{modalError}</p>}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
                <button
                  type="button"
                  onClick={() => handleDelete(activeModalItem._id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#dc2626',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  Delete Record
                </button>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setActiveModalItem(null)}
                    className="dashboard-signout-btn"
                  >
                    Cancel
                  </button>
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={modalBusy}
                    style={{ width: 'auto', margin: 0, padding: '8px 22px', minHeight: 'auto' }}
                  >
                    {modalBusy ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
