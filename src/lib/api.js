const rawApiUrl = import.meta.env.VITE_API_URL;
const API_URL = rawApiUrl === '' ? '' : (rawApiUrl || 'http://localhost:4000');
const TOKEN_KEY = 'life-rpg-token';

let token = localStorage.getItem(TOKEN_KEY) || '';
let onAuthExpired = null;

async function request(path, options = {}) {
  const url = `${API_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token && !['/', '/api/health', '/api/auth-status', '/api/login'].includes(path)) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(url, {
    headers,
    ...options,
  });

  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    token = '';
    if (onAuthExpired) onAuthExpired();
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

export const api = {
  setToken(t) {
    token = t || '';
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  },
  getToken() {
    return token;
  },

  onAuthExpired(callback) {
    onAuthExpired = callback;
    return () => {
      if (onAuthExpired === callback) {
        onAuthExpired = null;
      }
    };
  },
  authStatus: () => request('/api/auth-status'),
  login: (password) => request('/api/login', { method: 'POST', body: JSON.stringify({ password }) }),
  getConfig: () => request('/api/config'),
  getEntries: () => request('/api/entries'),
  saveEntry: (payload) => request('/api/entries', { method: 'POST', body: JSON.stringify(payload) }),
  deleteEntry: (id) => request(`/api/entries/${id}`, { method: 'DELETE' }),
  saveHabit: (payload) => request('/api/habits', { method: 'POST', body: JSON.stringify(payload) }),
  deleteHabit: (id) => request(`/api/habits/${id}`, { method: 'DELETE' }),
  saveCategory: (payload) => request('/api/categories', { method: 'POST', body: JSON.stringify(payload) }),
  deleteCategory: (id) => request(`/api/categories/${id}`, { method: 'DELETE' }),
  getBudget: () => request('/api/budget'),
  saveBudget: (payload) => request('/api/budget', { method: 'POST', body: JSON.stringify(payload) }),
  getTodos: () => request('/api/todos'),
  addTodo: (payload) => request('/api/todos', { method: 'POST', body: JSON.stringify(payload) }),
  updateTodo: (id, payload) => request(`/api/todos/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteTodo: (id) => request(`/api/todos/${id}`, { method: 'DELETE' }),
};
