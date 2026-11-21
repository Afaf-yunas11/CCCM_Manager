import React, { useEffect, useState } from 'react';
import { managerApi } from '../../services/managerApi';
import MapPicker from './MapPicker';
import { Field, inputStyle, btnStyle, grid, ApiDataCards, AssessmentResult, Notice } from './ui';

const YES_NO = [['', 'Not sure'], ['true', 'Yes'], ['false', 'No']];
const initial = { population: '', availableAreaM2: '', slopePercent: '', allSeasonRoad: 'true', waterSourceNearby: 'true', floodRiskManager: 'low', landslideRisk: 'false', malariaProne: 'false', titleClear: '' };

function YesNo({ value, onChange }) {
  return <select style={inputStyle} value={value} onChange={(e) => onChange(e.target.value)}>{YES_NO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>;
}

export default function SiteSelectionTab({ onCampCreated }) {
  const [disasters, setDisasters] = useState([]);
  const [disasterId, setDisasterId] = useState('');
  const [location, setLocation] = useState(null);
  const [preview, setPreview] = useState(null);
  const [form, setForm] = useState(initial);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [camp, setCamp] = useState({ open: false, name: '', capacity: '', plannedClosureDate: '' });
  const [ok, setOk] = useState('');
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => { managerApi.disasters().then(setDisasters).catch(() => {}); }, []);
  useEffect(() => { setPreview(null); setResult(null); }, [location?.lat, location?.lng]);

  async function fetchData() {
    setBusy('data'); setError('');
    try { setPreview(await managerApi.siteData(location.lat, location.lng)); } catch (e) { setError(e.message); } finally { setBusy(''); }
  }

  async function runAssessment(e) {
    e.preventDefault();
    if (!location) return setError('Pick a location on the map first.');
    setBusy('assess'); setError(''); setOk('');
    try {
      const a = await managerApi.createAssessment({ disasterId: disasterId || undefined, location, input: form });
      setResult(a);
      setCamp({ open: false, name: location.name?.split(',')[0] || '', capacity: String(form.population), plannedClosureDate: '' });
    } catch (err) { setError(err.message); } finally { setBusy(''); }
  }

  async function createCamp(e) {
    e.preventDefault();
    setBusy('camp'); setError('');
    try {
      await managerApi.createCamp({ assessmentId: result._id, name: camp.name, capacity: Number(camp.capacity), disasterId: disasterId || undefined, plannedClosureDate: camp.plannedClosureDate || undefined });
      setOk('Camp created. Open the My camps tab to manage it.');
      setCamp((c) => ({ ...c, open: false }));
      onCampCreated?.();
    } catch (err) { setError(err.message); } finally { setBusy(''); }
  }

  return (
    <form onSubmit={runAssessment}>
      <div className="dashboard-card">
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>1. Choose the site</h3>
        <Field label="Related disaster (optional)">
          <select style={inputStyle} value={disasterId} onChange={(e) => setDisasterId(e.target.value)}>
            <option value="">None</option>
            {disasters.map((d) => <option key={d._id} value={d._id}>{d.title}</option>)}
          </select>
        </Field>
        <MapPicker value={location} onChange={setLocation} />
        {location && (
          <div style={{ marginTop: 12 }}>
            <button type="button" style={btnStyle(false)} disabled={busy === 'data'} onClick={fetchData}>{busy === 'data' ? 'Checking…' : 'Check flood, river and hospital data'}</button>
            {preview && <div style={{ marginTop: 12 }}><ApiDataCards data={preview} /></div>}
          </div>
        )}
      </div>

      <div className="dashboard-card" style={{ marginTop: 16 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>2. Site details</h3>
        <div style={grid(220)}>
          <Field label="Expected population"><input style={inputStyle} type="number" min="1" required value={form.population} onChange={(e) => set('population')(e.target.value)} /></Field>
          <Field label="Available area (m²)"><input style={inputStyle} type="number" min="1" required value={form.availableAreaM2} onChange={(e) => set('availableAreaM2')(e.target.value)} /></Field>
          <Field label="Slope (%)" hint="Leave empty to use the map estimate"><input style={inputStyle} type="number" step="0.1" min="0" value={form.slopePercent} onChange={(e) => set('slopePercent')(e.target.value)} /></Field>
          <Field label="All-season road access"><YesNo value={form.allSeasonRoad} onChange={set('allSeasonRoad')} /></Field>
          <Field label="Water source nearby"><YesNo value={form.waterSourceNearby} onChange={set('waterSourceNearby')} /></Field>
          <Field label="Flood risk (your judgement)">
            <select style={inputStyle} value={form.floodRiskManager} onChange={(e) => set('floodRiskManager')(e.target.value)}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select>
          </Field>
          <Field label="Landslide or erosion risk"><YesNo value={form.landslideRisk} onChange={set('landslideRisk')} /></Field>
          <Field label="Malaria or water-borne disease area"><YesNo value={form.malariaProne} onChange={set('malariaProne')} /></Field>
          <Field label="Land ownership title clear"><YesNo value={form.titleClear} onChange={set('titleClear')} /></Field>
        </div>
        <Notice error={error} ok={ok} />
        <button type="submit" style={btnStyle()} disabled={busy === 'assess'}>{busy === 'assess' ? 'Assessing…' : '3. Run site assessment'}</button>
      </div>

      {result && (
        <AssessmentResult a={result}>
          {result.result !== 'not_suitable' && (
            <div style={{ marginTop: 16 }}>
              {!camp.open ? (
                <button type="button" style={btnStyle()} onClick={() => setCamp((c) => ({ ...c, open: true }))}>Create camp at this site</button>
              ) : (
                <div style={{ ...grid(200), alignItems: 'end' }}>
                  <Field label="Camp name"><input style={inputStyle} value={camp.name} onChange={(e) => setCamp({ ...camp, name: e.target.value })} /></Field>
                  <Field label="Capacity"><input style={inputStyle} type="number" min="1" value={camp.capacity} onChange={(e) => setCamp({ ...camp, capacity: e.target.value })} /></Field>
                  <Field label="Planned closure date"><input style={inputStyle} type="date" value={camp.plannedClosureDate} onChange={(e) => setCamp({ ...camp, plannedClosureDate: e.target.value })} /></Field>
                  <div style={{ marginBottom: 12 }}><button type="button" style={btnStyle()} disabled={busy === 'camp'} onClick={createCamp}>{busy === 'camp' ? 'Creating…' : 'Confirm camp'}</button></div>
                </div>
              )}
            </div>
          )}
        </AssessmentResult>
      )}
    </form>
  );
}
