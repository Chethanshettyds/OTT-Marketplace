import axios from 'axios';

// Use VITE_API_URL for local dev (e.g. http://localhost:5000).
// In production on Netlify, VITE_API_URL should NOT be set — requests go to /api
// which netlify.toml proxies to the Render backend.
const apiUrl = import.meta.env.VITE_API_URL;
const baseURL = apiUrl ? `${apiUrl}/api` : '/api';

const api = axios.create({
  baseURL,
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
