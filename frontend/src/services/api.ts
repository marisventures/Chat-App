const rawUrl = import.meta.env.VITE_API_URL || '/api';
// Normalize: ensure /api suffix for full URLs, strip trailing slash for relative paths
const API_BASE_URL = rawUrl.startsWith('http')
  ? rawUrl.replace(/\/?$/, '/api')
  : rawUrl.replace(/\/$/, '') || '/api';
// Derive server URL (without /api) for WebSocket connections.
// In production (relative /api), empty string lets socket.io connect to the same origin.
const SERVER_URL = API_BASE_URL.startsWith('http')
  ? API_BASE_URL.replace(/\/api\/?$/, '')
  : '';

class ApiService {
  private getHeaders(token?: string | null): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async get<T>(endpoint: string, token: string | null): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: this.getHeaders(token),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Failed to fetch');
    }

    return response.json();
  }

  async post<T>(endpoint: string, data: unknown, token?: string | null): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(token || null),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Failed to post');
    }

    return response.json();
  }

  async put<T>(endpoint: string, data: unknown, token: string | null): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(token),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Failed to update');
    }

    return response.json();
  }

  async delete<T>(endpoint: string, token: string | null): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(token),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Failed to delete');
    }

    return response.json();
  }
}

export const api = new ApiService();
export { API_BASE_URL, SERVER_URL };

export function getAvatarUrl(avatar: string | undefined | null): string {
  if (!avatar) return '';
  if (avatar.startsWith('data:')) return avatar;
  if (avatar.startsWith('http')) {
    try {
      const url = new URL(avatar);
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        return url.pathname;
      }
    } catch {}
    return avatar;
  }
  return `${SERVER_URL}${avatar}`;
}
