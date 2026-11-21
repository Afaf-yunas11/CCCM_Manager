const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function call(path, options = {}) {
  const token = localStorage.getItem('cccm-token');
  const res = await fetch(`${API_URL}/manager${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || 'Request failed');
  return data;
}
const post = (path, body) => call(path, { method: 'POST', body: JSON.stringify(body) });

export const managerApi = {
  disasters: () => call('/disasters'),
  calculator: (population, familySize) => post('/calculator', { population, familySize }),
  siteData: (lat, lng) => post('/site-data', { lat, lng }),
  createAssessment: (body) => post('/assessments', body),
  assessments: () => call('/assessments'),
  createCamp: (body) => post('/camps', body),
  camps: () => call('/camps'),
  updateCamp: (id, body) => call(`/camps/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
};
