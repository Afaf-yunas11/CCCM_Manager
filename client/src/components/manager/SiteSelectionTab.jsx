import React, { useEffect, useRef, useState } from 'react';
import { managerApi } from '../../services/managerApi';
import MapPicker from './MapPicker';
import { polygonAreaM2 } from '../../utils/geo';
import { Field, inputStyle, btnStyle, grid, ApiDataCards, AssessmentResult, Notice } from './ui';

const YES_NO = [['true', 'Yes'], ['false', 'No']];
const initial = { population: '', availableAreaM2: '', slopePercent: '', allSeasonRoad: 'true', waterSourceNearby: 'true', floodRiskManager: 'low', landslideRisk: 'false', malariaProne: 'true', titleClear: 'true' };

function YesNo({ value, onChange }) {
  return <select style={inputStyle} value={value} onChange={(e) => onChange(e.target.value)}>{YES_NO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>;
}

export default function SiteSelectionTab({ onCampCreated }) {
  const [location, setLocation] = useState(null);
  const [polygon, setPolygon] = useState([]);
  const [preview, setPreview] = useState(null);
  const [checking, setChecking] = useState(false);
  const [suggested, setSuggested] = useState({});
  const [form, setForm] = useState(initial);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [camp, setCamp] = useState({ open: false, name: '', capacity: '', plannedClosureDate: '' });
  const [ok, setOk] = useState('');
  const fetchId = useRef(0);
  const set = (k) => (v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSuggested((s) => ({ ...s, [k]: false })); // the manager has now decided this one
  };

  // When the pin moves: fetch map data automatically (debounced) and suggest water/road answers.
  useEffect(() => {
    setPreview(null);
    setResult(null);
    if (!location) return undefined;
    const id = ++fetchId.current;
    setChecking(true);
    const t = setTimeout(async () => {
      try {
        const d = await managerApi.siteData(location.lat, location.lng);
        if (id !== fetchId.current) return;
        setPreview(d);
        const s = {};
        if (d.nearestWaterPointM != null) s.waterSourceNearby = true;
        if (d.mainRoadDistanceM != null && d.mainRoadDistanceM <= 300) s.allSeasonRoad = true;
        setSuggested(s);
        setForm((f) => ({
          ...f,
          waterSourceNearby: s.waterSourceNearby && f.waterSourceNearby === '' ? 'true' : f.waterSourceNearby,
          allSeasonRoad: s.allSeasonRoad && f.allSeasonRoad === '' ? 'true' : f.allSeasonRoad,
        }));
      } catch (e) {
        if (id === fetchId.current) setError(e.message);
      } finally {
        if (id === fetchId.current) setChecking(false);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [location?.lat, location?.lng]);

  // A drawn boundary fills the area. The manager can still type over it.
  useEffect(() => {
    if (polygon.length >= 3) setForm((f) => ({ ...f, availableAreaM2: String(polygonAreaM2(polygon)) }));
  }, [polygon]);

  async function runAssessment(e) {
    e.preventDefault();
    if (!location) return setError('Pick a location on the map first.');
    setBusy('assess'); setError(''); setOk('');
    try {
      const a = await managerApi.createAssessment({
        location,
        polygon: polygon.length >= 3 ? polygon : undefined,
        input: form,
      });
      setResult(a);
      setCamp({ open: false, name: location.name?.split(',')[0] || '', capacity: String(form.population), plannedClosureDate: '' });
    } catch (err) { setError(err.message); } finally { setBusy(''); }
  }

  async function createCamp(e) {
    e.preventDefault();
    setBusy('camp'); setError('');
    try {
      await managerApi.createCamp({ assessmentId: result._id, name: camp.name, capacity: Number(camp.capacity), plannedClosureDate: camp.plannedClosureDate || undefined });
      setOk('Camp created. Open the My camps tab to manage it.');
      setCamp((c) => ({ ...c, open: false }));
      onCampCreated?.();
    } catch (err) { setError(err.message); } finally { setBusy(''); }
  }

  const sugg = (k) => (suggested[k] ? 'Suggested from map data. Please confirm.' : undefined);

  return (
    <form onSubmit={runAssessment}>
      <div className="dashboard-card">
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>1. Choose the site</h3>
        <MapPicker value={location} onChange={setLocation} polygon={polygon} onPolygonChange={setPolygon} />
        {location && (
          <div style={{ marginTop: 12 }}>
            {checking && <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Checking flood, river, water, road and hospital data…</p>}
            {preview && !result && <ApiDataCards data={preview} />}
          </div>
        )}
      </div>

      <div className="dashboard-card" style={{ marginTop: 16 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>2. Site details</h3>
        <div style={grid(220)}>
          <Field label="Expected population"><input style={inputStyle} type="number" min="1" required value={form.population} onChange={(e) => set('population')(e.target.value)} /></Field>
          <Field label="Available area (m²)" hint={polygon.length >= 3 ? 'From the drawn boundary. You can edit it.' : 'Draw the boundary on the map to fill this, or type it.'}>
            <input style={inputStyle} type="number" min="1" required value={form.availableAreaM2} onChange={(e) => set('availableAreaM2')(e.target.value)} />
          </Field>
          <Field label="Slope (%)" hint="Leave empty to use the map estimate"><input style={inputStyle} type="number" step="0.1" min="0" value={form.slopePercent} onChange={(e) => set('slopePercent')(e.target.value)} /></Field>
          <Field label="All-season road access" hint={sugg('allSeasonRoad')}><YesNo value={form.allSeasonRoad} onChange={set('allSeasonRoad')} /></Field>
          <Field label="Water source nearby" hint={sugg('waterSourceNearby')}><YesNo value={form.waterSourceNearby} onChange={set('waterSourceNearby')} /></Field>
          <Field label="Flood risk (your judgement)">
            <select style={inputStyle} value={form.floodRiskManager} onChange={(e) => set('floodRiskManager')(e.target.value)}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select>
          </Field>
          <Field label="Landslide or erosion risk"><YesNo value={form.landslideRisk} onChange={set('landslideRisk')} /></Field>
          <Field label="Malaria or water-borne disease area"><YesNo value={form.malariaProne} onChange={set('malariaProne')} /></Field>
          <Field label="Land ownership title clear"><YesNo value={form.titleClear} onChange={set('titleClear')} /></Field>
        </div>
        <p style={{ fontSize: 12, color: '#64748b' }}>Selected site risks appear as warning lines in the assessment result.</p>
        <Notice error={error} ok={ok} />
        <button type="submit" style={btnStyle()} disabled={busy === 'assess'}>{busy === 'assess' ? 'Assessing…' : '3. Run site assessment'}</button>
      </div>

      {result && (
        <AssessmentResult a={result} showRequirements={false}>
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
