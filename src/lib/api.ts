import { auth } from './firebase';

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Not authenticated');
  }

  const token = await user.getIdToken();
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API request failed');
  }
  return response.json();
}
