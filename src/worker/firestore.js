// Minimal Firestore REST client for Workers, authenticated with a Google
// service account (FIREBASE_SERVICE_ACCOUNT secret, the JSON key as one line).

const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlStr = (s) => b64url(new TextEncoder().encode(s));

let cached = { token: null, exp: 0 };

async function accessToken(env) {
  if (cached.token && Date.now() < cached.exp - 60_000) return cached.token;
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlStr(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64urlStr(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${b64url(sig)}` })
  });
  if (!res.ok) throw new Error(`Google auth failed: ${res.status} ${await res.text()}`);
  const { access_token, expires_in } = await res.json();
  cached = { token: access_token, exp: Date.now() + expires_in * 1000 };
  return access_token;
}

// Firestore value <-> JS conversion
function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  switch (typeof v) {
    case 'boolean': return { booleanValue: v };
    case 'number': return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    case 'string': return { stringValue: v };
    case 'object': return { mapValue: { fields: toFields(v) } };
  }
  throw new Error(`Unsupported value: ${typeof v}`);
}
const toFields = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined).map(([k, v]) => [k, toValue(v)]));

function fromValue(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
  if ('mapValue' in v) return fromFields(v.mapValue.fields || {});
  return null;
}
const fromFields = (f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, fromValue(v)]));
const fromDoc = (d) => ({ id: d.name.split('/').pop(), _updateTime: d.updateTime, ...fromFields(d.fields || {}) });

export function firestore(env) {
  const base = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const call = async (url, init = {}) => {
    const res = await fetch(url, { ...init, headers: { authorization: `Bearer ${await accessToken(env)}`, 'content-type': 'application/json' } });
    return res;
  };

  return {
    async get(path) {
      const res = await call(`${base}/${path}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Firestore get ${path}: ${res.status}`);
      return fromDoc(await res.json());
    },

    // Creates or merges fields. With `ifUpdateTime`, fails (returns false) if
    // the document changed since it was read, which makes updates race-safe.
    async set(path, data, { merge = true, ifUpdateTime, mustNotExist } = {}) {
      const qs = new URLSearchParams();
      if (merge) Object.keys(data).forEach((k) => qs.append('updateMask.fieldPaths', k));
      if (ifUpdateTime) qs.set('currentDocument.updateTime', ifUpdateTime);
      if (mustNotExist) qs.set('currentDocument.exists', 'false');
      const res = await call(`${base}/${path}?${qs}`, { method: 'PATCH', body: JSON.stringify({ fields: toFields(data) }) });
      if (res.status === 400 || res.status === 409 || res.status === 412) {
        const body = await res.text();
        if (/FAILED_PRECONDITION|ALREADY_EXISTS|NOT_FOUND/.test(body)) return false;
        throw new Error(`Firestore set ${path}: ${res.status} ${body}`);
      }
      if (!res.ok) throw new Error(`Firestore set ${path}: ${res.status} ${await res.text()}`);
      return true;
    },

    async add(collection, data) {
      const res = await call(`${base}/${collection}`, { method: 'POST', body: JSON.stringify({ fields: toFields(data) }) });
      if (!res.ok) throw new Error(`Firestore add ${collection}: ${res.status}`);
      return fromDoc(await res.json());
    },

    // Equality-only query: where({ email: 'a@b.c', status: 'paid' })
    async where(collection, equals) {
      const filters = Object.entries(equals).map(([field, value]) => ({ fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: toValue(value) } }));
      const where = filters.length === 1 ? filters[0] : { compositeFilter: { op: 'AND', filters } };
      const res = await call(`${base}:runQuery`, { method: 'POST', body: JSON.stringify({ structuredQuery: { from: [{ collectionId: collection }], where, limit: 200 } }) });
      if (!res.ok) throw new Error(`Firestore query ${collection}: ${res.status} ${await res.text()}`);
      return (await res.json()).filter((r) => r.document).map((r) => fromDoc(r.document));
    }
  };
}
