import React, { useEffect, useState } from 'react';
import { managerApi } from '../../services/managerApi';
import { StatusBadge, inputStyle, Notice } from './ui';

const NAMES = { water: 'Water', food: 'Food', medicine: 'Medicine', shelter: 'Shelter' };
const FACILITY_NAMES = { ...NAMES, sanitation: 'Sanitation', other: 'Other' };

function CampProviders({ camp, onOfferStatusChange }) {
  const offers = camp.supportOffers || [];

  return (
    <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 16, paddingTop: 14 }}>
      <strong style={{ fontSize: 14 }}>NGO facilities and providers</strong>
      {!offers.length && <p style={{ fontSize: 13, color: '#64748b' }}>No NGOs have offered facilities to this camp yet.</p>}
      {offers.map((offer) => (
        <div key={offer._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid #e2e8f0', padding: '9px 0' }}>
          <div>
            <strong style={{ fontSize: 13 }}>{offer.ngoName}</strong>
            <span style={{ fontSize: 13, color: '#64748b' }}> · {FACILITY_NAMES[offer.resource] || offer.resource}</span>
            {offer.message && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{offer.message}</div>}
          </div>
          <select
            aria-label={`Offer status for ${offer.ngoName}`}
            style={{ ...inputStyle, width: 140 }}
            value={offer.status}
            onChange={(event) => onOfferStatusChange(camp._id, offer._id, event.target.value)}
          >
            <option value="offered">Pending review</option>
            <option value="accepted">Accepted</option>
            <option value="declined">Declined</option>
          </select>
        </div>
      ))}
    </div>
  );
}

export default function CampsTab({ refreshKey }) {
  const [camps, setCamps] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { managerApi.camps().then(setCamps).catch((e) => setError(e.message)); }, [refreshKey]);

  async function update(id, body) {
    setError('');
    try {
      const updated = await managerApi.updateCamp(id, body);
      setCamps((list) => list.map((c) => (
        c._id === id ? { ...updated, supportOffers: c.supportOffers || [] } : c
      )));
    } catch (e) { setError(e.message); }
  }

  async function updateOffer(campId, offerId, status) {
    setError('');
    try {
      const updated = await managerApi.updateCampOffer(campId, offerId, status);
      setCamps((list) => list.map((camp) => (
        camp._id === campId
          ? { ...camp, supportOffers: (camp.supportOffers || []).map((offer) => (offer._id === offerId ? updated : offer)) }
          : camp
      )));
    } catch (e) { setError(e.message); }
  }

  if (!camps) return error ? <Notice error={error} /> : <p>Loading…</p>;
  if (!camps.length) return <div className="dashboard-card"><p style={{ margin: 0 }}>No camps yet. Assess a site and create a camp from the result.</p></div>;

  return (
    <div>
      <Notice error={error} />
      {camps.map((c) => (
        <div key={c._id} className="dashboard-card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div>
              <strong style={{ fontSize: 16 }}>{c.name}</strong>
              <div style={{ fontSize: 12, color: '#64748b' }}>{c.location?.name} · status: {c.status}{c.plannedClosureDate ? ` · planned closure ${new Date(c.plannedClosureDate).toLocaleDateString()}` : ''}</div>
            </div>
            <div style={{ fontSize: 13 }}>Capacity {c.capacity.toLocaleString()}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0', fontSize: 13 }}>
            Current population
            <input style={{ ...inputStyle, width: 110 }} type="number" min="0" defaultValue={c.population}
              onBlur={(e) => Number(e.target.value) !== c.population && update(c._id, { population: Number(e.target.value) })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {c.resources.map((r) => (
              <div key={r.name} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>{NAMES[r.name]} <StatusBadge value={r.level} /></div>
                <select style={inputStyle} value={r.level} onChange={(e) => update(c._id, { resources: { [r.name]: e.target.value } })}>
                  <option value="sufficient">Sufficient</option><option value="low">Low</option><option value="critical">Critically low</option>
                </select>
              </div>
            ))}
          </div>
          <CampProviders camp={c} onOfferStatusChange={updateOffer} />
        </div>
      ))}
    </div>
  );
}
