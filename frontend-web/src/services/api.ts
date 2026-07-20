const API_BASE = '/api/v1';

export function getAuthToken(): string | null {
  return localStorage.getItem('synccloud_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('synccloud_token', token);

  // Transmit token to Electron syncEngine main process if running inside Electron
  try {
    if ((window as any).require) {
      const { ipcRenderer } = (window as any).require('electron');
      ipcRenderer.send('set_auth', token);
    }
  } catch (err) {}
}

export function removeAuthToken() {
  localStorage.removeItem('synccloud_token');
}

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    removeAuthToken();
    window.dispatchEvent(new Event('auth_expired'));
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Erro na requisição');
  }

  return data;
}
