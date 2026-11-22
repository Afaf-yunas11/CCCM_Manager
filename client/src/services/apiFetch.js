const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('cccm-token');
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('cccm-token');
      localStorage.removeItem('cccm-user');
      window.dispatchEvent(new Event('cccm-session-expired'));
    }
    const error = new Error(data.message || data.error || 'Request failed');
    error.status = res.status;
    throw error;
  }
  return data;
}
