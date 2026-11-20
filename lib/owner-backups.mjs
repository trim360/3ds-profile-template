// Read-only helpers over the profile backups that saveProfile() already writes to backups/profile-<time>-<id>/.
// Used by the owner dashboard to list backups, restore one (through the normal publish path, which backs up the
// current profile first) and recover pages that were deleted recently.
import { readFile, readdir, stat } from 'node:fs/promises';
import { checkParents, exists } from './project.mjs';
import path from 'node:path';
import { normalizeConfig } from './config.mjs';

const BACKUP_ID = /^profile-(\d{10,16})-[a-f0-9]{8}$/;
const PAGE_FILE = /^[a-z][a-z0-9-]{0,63}\.json$/;
export const isBackupId = id => typeof id === 'string' && BACKUP_ID.test(id);

async function readJson(root, relative) {
  const file = await checkParents(root, relative);
  return (await exists(file)) ? JSON.parse(await readFile(file, 'utf8')) : null;
}

export async function listBackupIds(root) {
  const directory = await checkParents(root, 'backups');
  if (!await exists(directory)) return [];
  const entries = await readdir(directory, { withFileTypes: true });
  return entries.filter(entry => entry.isDirectory() && isBackupId(entry.name)).map(entry => entry.name).sort().reverse();
}

// Rebuilds a full configuration from a backup folder (profile.json plus the page files it lists, or a legacy config.js-less backup).
export async function readBackup(root, id) {
  if (!isBackupId(id)) throw Object.assign(new Error('Sauvegarde inconnue.'), { status: 404 });
  const stored = await readJson(root, `backups/${id}/user-content/profile.json`);
  if (!stored) throw Object.assign(new Error('Sauvegarde introuvable ou incomplète.'), { status: 404 });
  const config = { ...stored };
  if (Array.isArray(stored.pageFiles)) {
    config.pages = [];
    for (const name of stored.pageFiles) {
      if (!PAGE_FILE.test(name)) throw new Error('Invalid page filename in backup.');
      // saveProfile() only backs up pages that still exist after a save; a page removed in that save keeps its file in user-content/pages/.
      const page = await readJson(root, `backups/${id}/user-content/pages/${name}`) ?? await readJson(root, `user-content/pages/${name}`);
      if (page) config.pages.push(page);
    }
  }
  delete config.pageFiles;
  return normalizeConfig(config);
}

export async function describeBackups(root, limit = 30) {
  const result = [];
  for (const id of (await listBackupIds(root)).slice(0, limit)) {
    try {
      const config = await readBackup(root, id);
      result.push({ id, time: Number(id.split('-')[1]), name: config.name, pages: config.pages.length });
    } catch { /* an unreadable backup is skipped, never deleted */ }
  }
  return result;
}

// Page files left in user-content/pages/ that the current profile no longer lists: pages deleted from the dashboard.
// saveProfile() never removes page files, so they stay recoverable until the owner deletes them by hand.
export async function deletedPages(root, currentIds, limit = 20) {
  const directory = await checkParents(root, 'user-content/pages');
  if (!await exists(directory)) return [];
  const live = new Set(currentIds), found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !PAGE_FILE.test(entry.name) || live.has(entry.name.slice(0, -5))) continue;
    try {
      const page = JSON.parse(await readFile(await checkParents(root, `user-content/pages/${entry.name}`), 'utf8'));
      if (page && typeof page === 'object' && page.id === entry.name.slice(0, -5)) found.push({ time: (await stat(path.join(directory, entry.name))).mtimeMs, page });
    } catch { /* unreadable page files are ignored */ }
  }
  return found.sort((x, y) => y.time - x.time).slice(0, limit);
}
