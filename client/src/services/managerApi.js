import { apiFetch } from './apiFetch';

const call = (path, options = {}) => apiFetch(`/manager${path}`, options);
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
  updateCampOffer: (campId, offerId, status) => call(`/camps/${campId}/offers/${offerId}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  requests: () => call('/requests'),
  updateRequest: (id, status) => call(`/requests/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  ngoComplaints: () => call('/ngo-complaints'),
  createNgoComplaint: (body) => post('/ngo-complaints', body),
  updateNgoComplaint: (id, status) => call(`/ngo-complaints/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};
