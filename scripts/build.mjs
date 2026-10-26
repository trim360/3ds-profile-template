import { buildSite, ROOT } from '../lib/project.mjs';
try { console.log(await buildSite(ROOT)); } catch (error) { console.error(error.message); process.exitCode = 1; }
