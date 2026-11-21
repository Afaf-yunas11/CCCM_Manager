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
  pending: '#d97706',
  in_progress: '#2563eb',
  resolved: '#16a34a',
  rejected: '#64748b',
};

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

export default function ResidentDashboard({ user, onLogout }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadMyRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/requests/my');
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMyRequests();
  }, [loadMyRequests]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    const fd = new FormData(e.currentTarget);
    try {
      await apiFetch('/requests', {
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
      setSuccess('Your report has been submitted to camp administration.');
      setShowForm(false);
      loadMyRequests();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const inProgressCount = requests.filter((r) => r.status === 'in_progress').length;
  const resolvedCount = requests.filter((r) => r.status === 'resolved').length;

  return (
    <DashboardLayout
      user={user}
      onLogout={onLogout}
      portalTitle="Community Member Portal"
      title={`Welcome, ${user.fullName}`}
      subtitle="Access camp assistance, submit service requests or complaints, and stay informed on relief delivery."
    >
      <div className="dashboard-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Community Member Services</h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>Account: {user.email}</p>
          </div>

          <button
            className="primary-button"
            style={{ width: 'auto', margin: 0, padding: '9px 20px', minHeight: 'auto', fontSize: '13px' }}
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Close Form' : '+ Submit New Request or Complaint'}
          </button>
        </div>

        {/* Status Metrics */}
        <div
          style={{
            padding: 20,
            background: '#f8fafc',
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div style={{ padding: 16, background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Status</span>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#16a34a', marginTop: 4 }}>Account Active</div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>Verified profile ready to receive assistance.</p>
          </div>

          <div style={{ padding: 16, background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>My Requests & Complaints</span>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{requests.length} Total</div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>
              {pendingCount} pending • {inProgressCount} in progress • {resolvedCount} resolved
            </p>
          </div>

          <div style={{ padding: 16, background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Camp Announcements</span>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginTop: 4 }}>Normal Operations</div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>Relief supplies and health teams active.</p>
          </div>
        </div>

        {success && <p className="feedback notice" style={{ marginBottom: 16 }}>{success}</p>}
        {error && <p className="feedback error" style={{ marginBottom: 16 }}>{error}</p>}

        {/* ── Submission Form ── */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            style={{
              marginBottom: 28,
              padding: 24,
              background: '#f8fafc',
              borderRadius: 10,
              border: '1px solid #cbd5e1',
            }}
          >
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                Submit Assistance Request or Issue Complaint
              </h4>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                Your request will be routed directly to camp administrators and coordinators.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Subject / Summary *
                </label>
                <input
                  name="title"
                  type="text"
                  placeholder="e.g. Urgent drinking water needed for elderly family member"
                  required
                  style={formInputStyle}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Type *
                </label>
                <select name="type" defaultValue="request" style={formInputStyle}>
                  <option value="request">Assistance Request (Food, Water, Shelter, Health)</option>
                  <option value="complaint">Complaint / Problem Report</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Category *
                </label>
                <select name="category" defaultValue="water" style={formInputStyle}>
                  <option value="water">Clean Water (WASH)</option>
                  <option value="food">Food & Rations</option>
                  <option value="medicine">Medicine / Healthcare</option>
                  <option value="shelter">Shelter & Blankets</option>
                  <option value="sanitation">Sanitation / Hygiene</option>
                  <option value="protection">Protection / Safety Concern</option>
                  <option value="problem">Camp Problem / Damage</option>
                  <option value="other">Other Need</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Urgency / Priority
                </label>
                <select name="priority" defaultValue="medium" style={formInputStyle}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical (Immediate danger or severe shortage)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Tent # / Block / Location
                </label>
                <input
                  name="location"
                  type="text"
                  placeholder="e.g. Block C, Tent #18"
                  style={formInputStyle}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Detailed Explanation *
                </label>
                <textarea
                  name="details"
                  rows="3"
                  placeholder="Describe your situation and what support is needed..."
                  required
                  style={{ ...formInputStyle, resize: 'vertical' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
              <button
                className="primary-button"
                type="submit"
                disabled={submitting}
                style={{ width: 'auto', margin: 0, padding: '9px 24px', minHeight: 'auto' }}
              >
                {submitting ? 'Submitting…' : 'Send to Administration'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="dashboard-signout-btn"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* ── My Requests List ── */}
        <div>
          <h4 style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
            My Submitted Items
          </h4>

          {loading && <p className="feedback notice">Loading your items…</p>}

          {!loading && requests.length === 0 && (
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
              <p style={{ margin: 0, fontWeight: 500 }}>You haven't submitted any requests or complaints yet.</p>
              <p style={{ margin: '6px 0 0', fontSize: '12px' }}>
                Click "+ Submit New Request or Complaint" above if you need assistance or want to report an issue.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {requests.map((r) => (
              <div
                key={r._id}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: 16,
                  background: '#ffffff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: r.type === 'complaint' ? '#fee2e2' : '#e0f2fe',
                          color: r.type === 'complaint' ? '#991b1b' : '#0369a1',
                        }}
                      >
                        {r.type === 'complaint' ? '⚠️ Complaint' : '📦 Request'}
                      </span>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                        {r.title}
                      </h4>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                      Category: <strong style={{ textTransform: 'capitalize' }}>{r.category}</strong>
                      {r.location ? ` • Location: ${r.location}` : ''}
                      {` • Submitted: ${new Date(r.createdAt).toLocaleDateString()}`}
                    </p>
                  </div>

                  <span
                    style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: 999,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      background: statusColors[r.status] || '#64748b',
                      color: '#ffffff',
                    }}
                  >
                    {r.status}
                  </span>
                </div>

                <p style={{ margin: '10px 0 0', fontSize: '13px', color: '#334155', lineHeight: 1.5 }}>
                  {r.details}
                </p>

                {r.resolutionDetails && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: 12,
                      background: '#f0fdf4',
                      borderRadius: 6,
                      border: '1px solid #bbf7d0',
                      fontSize: '13px',
                      color: '#166534',
                    }}
                  >
                    <strong>Administration Response / Resolution:</strong>
                    <p style={{ margin: '4px 0 0' }}>{r.resolutionDetails}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
