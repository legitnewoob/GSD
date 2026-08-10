const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function request(path, options = {}) {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

export const api = {
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
