import React from 'react';
import DashboardLayout from '../components/DashboardLayout';

export default function ResidentDashboard({ user, onLogout }) {
  return (
    <DashboardLayout
      user={user}
      onLogout={onLogout}
      portalTitle="Community Member Portal"
      title={`Welcome, ${user.fullName}`}
      subtitle="Access camp assistance, submit service requests, and stay informed on community distribution schedules."
    >
      <div className="dashboard-card">
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Community Member Workspace</h3>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>Account: {user.email}</p>
        </div>

        <div style={{
          padding: 24, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16
        }}>
          <div style={{ padding: 16, background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Status</span>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#16a34a', marginTop: 4 }}>Account Active</div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>Verified profile ready to receive assistance.</p>
          </div>

          <div style={{ padding: 16, background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Assistance Requests</span>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginTop: 4 }}>0 Active</div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>Request food, shelter repair, healthcare or WASH aid.</p>
          </div>

          <div style={{ padding: 16, background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Camp Announcements</span>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginTop: 4 }}>None</div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>Updates from Camp Managers will be shown here.</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
