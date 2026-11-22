import React, { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiFetch } from '../services/apiFetch';

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  fontSize: 13,
  boxSizing: 'border-box',
};

const STATUS_LABELS = { pending: 'Pending', in_progress: 'In progress', resolved: 'Resolved' };
const CATEGORIES = [
  ['food', 'Food'],
  ['water', 'Water'],
  ['medicine', 'Medicine'],
  ['shelter', 'Shelter'],
  ['problem', 'Other issue'],
  ['protection', 'Protection concern'],
];

export default function ResidentDashboard({ user, onLogout }) {
  const [camps, setCamps] = useState(null);
  const [requests, setRequests] = useState(null);
  const [campId, setCampId] = useState('');
  const [category, setCategory] = useState('food');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [availableCamps, ownRequests] = await Promise.all([
        apiFetch('/resident/camps'),
        apiFetch('/resident/requests'),
      ]);
      setCamps(availableCamps);
      setRequests(ownRequests);
      setCampId((current) => current || availableCamps[0]?._id || '');
    } catch (loadError) {
      setError(loadError.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function submitRequest(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await apiFetch('/resident/requests', {
        method: 'POST',
        body: JSON.stringify({ campId, category, details }),
      });
      setNotice(result.emailWarning || (
        result.notifiedNgos?.length
          ? `Request saved. Email sent to ${result.notifiedNgos.join(', ')}.`
          : result.notificationMessage
      ));
      setDetails('');
      setRequests(await apiFetch('/resident/requests'));
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardLayout
      user={user}
      onLogout={onLogout}
      portalTitle="Community Member Portal"
      title={`Welcome, ${user.fullName}`}
      subtitle="Submit a camp service request and follow its status."
    >
      <div className="dashboard-card">
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Submit a request</h3>
        {camps?.length === 0 && <p>No active camps are accepting requests.</p>}
        {camps?.length > 0 && (
          <form onSubmit={submitRequest}>
            <label style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
              Camp
              <select required value={campId} onChange={(event) => setCampId(event.target.value)} style={{ ...inputStyle, marginTop: 4 }}>
                {camps.map((camp) => <option key={camp._id} value={camp._id}>{camp.name} · {camp.location?.name || 'Location not provided'}</option>)}
              </select>
            </label>
            <label style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
              Request type
              <select value={category} onChange={(event) => setCategory(event.target.value)} style={{ ...inputStyle, marginTop: 4 }}>
                {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
              Details
              <textarea required minLength="1" maxLength="2000" rows="4" value={details} onChange={(event) => setDetails(event.target.value)} style={{ ...inputStyle, marginTop: 4, resize: 'vertical' }} />
            </label>
            <p style={{ color: '#64748b', fontSize: 12 }}>
              Protection concerns are visible only to the camp manager and are not emailed to NGOs. For other service requests, avoid including personal identifying information.
            </p>
            {error && <p role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>{error}</p>}
            {notice && <p role="status" style={{ color: '#166534', fontSize: 13 }}>{notice}</p>}
            <button type="submit" disabled={busy || !campId}>{busy ? 'Submitting…' : 'Submit request'}</button>
          </form>
        )}
        {camps === null && !error && <p>Loading camps…</p>}
        {error && !camps?.length && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
      </div>

      <div className="dashboard-card" style={{ marginTop: 16 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>My requests and status</h3>
        {requests === null && <p>Loading requests…</p>}
        {requests?.length === 0 && <p style={{ color: '#64748b' }}>You have not submitted any requests yet.</p>}
        {requests?.map((request) => (
          <div key={request._id} style={{ borderTop: '1px solid #e2e8f0', padding: '12px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ textTransform: 'capitalize' }}>{request.category}</strong>
              <strong>{STATUS_LABELS[request.status] || request.status}</strong>
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
              {request.campId?.name || 'Camp'} · {new Date(request.createdAt).toLocaleString()}
            </div>
            <p style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{request.details}</p>
            {request.isRestricted
              ? <p style={{ fontSize: 12, color: '#991b1b' }}>Visible to the camp manager only.</p>
              : request.emailNotifications?.length > 0 && (
                <p style={{ fontSize: 12, color: '#64748b' }}>
                  {request.emailNotifications.map((item) => `${item.status === 'sent' ? 'Emailed' : 'Email failed'}: ${item.ngoName}`).join(' · ')}
                </p>
              )}
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
