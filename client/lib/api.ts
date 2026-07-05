import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://splitease-backend-j63g.onrender.com/api/v1';

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // Send cookies (refresh token)
});

// ─── Access token in memory (NOT localStorage) ────────────────────────────────
let inMemoryAccessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  inMemoryAccessToken = token;
};

export const getAccessToken = () => inMemoryAccessToken;

// ─── Request interceptor: attach access token ─────────────────────────────────
api.interceptors.request.use((config) => {
  if (inMemoryAccessToken) {
    config.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
  }
  return config;
});

// ─── Response interceptor: auto-refresh on 401 ───────────────────────────────
let isRefreshing = false;
let pendingRequests: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (isRefreshing) {
        // Queue request until refresh completes
        return new Promise((resolve) => {
          pendingRequests.push((token: string) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }

      isRefreshing = true;

      try {
        const { data } = await api.post('/auth/refresh');
        const newToken = data.data.accessToken;
        setAccessToken(newToken);

        pendingRequests.forEach((cb) => cb(newToken));
        pendingRequests = [];

        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        setAccessToken(null);
        pendingRequests = [];
        window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ─── Auth endpoints ────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  refresh: () => api.post('/auth/refresh'),
  me: () => api.get('/auth/me'),
};

// ─── Group endpoints ──────────────────────────────────────────────────────────
export const groupApi = {
  create: (data: any) => api.post('/groups', data),
  getAll: () => api.get('/groups'),
  getOne: (groupId: string) => api.get(`/groups/${groupId}`),
  update: (groupId: string, data: any) => api.patch(`/groups/${groupId}`, data),
  delete: (groupId: string) => api.delete(`/groups/${groupId}`),
  join: (inviteCode: string) => api.post('/groups/join', { inviteCode }),
  leave: (groupId: string) => api.post(`/groups/${groupId}/leave`),
  regenerateCode: (groupId: string) =>
    api.patch(`/groups/${groupId}/invite-code`),
  removeMember: (groupId: string, memberId: string) =>
    api.delete(`/groups/${groupId}/members/${memberId}`),
};

// ─── Expense endpoints ────────────────────────────────────────────────────────
export const expenseApi = {
  create: (groupId: string, data: any) =>
    api.post(`/groups/${groupId}/expenses`, data),
  getAll: (groupId: string, params?: any) =>
    api.get(`/groups/${groupId}/expenses`, { params }),
  getOne: (groupId: string, expenseId: string) =>
    api.get(`/groups/${groupId}/expenses/${expenseId}`),
  update: (groupId: string, expenseId: string, data: any) =>
    api.patch(`/groups/${groupId}/expenses/${expenseId}`, data),
  delete: (groupId: string, expenseId: string) =>
    api.delete(`/groups/${groupId}/expenses/${expenseId}`),
  getBalances: (groupId: string) =>
    api.get(`/groups/${groupId}/expenses/balances`),
};

// ─── Settlement endpoints ─────────────────────────────────────────────────────
export const settlementApi = {
  request: (groupId: string, data: any) =>
    api.post(`/groups/${groupId}/settlements`, data),
  getAll: (groupId: string, params?: any) =>
    api.get(`/groups/${groupId}/settlements`, { params }),
  updateStatus: (groupId: string, settlementId: string, status: string) =>
    api.patch(`/groups/${groupId}/settlements/${settlementId}`, { status }),
};

// ─── Dashboard endpoints ──────────────────────────────────────────────────────
export const dashboardApi = {
  get: (groupId: string) => api.get(`/groups/${groupId}/dashboard`),
  getActivity: (groupId: string, params?: any) =>
    api.get(`/groups/${groupId}/dashboard/activity`, { params }),
};
