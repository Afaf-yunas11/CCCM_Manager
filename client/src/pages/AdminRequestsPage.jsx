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

  // Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [restrictedFilter, setRestrictedFilter] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Selected item for detail / resolution modal
  const [activeModalItem, setActiveModalItem] = useState(null);
  const [modalStatus, setModalStatus] = useState('');
  const [modalPriority, setModalPriority] = useState('');
  const [modalAdminNotes, setModalAdminNotes] = useState('');
  const [modalResolution, setModalResolution] = useState('');
  const [modalRejectionReason, setModalRejectionReason] = useState('');
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
      if (restrictedFilter) params.append('restricted', 'true');
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
  }, [typeFilter, statusFilter, priorityFilter, categoryFilter, restrictedFilter, searchTerm]);

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

  // Quick reject with prompt for reason
  async function handleQuickReject(item) {
    const reason = window.prompt(
      `Reject "${item.title || 'this item'}"?\nPlease provide a rejection reason (will be logged in audit notes and visible to the submitter):`,
      'Duplicate request or out of emergency assistance scope'
    );
    if (!reason || !reason.trim()) return;

    try {
      await apiFetch(`/admin/requests/${item._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'rejected',
          rejectionReason: reason.trim(),
          resolutionDetails: `Declined: ${reason.trim()}`,
        }),
      });
      loadRequests();
    } catch (err) {
      setError(err.message);
    }
  }

  // Escalate critical item to NDMA / District Command
  async function handleEscalate(item) {
    const confirm = window.confirm(
      `ESCALATE TO EMERGENCY OPERATIONS?\n\nThis will escalate "${item.title}" to NDMA Emergency Operations and Provincial Camp Command for immediate emergency mobilization.\n\nProceed with escalation?`
    );
    if (!confirm) return;

    try {
      await apiFetch(`/admin/requests/${item._id}/escalate`, {
        method: 'POST',
        body: JSON.stringify({
          escalatedTo: 'NDMA Emergency Operations & Provincial Command',
          notes: 'Immediate triage required. High-risk emergency condition reported in camp sector.',
        }),
      });
      if (activeModalItem && activeModalItem._id === item._id) {
        setActiveModalItem(null);
      }
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
    setModalRejectionReason(item.rejectionReason || '');
    setModalError('');
  }

  // Save changes from modal
  async function saveModalChanges(e) {
    e.preventDefault();
    if (!activeModalItem) return;
    setModalBusy(true);
    setModalError('');
    try {
      const payload = {
        status: modalStatus,
        priority: modalPriority,
        adminNotes: modalAdminNotes,
        resolutionDetails: modalResolution,
      };
      if (modalStatus === 'rejected') {
        payload.rejectionReason = modalRejectionReason || modalResolution || 'Request declined based on verification criteria.';
      }

      await apiFetch(`/admin/requests/${activeModalItem._id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
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

  // New Request / Complaint submission — removed from admin side.
  // Affected persons submit through their own Community Member Portal.

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
              background: '#fff1f2',
              borderRadius: 8,
              border: '1px solid #fecdd3',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <span style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 700, textTransform: 'uppercase' }}>
              Critical / High
            </span>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#dc2626', marginTop: 4 }}>
              {summary.unresolvedUrgent !== undefined
                ? summary.unresolvedUrgent
                : (summary.critical || 0) + (summary.high || 0)}
            </div>
            <div style={{ fontSize: '12px', color: '#991b1b', marginTop: 4, fontWeight: 500 }}>
              Needs immediate action (Unresolved only)
            </div>
          </div>

          <div
            style={{
              padding: 16,
              background: '#faf5ff',
              borderRadius: 8,
              border: '1px solid #e9d5ff',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <span style={{ fontSize: '11px', color: '#7e22ce', fontWeight: 700, textTransform: 'uppercase' }}>
              Protection / Restricted
            </span>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#6b21a8', marginTop: 4 }}>
              {summary.restricted || 0}
            </div>
            <div style={{ fontSize: '12px', color: '#7e22ce', marginTop: 4, fontWeight: 500 }}>
              Confidential (Manager & Admin only)
            </div>
          </div>
        </div>
      )}

      {/* ── Top Bar with Search ── */}
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
      </div>

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

        {/* Priority & Restricted Filter */}
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

          <span style={{ marginLeft: 12, marginRight: 4, color: '#cbd5e1' }}>|</span>

          {/* Dedicated Sensitive Cases Filter */}
          <button
            type="button"
            className={`dashboard-filter-btn ${restrictedFilter ? 'active' : ''}`}
            onClick={() => setRestrictedFilter(!restrictedFilter)}
            style={{
              borderColor: restrictedFilter ? '#9333ea' : '#d8b4fe',
              background: restrictedFilter ? '#7e22ce' : '#faf5ff',
              color: restrictedFilter ? '#ffffff' : '#6b21a8',
              fontWeight: 700,
            }}
          >
            Restricted (Protection Cases Only)
          </button>
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
                <th>Submitter (Affected Person)</th>
                <th>Location</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isComplaint = item.type === 'complaint';
                const isUnresolvedCritical =
                  item.priority === 'critical' &&
                  !['resolved', 'rejected'].includes(item.status);

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
                          {isComplaint ? 'Complaint' : 'Request'}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'capitalize' }}>
                          {item.category}
                        </span>

                        {item.isRestricted && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              fontSize: '10px',
                              fontWeight: 700,
                              color: '#991b1b',
                              background: '#fef2f2',
                              border: '1px solid #fecaca',
                              padding: '2px 6px',
                              borderRadius: 4,
                              width: 'fit-content',
                            }}
                            title="Confidential: Restricted to Camp Manager and CCCM Admin only. Never shared with NGOs."
                          >
                            Restricted Case
                          </span>
                        )}

                        {item.isEscalated && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              fontSize: '10px',
                              fontWeight: 800,
                              color: '#b91c1c',
                              background: '#fee2e2',
                              border: '1px solid #ef4444',
                              padding: '2px 6px',
                              borderRadius: 4,
                              width: 'fit-content',
                            }}
                            title={`Escalated to: ${item.escalatedTo || 'NDMA Operations'}`}
                          >
                            ESCALATED
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

                      {item.isRestricted && (
                        <div
                          style={{
                            marginTop: 6,
                            padding: '3px 8px',
                            background: '#fff1f2',
                            border: '1px dashed #fecdd3',
                            borderRadius: 4,
                            fontSize: '10px',
                            color: '#9f1239',
                            fontWeight: 600,
                          }}
                        >
                          Confidential Safeguarding Case: Visible to Camp Manager &amp; Admin only (Never shared with NGOs).
                        </div>
                      )}

                      {item.rejectionReason && (
                        <div
                          style={{
                            marginTop: 6,
                            padding: '4px 8px',
                            background: '#fef2f2',
                            borderRadius: 4,
                            fontSize: '11px',
                            color: '#991b1b',
                          }}
                        >
                          <strong>Rejection Reason:</strong> {item.rejectionReason}
                        </div>
                      )}

                      {item.resolutionDetails && !item.rejectionReason && (
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
                      <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>
                        {item.userId?.fullName || 'Resident Citizen'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        {item.userId?.email || '—'}
                      </div>
                      <div style={{ fontSize: '10px', color: '#2563eb', fontWeight: 600, textTransform: 'capitalize' }}>
                        {item.userId?.role === 'affectedPerson' ? 'Affected Person' : (item.userId?.role || 'Affected Person')}
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
                        {/* Escalate button for unresolved critical items */}
                        {isUnresolvedCritical && !item.isEscalated && (
                          <button
                            type="button"
                            className="dashboard-signout-btn"
                            style={{
                              padding: '4px 8px',
                              fontSize: '11px',
                              color: '#ffffff',
                              background: '#dc2626',
                              borderColor: '#b91c1c',
                              fontWeight: 700,
                            }}
                            onClick={() => handleEscalate(item)}
                            title="Escalate critical threat to NDMA operations"
                          >
                            Escalate
                          </button>
                        )}

                        {/* Start work button for pending items */}
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

                        {/* Resolve button for pending/in_progress items */}
                        {item.status !== 'resolved' && item.status !== 'rejected' && (
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

                        {/* Reject button for pending/in_progress items */}
                        {item.status !== 'resolved' && item.status !== 'rejected' && (
                          <button
                            type="button"
                            className="dashboard-signout-btn"
                            style={{ padding: '4px 8px', fontSize: '11px', color: '#dc2626', borderColor: '#fca5a5' }}
                            onClick={() => handleQuickReject(item)}
                            title="Reject request with logged reason"
                          >
                            Reject
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
              maxWidth: 640,
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
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
                    }}
                  >
                    {activeModalItem.type === 'complaint' ? 'Complaint' : 'Assistance Request'}
                  </span>

                  {activeModalItem.isRestricted && (
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: '11px',
                        fontWeight: 700,
                        background: '#fef2f2',
                        color: '#991b1b',
                        border: '1px solid #fecaca',
                      }}
                    >
                      Restricted Case
                    </span>
                  )}

                  {activeModalItem.isEscalated && (
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: '11px',
                        fontWeight: 800,
                        background: '#fee2e2',
                        color: '#b91c1c',
                        border: '1px solid #ef4444',
                      }}
                    >
                      ESCALATED
                    </span>
                  )}
                </div>

                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                  {activeModalItem.title || 'Record Details'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalItem(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
              >
                X
              </button>
            </div>

            {/* Confidential Warning for Restricted Protection Cases */}
            {activeModalItem.isRestricted && (
              <div
                style={{
                  background: '#fff1f2',
                  border: '1px solid #fecdd3',
                  borderRadius: 8,
                  padding: '12px 14px',
                  marginBottom: 16,
                  color: '#9f1239',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                RESTRICTED & CONFIDENTIAL CASE — Protection Safeguarding Protocol
                <div style={{ fontWeight: 400, fontSize: '11px', marginTop: 3, color: '#881337', lineHeight: 1.4 }}>
                  This case involves sensitive protection/vulnerability concerns. Access is strictly limited to CCCM Admin and Camp Management. This file is automatically excluded from shared NGO exports and external partner views.
                </div>
              </div>
            )}

            {/* Escalation details if active */}
            {activeModalItem.isEscalated && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fca5a5',
                  borderRadius: 8,
                  padding: '12px 14px',
                  marginBottom: 16,
                  color: '#b91c1c',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                ESCALATED EMERGENCY CASE
                <div style={{ fontWeight: 500, fontSize: '11px', marginTop: 2, color: '#7f1d1d' }}>
                  Escalated to: {activeModalItem.escalatedTo || 'NDMA Operations Command'} on{' '}
                  {activeModalItem.escalatedAt ? new Date(activeModalItem.escalatedAt).toLocaleString() : 'N/A'}
                </div>
              </div>
            )}

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
                  <strong>{activeModalItem.userId?.fullName || 'Resident Citizen'}</strong>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    {activeModalItem.userId?.email || '—'} ({activeModalItem.userId?.role === 'affectedPerson' ? 'Affected Person' : (activeModalItem.userId?.role || 'Resident')})
                  </div>
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

              {/* Rejection Reason textarea if status is rejected */}
              {modalStatus === 'rejected' && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#b91c1c', marginBottom: 6 }}>
                    Rejection Reason * (Required for rejected status)
                  </label>
                  <textarea
                    rows="2"
                    value={modalRejectionReason}
                    onChange={(e) => setModalRejectionReason(e.target.value)}
                    placeholder="Provide specific reason for rejection (e.g. Duplicate claim, assistance already provided, out of mandate)..."
                    required
                    style={{ ...formInputStyle, borderColor: '#fca5a5', resize: 'vertical' }}
                  />
                </div>
              )}

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
                <div style={{ display: 'flex', gap: 10 }}>
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

                  {/* Escalate button inside modal */}
                  {activeModalItem.priority === 'critical' &&
                    !activeModalItem.isEscalated &&
                    !['resolved', 'rejected'].includes(activeModalItem.status) && (
                      <button
                        type="button"
                        onClick={() => handleEscalate(activeModalItem)}
                        style={{
                          background: '#dc2626',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 6,
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Escalate to NDMA
                      </button>
                    )}
                </div>

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
