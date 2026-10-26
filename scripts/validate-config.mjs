import { loadProfile, ROOT } from '../lib/project.mjs';
try { await loadProfile(ROOT); console.log('Configuration valid / Configuration valide.'); }
catch (error) { console.error(error.message); process.exitCode = 1; }
