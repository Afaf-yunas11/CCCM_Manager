import React, { useEffect, useState } from 'react';
import { managerApi } from '../../services/managerApi';
import { StatusBadge, AssessmentResult, Notice, Field, inputStyle, btnStyle, grid } from './ui';

function CampAction({ assessment, existingCamp, onCreated }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(assessment.location?.name?.split(',')[0] || '');
  const [capacity, setCapacity] = useState(String(assessment.input?.population || ''));
  const [plannedClosureDate, setPlannedClosureDate] = useState('');
  const [acceptedRisk, setAcceptedRisk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const needsWarning = assessment.result === 'not_suitable';

  async function createCamp(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const camp = await managerApi.createCamp({
        assessmentId: assessment._id,
        name,
        capacity: Number(capacity),
        plannedClosureDate: plannedClosureDate || undefined,
        acceptUnsuitableRisk: needsWarning ? acceptedRisk : undefined,
      });
      onCreated(camp);
    } catch (createError) {
      setError(createError.message);
    } finally {
      setBusy(false);
    }
  }

  if (existingCamp) {
    return <p role="status" style={{ margin: '16px 0 0', color: '#166534', fontSize: 13 }}>A camp has already been created from this assessment.</p>;
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
      {!open ? (
        <button type="button" style={btnStyle()} onClick={() => setOpen(true)}>Create camp from this assessment</button>
      ) : (
        <form onSubmit={createCamp}>
          <h4 style={{ margin: '0 0 12px', fontSize: 14 }}>Create camp from this assessment</h4>
          {needsWarning && (
            <p role="alert" style={{ color: '#991b1b', fontSize: 13, margin: '0 0 12px' }}>
              This assessment marks the site as not suitable. Creating a camp here may put residents at risk.
            </p>
          )}
          <div style={grid(200)}>
            <Field label="Camp name">
              <input style={inputStyle} required value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="Capacity">
              <input style={inputStyle} type="number" min="1" required value={capacity} onChange={(event) => setCapacity(event.target.value)} />
            </Field>
            <Field label="Planned closure date">
              <input style={inputStyle} type="date" value={plannedClosureDate} onChange={(event) => setPlannedClosureDate(event.target.value)} />
            </Field>
          </div>
          {needsWarning && (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12, fontSize: 13 }}>
              <input type="checkbox" checked={acceptedRisk} onChange={(event) => setAcceptedRisk(event.target.checked)} />
              I understand the site was assessed as not suitable and want to proceed anyway.
            </label>
          )}
          <Notice error={error} />
          <button type="submit" style={btnStyle()} disabled={busy || (needsWarning && !acceptedRisk)}>
            {busy ? 'Creating…' : needsWarning ? 'Confirm and create camp' : 'Create camp'}
          </button>
          <button type="button" style={{ ...btnStyle(false), marginLeft: 8 }} disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
        </form>
      )}
    </div>
  );
}

export default function AssessmentsTab() {
  const [items, setItems] = useState(null);
  const [camps, setCamps] = useState([]);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([managerApi.assessments(), managerApi.camps()])
      .then(([assessments, existingCamps]) => {
        setItems(assessments);
        setCamps(existingCamps);
      })
      .catch((e) => setError(e.message));
  }, []);

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
          {open === a._id && (
            <>
              <AssessmentResult a={a} showRequirements={false} showSiteData={false} />
              <CampAction
                assessment={a}
                existingCamp={camps.find((camp) => String(camp.siteAssessmentId) === String(a._id))}
                onCreated={(camp) => setCamps((current) => [...current, camp])}
              />
            </>
          )}
        </div>
      ))}
    </div>
  );
}
