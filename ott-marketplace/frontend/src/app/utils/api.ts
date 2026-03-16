import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Always attach the latest token from persisted storage before every request.
// This covers the race where Zustand rehydrates after the first API call fires.
api.interceptors.request.use((config) => {
  if (!config.headers['Authorization']) {
    try {
      const stored = localStorage.getItem('ott-auth');
      if (stored) {
        const parsed = JSON.parse(stored);
        const token = parsed?.state?.token;
        if (token) config.headers['Authorization'] = `Bearer ${token}`;
      }
    } catch { /* ignore parse errors */ }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Clear auth on 401
      localStorage.removeItem('ott-auth');
      delete api.defaults.headers.common['Authorization'];
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
