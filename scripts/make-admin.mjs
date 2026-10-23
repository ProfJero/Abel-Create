// Creates (or reuses) a Firebase Auth user and makes it a dashboard admin by
// writing admins/{uid} in Firestore. Run it from your own computer only.
//
//   npm run make-admin -- service-account.json you@email.com
//   npm run make-admin -- service-account.json you@email.com --remove
//
// If the email has no account yet, you'll be asked to choose a password.

import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { firestore, accessToken } from '../worker/src/firestore.js';

const [keyPath, rawEmail, flag] = process.argv.slice(2);
if (!keyPath || !rawEmail) {
  console.error('Usage: npm run make-admin -- path/to/service-account.json you@email.com [--remove]');
  process.exit(1);
}
const email = rawEmail.trim().toLowerCase();
const raw = readFileSync(keyPath, 'utf8');
const projectId = JSON.parse(raw).project_id;
const env = { FIREBASE_SERVICE_ACCOUNT: raw, FIREBASE_PROJECT_ID: projectId };
// FIREBASE_AUTH_EMULATOR_HOST / FIRESTORE_EMULATOR_HOST: local testing only
const authEmu = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (process.env.FIRESTORE_EMULATOR_HOST) env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const idt = `${authEmu ? `http://${authEmu}/` : 'https://'}identitytoolkit.googleapis.com/v1/projects/${projectId}`;

const db = firestore(env);

async function identity(path, body) {
  const token = authEmu ? 'owner' : await accessToken({ ...env, GOOGLE_SCOPE: 'https://www.googleapis.com/auth/cloud-platform' });
  const res = await fetch(`${idt}/${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Identity Toolkit ${path}: ${res.status}`);
  return data;
}

// One reader for all prompts (works when typing or piping). Typed characters show as *.
let rl, lines;
async function askHidden(question) {
  rl ??= createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
  lines ??= rl[Symbol.asyncIterator]();
  process.stdout.write(question);
  rl._writeToOutput = (s) => rl.output.write(s.replace(/[^\r\n]/g, '*'));
  const { value = '' } = await lines.next();
  if (!process.stdin.isTTY) process.stdout.write('\n');
  return value;
}

async function main() {
  const found = (await identity('accounts:lookup', { email: [email] })).users?.[0];

  if (flag === '--remove') {
    if (found) await db.remove(`admins/${found.localId}`);
    console.log(`✓ ${email} is no longer an admin (their login still exists).`);
    return;
  }

  let uid = found?.localId;
  if (!uid) {
    console.log(`No account for ${email} yet. Choose a password for the dashboard (min. 10 characters).`);
    const password = await askHidden('Password: ');
    if (password.length < 10) throw new Error('Password must be at least 10 characters.');
    if (password !== (await askHidden('Repeat password: '))) throw new Error('Passwords do not match.');
    uid = (await identity('accounts', { email, password, emailVerified: true })).localId;
    console.log(`✓ Created login for ${email}`);
  } else {
    console.log(`Found existing login for ${email}.`);
  }

  await db.set(`admins/${uid}`, { email, createdAt: new Date() }, { merge: false });
  console.log(`✓ ${email} is now an admin (uid ${uid}).`);
  console.log('  Sign in at https://<your-site>.pages.dev/admin');
}

main()
  .catch((err) => {
    console.error(`✗ ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => rl?.close());
