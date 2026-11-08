import React from 'react';
import DashboardLayout from '../components/DashboardLayout';

export default function ManagerDashboard({ user, onLogout }) {
  return (
    <DashboardLayout
      user={user}
      onLogout={onLogout}
      portalTitle="Camp Manager Portal"
      title={`Welcome back, ${user.fullName}`}
      subtitle="Camp coordination, shelter allocation, population registry, and service delivery management."
    >
      <div className="dashboard-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10, background: '#fef3c7',
            display: 'grid', placeItems: 'center', fontSize: '20px', color: '#92400e'
          }}>
            ⛺
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Camp Manager Workspace</h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>Account: {user.email}</p>
          </div>
        </div>

        <div style={{
          padding: 24, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16
        }}>
          <div style={{ padding: 16, background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Status</span>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#16a34a', marginTop: 4 }}>Account Active</div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>Verified Camp Manager permissions granted.</p>
          </div>

          <div style={{ padding: 16, background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Assigned Camps</span>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginTop: 4 }}>0 Sites</div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>Camp management modules will appear once camps are linked.</p>
          </div>

          <div style={{ padding: 16, background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Service Requests</span>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginTop: 4 }}>0 Pending</div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>Displaced population requests and resource allocations.</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
