// Calls to the Cloudflare Worker (src/worker).
import { API_BASE } from './config.js';

export async function api(path, { method = 'POST', body, token } = {}) {
  const res = await fetch(API_BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
