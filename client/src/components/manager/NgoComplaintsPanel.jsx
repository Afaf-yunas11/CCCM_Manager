import React, { useEffect, useState } from 'react';
import { managerApi } from '../../services/managerApi';
import { btnStyle, inputStyle, Notice, StatusBadge } from './ui';

const CATEGORIES = [
  ['food', 'Food'],
  ['water', 'Water'],
  ['medicine', 'Medicine'],
  ['shelter', 'Shelter'],
  ['sanitation', 'Sanitation'],
  ['other', 'Other'],
];

const CATEGORY_LABELS = Object.fromEntries(CATEGORIES);
const STATUS_OPTIONS = [
  ['pending', 'Pending'],
  ['in_progress', 'In progress'],
  ['resolved', 'Resolved'],
];

function getAcceptedProviders(camp) {
  const providers = new Map();
  for (const offer of camp?.supportOffers || []) {
    if (offer.status !== 'accepted' || !offer.ngoId) continue;
    const id = String(offer.ngoId);
    if (!providers.has(id)) providers.set(id, { id, name: offer.ngoName, resources: [] });
    const provider = providers.get(id);
    if (!provider.resources.includes(offer.resource)) provider.resources.push(offer.resource);
  }
  return [...providers.values()];
}

export default function NgoComplaintsPanel() {
  const [camps, setCamps] = useState(null);
  const [complaints, setComplaints] = useState(null);
  const [campId, setCampId] = useState('');
  const [ngoId, setNgoId] = useState('');
  const [category, setCategory] = useState('food');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    Promise.all([managerApi.camps(), managerApi.ngoComplaints()])
      .then(([campRows, complaintRows]) => {
        setCamps(campRows);
        setComplaints(complaintRows);
        const firstCamp = campRows.find((camp) => getAcceptedProviders(camp).length);
        setCampId(firstCamp?._id || '');
        setNgoId(getAcceptedProviders(firstCamp)[0]?.id || '');
      })
      .catch((loadError) => setError(loadError.message));
  }, []);

  const eligibleCamps = (camps || []).filter((camp) => camp.status !== 'closed' && getAcceptedProviders(camp).length);
  const selectedCamp = eligibleCamps.find((camp) => camp._id === campId);
  const providers = getAcceptedProviders(selectedCamp);

  function chooseCamp(id) {
    const camp = eligibleCamps.find((item) => item._id === id);
    setCampId(id);
    setNgoId(getAcceptedProviders(camp)[0]?.id || '');
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const complaint = await managerApi.createNgoComplaint({ campId, ngoId, category, subject, details });
      setComplaints((current) => [complaint, ...current]);
      setSubject('');
      setDetails('');
      setNotice('Complaint sent to the selected NGO.');
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(complaint, status) {
    setError('');
    try {
      const updated = await managerApi.updateNgoComplaint(complaint._id, status);
      setComplaints((current) => current.map((item) => item._id === complaint._id ? updated : item));
    } catch (updateError) {
      setError(updateError.message);
    }
  }

  return (
    <section className="dashboard-card" style={{ marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>Complaints to camp NGOs</h3>
      <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: 13 }}>
        Send a complaint to one accepted provider, such as a missed food delivery. Only the selected NGO and this camp's manager can see it.
      </p>
      <Notice error={error} ok={notice} />
      {camps === null && <p>Loading camp providers…</p>}
      {camps?.length === 0 && <p style={{ color: '#64748b', fontSize: 13 }}>There are no camps available for NGO complaints.</p>}
      {camps?.length > 0 && !eligibleCamps.length && (
        <p style={{ color: '#64748b', fontSize: 13 }}>Accept an NGO facility offer for a camp before creating a complaint.</p>
      )}
      {eligibleCamps.length > 0 && (
        <form onSubmit={submit} style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 16, marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <label style={{ fontSize: 12 }}>
              Camp
              <select value={campId} onChange={(event) => chooseCamp(event.target.value)} style={{ ...inputStyle, marginTop: 4 }}>
                {eligibleCamps.map((camp) => <option key={camp._id} value={camp._id}>{camp.name}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12 }}>
              NGO provider
              <select required value={ngoId} onChange={(event) => setNgoId(event.target.value)} style={{ ...inputStyle, marginTop: 4 }}>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name} ({provider.resources.join(', ')})
                  </option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 12 }}>
              Service
              <select value={category} onChange={(event) => setCategory(event.target.value)} style={{ ...inputStyle, marginTop: 4 }}>
                {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          <label style={{ display: 'block', marginTop: 12, fontSize: 12 }}>
            Subject
            <input
              required
              maxLength="150"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="For example: Food has not been delivered for two days"
              style={{ ...inputStyle, marginTop: 4 }}
            />
          </label>
          <label style={{ display: 'block', marginTop: 12, fontSize: 12 }}>
            Details
            <textarea
              required
              maxLength="2000"
              rows="3"
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              style={{ ...inputStyle, marginTop: 4, resize: 'vertical' }}
            />
          </label>
          <button type="submit" style={{ ...btnStyle(), marginTop: 10 }} disabled={busy || !ngoId}>
            {busy ? 'Sending…' : 'Send complaint to NGO'}
          </button>
        </form>
      )}
      {complaints === null && !error && <p>Loading complaints…</p>}
      {complaints?.length === 0 && <p style={{ color: '#64748b', fontSize: 13 }}>No complaints have been sent to camp NGOs.</p>}
      {complaints?.map((complaint) => (
        <div key={complaint._id} style={{ borderTop: '1px solid #e2e8f0', padding: '12px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <strong>{complaint.subject}</strong>
              <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>
                {complaint.campId?.name || 'Camp'} · {complaint.ngoId?.organizationName || 'NGO'} · {CATEGORY_LABELS[complaint.category] || complaint.category} · {new Date(complaint.createdAt).toLocaleString()}
              </div>
            </div>
            <div style={{ minWidth: 150 }}>
              <StatusBadge value={complaint.status} />
              <select
                aria-label={`Complaint status for ${complaint.subject}`}
                value={complaint.status}
                onChange={(event) => updateStatus(complaint, event.target.value)}
                style={{ ...inputStyle, marginTop: 8 }}
              >
                {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 13, whiteSpace: 'pre-wrap' }}>{complaint.details}</p>
        </div>
      ))}
    </section>
  );
}
