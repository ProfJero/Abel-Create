// Verifies Firebase Auth ID tokens (RS256) using Google's public keys.
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let jwks = { keys: [], exp: 0 };

const decode = (part) => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(part.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))));
const bytes = (part) => Uint8Array.from(atob(part.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function keys() {
  if (Date.now() < jwks.exp) return jwks.keys;
  const res = await fetch(JWKS_URL);
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') || '')?.[1] || 3600);
  jwks = { keys: (await res.json()).keys, exp: Date.now() + maxAge * 1000 };
  return jwks.keys;
}

export async function verifyIdToken(token, projectId) {
  const [h, p, s] = String(token).split('.');
  if (!s) throw new Error('Malformed token');
  const header = decode(h);
  const claims = decode(p);
  const jwk = (await keys()).find((k) => k.kid === header.kid);
  if (header.alg !== 'RS256' || !jwk) throw new Error('Unknown signing key');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, bytes(s), new TextEncoder().encode(`${h}.${p}`));
  const now = Date.now() / 1000;
  if (!ok) throw new Error('Bad signature');
  if (claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('Wrong project');
  if (claims.exp < now || claims.iat > now + 300 || !claims.sub) throw new Error('Token expired');
  return claims;
}
