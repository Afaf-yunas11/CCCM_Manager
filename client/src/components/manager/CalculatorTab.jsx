import React, { useEffect, useState } from 'react';
import { managerApi } from '../../services/managerApi';
import { Field, inputStyle, RequirementsGrid, Notice } from './ui';

export default function CalculatorTab() {
  const [population, setPopulation] = useState('1000');
  const [familySize, setFamilySize] = useState('6');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        setError('');
        setResult(await managerApi.calculator(Number(population), Number(familySize) || undefined));
      } catch (e) { setResult(null); setError(e.message); }
    }, 300);
    return () => clearTimeout(t);
  }, [population, familySize]);

  return (
    <div className="dashboard-card">
      <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Camp requirements calculator</h3>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>Enter the expected population to see toilets, water, land, shelter and other needs.</p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 200 }}><Field label="Population"><input style={inputStyle} type="number" min="1" value={population} onChange={(e) => setPopulation(e.target.value)} /></Field></div>
        <div style={{ width: 200 }}><Field label="Average family size"><input style={inputStyle} type="number" min="1" value={familySize} onChange={(e) => setFamilySize(e.target.value)} /></Field></div>
      </div>
      <Notice error={error} />
      {result && <RequirementsGrid r={result} />}
    </div>
  );
}
