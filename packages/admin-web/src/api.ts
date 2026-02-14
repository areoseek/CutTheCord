const BASE = '/admin';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// Users
export const getUsers = () => request<any[]>('/users');
export const getUser = (id: string) => request<any>(`/users/${id}`);
export const createUser = (data: { username: string; password: string; is_global_admin?: boolean }) =>
  request<any>('/users', { method: 'POST', body: JSON.stringify(data) });
export const updateUser = (id: string, data: any) =>
  request<any>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const resetPassword = (id: string, password: string) =>
  request<any>(`/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) });
export const deleteUser = (id: string) =>
  request<any>(`/users/${id}`, { method: 'DELETE' });

// Servers
export const getServers = () => request<any[]>('/servers');
export const getServer = (id: string) => request<any>(`/servers/${id}`);
export const createServer = (data: { name: string; owner_id: string }) =>
  request<any>('/servers', { method: 'POST', body: JSON.stringify(data) });
export const updateServer = (id: string, data: any) =>
  request<any>(`/servers/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteServer = (id: string) =>
  request<any>(`/servers/${id}`, { method: 'DELETE' });
export const assignAdmin = (data: { user_id: string; server_id: string }) =>
  request<any>('/assign-admin', { method: 'POST', body: JSON.stringify(data) });
export const addMember = (serverId: string, data: { user_id: string; role?: string }) =>
  request<any>(`/servers/${serverId}/members`, { method: 'POST', body: JSON.stringify(data) });
