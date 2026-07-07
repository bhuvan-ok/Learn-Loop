import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Without this, a token that expires mid-session (not just on initial load)
// leaves the app stuck: AuthContext still thinks the user is logged in, but
// every request 401s and every page just shows a generic load error, with no
// way out except manually logging out and back in. Clearing the session here
// and notifying AuthContext (which can't import this module without a cycle)
// via a DOM event lets every page recover by simply prompting a fresh login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem('token')) {
      localStorage.removeItem('token');
      window.dispatchEvent(new Event('auth:logout'));
    }
    return Promise.reject(error);
  }
);

export default api;
