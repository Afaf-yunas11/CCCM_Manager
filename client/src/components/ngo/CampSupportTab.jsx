import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../services/apiFetch';
import { StatusBadge } from '../manager/ui';

const FACILITIES = [
  ['water', 'Water'],
  ['food', 'Food'],
  ['medicine', 'Medicine'],
  ['shelter', 'Shelter'],
  ['sanitation', 'Sanitation'],
  ['other', 'Other'],
];

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  fontSize: 13,
  boxSizing: 'border-box',
};

function CampOfferForm({ camp, onSaved }) {
  const [resource, setResource] = useState('water');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const existing = camp.myOffers?.find((offer) => offer.resource === resource);

  useEffect(() => {
    setMessage(camp.myOffers?.find((offer) => offer.resource === resource)?.message || '');
  }, [camp.myOffers, resource]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const offer = await apiFetch(`/ngo/camps/${camp._id}/offers`, {
        method: 'POST',
        body: JSON.stringify({ resource, message }),
      });
      onSaved(offer);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ borderTop: '1px solid #e2e8f0', marginTop: 14, paddingTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 14 }}>Your facility offers</strong>
        {existing && <StatusBadge value={existing.status} />}
      </div>
      <label style={{ display: 'block', marginTop: 10, fontSize: 12 }}>
        Facility or service
        <select value={resource} onChange={(event) => setResource(event.target.value)} style={{ ...inputStyle, marginTop: 4 }}>
          {FACILITIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label style={{ display: 'block', marginTop: 10, fontSize: 12 }}>
        What will your organization provide?
        <textarea
          rows="3"
          maxLength="1000"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Describe the service, facility, or support you can provide."
          style={{ ...inputStyle, marginTop: 4, resize: 'vertical' }}
        />
      </label>
      {error && <p role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>{error}</p>}
      {!camp.canOffer && <p style={{ color: '#92400e', fontSize: 12 }}>Your NGO must be approved before submitting facility offers.</p>}
      <button type="submit" disabled={busy || !camp.canOffer} style={{ marginTop: 10 }}>
        {busy ? 'Submitting…' : existing ? 'Update offer' : 'Offer support to this camp'}
      </button>
    </form>
  );
}

export default function CampSupportTab() {
  const [camps, setCamps] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/ngo/camps')
      .then(setCamps)
      .catch((loadError) => setError(loadError.message));
  }, []);

  function saveOffer(campId, offer) {
    setCamps((current) => current.map((camp) => {
      if (camp._id !== campId) return camp;
      const offers = (camp.myOffers || []).filter((item) => item.resource !== offer.resource);
      return { ...camp, myOffers: [...offers, offer] };
    }));
  }

  if (!camps) return error ? <p role="alert">{error}</p> : <p>Loading camps…</p>;

  return (
    <div>
      <p style={{ color: '#64748b', fontSize: 13, marginTop: 0 }}>
        Tell camp managers which facilities and services your organization can provide. The manager reviews each offer.
      </p>
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
      {!camps.length && <div className="dashboard-card">No active camps are accepting support offers.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {camps.map((camp) => (
          <div className="dashboard-card" key={camp._id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <strong>{camp.name}</strong>
              <StatusBadge value={camp.status} />
            </div>
            <p style={{ color: '#64748b', fontSize: 12, margin: '6px 0' }}>{camp.location?.name || 'Location not provided'}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {(camp.resources || []).map((resource) => (
                <span key={resource.name} style={{ fontSize: 12, color: '#475569' }}>
                  {resource.name}: <StatusBadge value={resource.level} />
                </span>
              ))}
            </div>
            <CampOfferForm camp={camp} onSaved={(offer) => saveOffer(camp._id, offer)} />
          </div>
        ))}
      </div>
    </div>
  );
}
