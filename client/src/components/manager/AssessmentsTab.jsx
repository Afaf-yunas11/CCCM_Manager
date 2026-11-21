import React, { useEffect, useState } from 'react';
import { managerApi } from '../../services/managerApi';
import { StatusBadge, AssessmentResult, Notice } from './ui';

export default function AssessmentsTab() {
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { managerApi.assessments().then(setItems).catch((e) => setError(e.message)); }, []);

  if (error) return <Notice error={error} />;
  if (!items) return <p>Loading…</p>;
  if (!items.length) return <div className="dashboard-card"><p style={{ margin: 0 }}>No assessments yet. Use the Site selection tab to assess your first site.</p></div>;

  return (
    <div>
      {items.map((a) => (
        <div key={a._id} className="dashboard-card" style={{ marginBottom: 12 }}>
          <button type="button" onClick={() => setOpen(open === a._id ? null : a._id)}
            style={{ all: 'unset', cursor: 'pointer', display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span><strong>{a.location?.name || 'Pinned location'}</strong><br /><span style={{ fontSize: 12, color: '#64748b' }}>{new Date(a.createdAt).toLocaleString()} · population {a.input?.population?.toLocaleString()}</span></span>
            <StatusBadge value={a.result} />
          </button>
          {open === a._id && <AssessmentResult a={a} />}
        </div>
      ))}
    </div>
  );
}
