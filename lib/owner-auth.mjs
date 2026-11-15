import { randomBytes, randomUUID, scrypt as derive, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile, mkdir, chmod } from 'node:fs/promises';
import path from 'node:path';
import { atomicWrite, checkParents, exists, withLock } from './project.mjs';

const scrypt = promisify(derive);
const options = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
export const digestToken = value => createHash('sha256').update(String(value)).digest('hex');
export const newToken = () => randomBytes(32).toString('hex');
export function equal(left, right) {
  const a = Buffer.from(String(left)), b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function readOwner(root) {
  const file = await checkParents(root, '.owner/account.json');
  if (!await exists(file)) return null;
  const owner = JSON.parse(await readFile(file, 'utf8'));
  if (owner.format !== 1 || !/^[a-zA-Z0-9_.-]{3,64}$/.test(owner.username) || !/^[a-f0-9]{64}$/.test(owner.salt) || !/^[a-f0-9]{128}$/.test(owner.hash) || typeof owner.generation !== 'string') throw new Error('Invalid private owner account. Restore its backup or reset it locally.');
  return owner;
}
export async function configureOwner(root, username, password, { reset = false } = {}) {
  if (!/^[a-zA-Z0-9_.-]{3,64}$/.test(username)) throw new Error('Identifier: 3–64 letters, digits, dots, dashes or underscores.');
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw new Error('Password: 12–128 characters.');
  return withLock(root, async () => {
    const old = await readOwner(root);
    if (old && !reset) throw new Error('Owner already configured. Use the local reset command.');
    const salt = randomBytes(32).toString('hex');
    const hash = (await scrypt(password, salt, 64, options)).toString('hex');
    const directory = await checkParents(root, '.owner');
    await mkdir(directory, { recursive: true, mode: 0o700 }); await chmod(directory, 0o700);
    await atomicWrite(path.join(directory, 'account.json'), JSON.stringify({ format: 1, username, salt, hash, generation: randomUUID() }) + '\n');
  });
}
export async function verifyOwner(root, username, password) {
  const owner = await readOwner(root);
  const candidate = await scrypt(String(password).slice(0, 128), owner?.salt || '0'.repeat(64), 64, options);
  const correct = timingSafeEqual(candidate, Buffer.from(owner?.hash || '0'.repeat(128), 'hex'));
  return owner && correct && equal(username, owner.username) ? owner : null;
}
