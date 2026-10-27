import { previewSite } from '../lib/project.mjs';
import { ROOT } from './build.mjs';
import path from 'node:path';
const { server, url } = await previewSite(path.join(ROOT, 'dist'));
server.prependListener('request', request => {
  const target = new URL(request.url, 'http://localhost');
  if (target.pathname.endsWith('/')) request.url = target.pathname + 'index.html' + target.search;
});
console.log(url);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
