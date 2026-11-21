import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../services/apiFetch';
import { StatusBadge } from '../manager/ui';

const CATEGORY_LABELS = {
  food: 'Food',
  water: 'Water',
  medicine: 'Medicine',
  shelter: 'Shelter',
  sanitation: 'Sanitation',
  other: 'Other',
};

export default function NgoComplaintsTab() {
  const [complaints, setComplaints] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/ngo/complaints')
      .then(setComplaints)
      .catch((loadError) => setError(loadError.message));
  }, []);

  if (!complaints) return error ? <p role="alert" className="feedback error">{error}</p> : <p>Loading camp complaints…</p>;

  return (
    <div>
      <p style={{ color: '#64748b', fontSize: 13, marginTop: 0 }}>
        These complaints were sent to your organization by managers of camps where you provide accepted support.
      </p>
      {!complaints.length && (
        <div className="dashboard-card" style={{ color: '#64748b' }}>
          There are no complaints for your organization at your camps.
        </div>
      )}
      <div style={{ display: 'grid', gap: 12 }}>
        {complaints.map((complaint) => (
          <div className="dashboard-card" key={complaint._id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <strong>{complaint.subject}</strong>
                <div style={{ marginTop: 5, fontSize: 12, color: '#64748b' }}>
                  {complaint.campId?.name || 'Camp'} · {CATEGORY_LABELS[complaint.category] || complaint.category} · {new Date(complaint.createdAt).toLocaleString()}
                </div>
              </div>
              <StatusBadge value={complaint.status} />
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 13, whiteSpace: 'pre-wrap' }}>{complaint.details}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
