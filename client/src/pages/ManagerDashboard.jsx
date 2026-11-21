import React, { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import CalculatorTab from '../components/manager/CalculatorTab';
import SiteSelectionTab from '../components/manager/SiteSelectionTab';
import AssessmentsTab from '../components/manager/AssessmentsTab';
import CampsTab from '../components/manager/CampsTab';

const TABS = [
  { key: 'site', label: 'Site selection' },
  { key: 'calculator', label: 'Calculator' },
  { key: 'assessments', label: 'Assessments' },
  { key: 'camps', label: 'My camps' },
];

export default function ManagerDashboard({ user, onLogout }) {
  const [tab, setTab] = useState('site');
  const [campsVersion, setCampsVersion] = useState(0);

  return (
    <DashboardLayout
      user={user}
      onLogout={onLogout}
      portalTitle="Camp Manager Portal"
      title={`Welcome back, ${user.fullName}`}
      subtitle="Assess sites, calculate camp needs, and manage your camps."
    >
      <div className="dashboard-tab-bar">
        {TABS.map((t) => (
          <button key={t.key} type="button" className={`dashboard-tab-item ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>
      {/* Site tab stays mounted so the map and form keep their state when switching tabs */}
      <div style={{ display: tab === 'site' ? 'block' : 'none' }}>
        <SiteSelectionTab onCampCreated={() => setCampsVersion((v) => v + 1)} />
      </div>
      {tab === 'calculator' && <CalculatorTab />}
      {tab === 'assessments' && <AssessmentsTab />}
      {tab === 'camps' && <CampsTab refreshKey={campsVersion} />}
    </DashboardLayout>
  );
}
