import React from 'react';

export const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1',
  fontSize: 13, boxSizing: 'border-box', background: '#fff', color: '#0f172a',
};
export const btnStyle = (primary = true) => ({
  padding: '9px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  border: primary ? 'none' : '1px solid #cbd5e1', background: primary ? '#2563eb' : '#fff', color: primary ? '#fff' : '#0f172a',
});
export const grid = (min = 240) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 16 });

export function Field({ label, hint, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 12, fontSize: 12, color: '#475569', fontWeight: 600 }}>
      {label}
      <div style={{ marginTop: 4, fontWeight: 400 }}>{children}</div>
      {hint && <span style={{ fontWeight: 400, color: '#94a3b8' }}>{hint}</span>}
    </label>
  );
}

const palette = {
  suitable: ['#dcfce7', '#166534', 'Suitable'],
  needs_review: ['#fef3c7', '#92400e', 'Needs review'],
  not_suitable: ['#fee2e2', '#991b1b', 'Not suitable'],
  sufficient: ['#dcfce7', '#166534', 'Sufficient'],
  low: ['#fef3c7', '#92400e', 'Low'],
  critical: ['#fee2e2', '#991b1b', 'Critically low'],
  pending: ['#fef3c7', '#92400e', 'Pending'],
  in_progress: ['#dbeafe', '#1d4ed8', 'In progress'],
  resolved: ['#dcfce7', '#166534', 'Resolved'],
  offered: ['#fef3c7', '#92400e', 'Pending review'],
  accepted: ['#dcfce7', '#166534', 'Accepted'],
  declined: ['#e2e8f0', '#334155', 'Declined'],
  active: ['#dcfce7', '#166534', 'Open'],
  closureDue: ['#fef3c7', '#92400e', 'Closure due'],
  extended: ['#dbeafe', '#1d4ed8', 'Extended'],
  closed: ['#e2e8f0', '#334155', 'Closed'],
  restricted: ['#fee2e2', '#991b1b', 'Restricted'],
};
export function StatusBadge({ value }) {
  const [bg, fg, text] = palette[value] || ['#e2e8f0', '#334155', value];
  return <span style={{ background: bg, color: fg, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{text}</span>;
}

export function Notice({ error, ok }) {
  if (!error && !ok) return null;
  return <p role={error ? 'alert' : 'status'} style={{ margin: '8px 0', fontSize: 13, color: error ? '#b91c1c' : '#166534' }}>{error || ok}</p>;
}

const fmt = (v) => (v && typeof v === 'object' ? `${v.min.toLocaleString()} to ${v.max.toLocaleString()}` : typeof v === 'number' ? v.toLocaleString() : String(v));

export function RequirementsGrid({ r }) {
  const rows = [
    ['Families', r.families], ['Land needed (m²)', r.landM2], ['Covered shelter (m²)', r.coveredShelterM2], ['Tents', r.tents],
    ['Water (litres/day)', r.waterLitresPerDay], ['Taps', r.taps], ['Hand pumps', r.handPumps], ['Hand basins', r.handBasins],
    ['Toilets', r.toilets], ['Waste pits', r.wastePits], ['Soap (kg/week)', r.soapKgPerWeek],
    ['Ambulance required', r.ambulanceRequired ? 'Yes' : 'No'], ['Watch towers', r.watchTowers],
  ];
  return (
    <div style={grid(170)}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{k}</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>{fmt(v)}</div>
        </div>
      ))}
      <div style={{ gridColumn: '1 / -1', fontSize: 12, color: '#64748b' }}>
        Based on the NDMA Guidelines for Minimum Standards of Relief in Camp (2017). Family size assumed: 6 (project placeholder).
      </div>
    </div>
  );
}

export function ApiDataCards({ data }) {
  if (!data) return null;
  const items = [
    ['Nearest river / canal', data.riverDistanceM != null ? `${data.riverDistanceM} m` : 'none found'],
    ['Nearest water point (1 km search)', data.nearestWaterPointM != null ? `${data.nearestWaterPointM} m` : 'none found'],
    ['Nearest main road (500 m search)', data.mainRoadDistanceM != null ? `${data.mainRoadDistanceM} m` : 'none found'],
    ['Nearest hospital', data.nearestHospitalKm != null ? `${data.nearestHospitalKm} km` : 'none found'],
    ['Elevation', data.elevationM != null ? `${data.elevationM} m` : 'n/a'],
    ['Slope estimate', data.slopePercentEstimate != null ? `${data.slopePercentEstimate} %` : 'n/a'],
    ['Peak river discharge (7 days)', data.floodDischarge != null ? `${data.floodDischarge} m³/s` : 'n/a'],
  ];
  return (
    <div>
      <div style={grid(150)}>
        {items.map(([k, v]) => (
          <div key={k} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, color: '#1e40af', fontWeight: 700 }}>{k}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{v}</div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12, color: '#64748b', margin: '8px 0 0' }}>Indicative values from OpenStreetMap and Open-Meteo. Confirm on site.</p>
      {(data.notes || []).map((n) => <p key={n} style={{ fontSize: 12, color: '#92400e', margin: '2px 0' }}>{n}</p>)}
    </div>
  );
}

export function AssessmentResult({
  a,
  children,
  showRequirements = true,
  showSiteData = true,
  showReport = true,
}) {
  return (
    <div className="dashboard-card" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>Site result</h3>
        <StatusBadge value={a.result} />
        <span style={{ fontSize: 12, color: '#64748b' }}>{a.location?.name || `${a.location?.lat?.toFixed(4)}, ${a.location?.lng?.toFixed(4)}`}</span>
      </div>
      {a.fails?.map((f) => <p key={f} style={{ margin: '4px 0', fontSize: 13, color: '#991b1b' }}>✗ {f}</p>)}
      {a.warns?.map((w) => <p key={w} style={{ margin: '4px 0', fontSize: 13, color: '#92400e' }}>! {w}</p>)}
      {!a.fails?.length && !a.warns?.length && <p style={{ fontSize: 13, color: '#166534' }}>All checks passed.</p>}
      {showRequirements && (
        <>
          <h4 style={{ margin: '16px 0 8px', fontSize: 14 }}>Resources needed</h4>
          <RequirementsGrid r={a.requirements} />
        </>
      )}
      {showSiteData && (
        <>
          <h4 style={{ margin: '16px 0 8px', fontSize: 14 }}>Site data</h4>
          <ApiDataCards data={a.apiData} />
        </>
      )}
      {showReport && a.llmReport && (
        <>
          <h4 style={{ margin: '16px 0 8px', fontSize: 14 }}>Report</h4>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>{a.llmReport}</div>
        </>
      )}
      {children}
    </div>
  );
}
