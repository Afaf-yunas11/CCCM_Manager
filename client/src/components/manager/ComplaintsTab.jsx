import React, { useEffect, useState } from 'react';
import { managerApi } from '../../services/managerApi';
import { Notice, StatusBadge, inputStyle } from './ui';
import NgoComplaintsPanel from './NgoComplaintsPanel';

const STATUS_LABELS = {
  pending: 'Pending',
  in_progress: 'In progress',
  resolved: 'Resolved',
};

export default function ComplaintsTab() {
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    managerApi.requests().then(setRequests).catch((loadError) => setError(loadError.message));
  }, []);

  async function updateStatus(request, status) {
    setError('');
    try {
      const updated = await managerApi.updateRequest(request._id, status);
      setRequests((current) => current.map((item) => (
        item._id === request._id ? { ...item, ...updated, emailNotifications: item.emailNotifications } : item
      )));
    } catch (updateError) {
      setError(updateError.message);
    }
  }

  if (!requests) return <>{error ? <Notice error={error} /> : <p>Loading requests…</p>}</>;

  return (
    <div>
      <NgoComplaintsPanel />
      <div className="dashboard-card">
        <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>Community complaints and requests</h3>
        <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: 13 }}>
          Protection cases are visible only to the camp manager and are never emailed to NGOs.
        </p>
        <Notice error={error} />
        {!requests.length && <p style={{ color: '#64748b', fontSize: 13 }}>There are no community requests for your camps yet.</p>}
        {requests.map((request) => (
          <div key={request._id} style={{ borderTop: '1px solid #e2e8f0', padding: '14px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong style={{ textTransform: 'capitalize' }}>{request.category}</strong>
                  {request.isRestricted && <StatusBadge value="restricted" />}
                </div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                  {request.campId?.name || 'Camp'} · {new Date(request.createdAt).toLocaleString()}
                </div>
                <p style={{ margin: '6px 0', fontSize: 14, whiteSpace: 'pre-wrap' }}>{request.details}</p>
                {request.isRestricted ? (
                  <p style={{ margin: 0, fontSize: 12, color: '#991b1b' }}>Restricted protection case · manager only</p>
                ) : (
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {request.emailNotifications?.length
                      ? request.emailNotifications.map((notice, index) => (
                        <span key={`${notice.ngoName}-${index}`}>
                          {notice.status === 'sent' ? 'Emailed: ' : 'Email failed: '}{notice.ngoName}{index < request.emailNotifications.length - 1 ? ' · ' : ''}
                        </span>
                      ))
                      : 'No NGO email sent; visible to camp manager.'}
                  </div>
                )}
              </div>
              <div style={{ minWidth: 150 }}>
                <StatusBadge value={request.status} />
                <select
                  aria-label={`Request status for ${request.category}`}
                  style={{ ...inputStyle, marginTop: 8 }}
                  value={request.status}
                  onChange={(event) => updateStatus(request, event.target.value)}
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
