export const OFFICIAL_REPOSITORY = 'trim360/3ds-profile-template';
export function compareVersions(left, right) {
  const parse = value => { if (!/^v?\d+\.\d+\.\d+$/.test(value)) throw new Error('Invalid stable version.'); return value.replace(/^v/, '').split('.').map(Number); };
  const a = parse(left); const b = parse(right);
  for (let index = 0; index < 3; index++) if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  return 0;
}
export async function latestRelease(fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(`https://api.github.com/repos/${OFFICIAL_REPOSITORY}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000),
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const error = new Error(`GitHub HTTP ${response.status}`);
    const retry = Number(response.headers.get('retry-after'));
    const reset = Number(response.headers.get('x-ratelimit-reset')) * 1000;
    error.retryAt = Math.max(Date.now() + 3600000, Number.isFinite(retry) ? Date.now() + retry * 1000 : 0, Number.isFinite(reset) ? reset : 0);
    throw error;
  }
  const data = await response.json();
  if (data.draft || data.prerelease || !/^v\d+\.\d+\.\d+$/.test(data.tag_name)) return null;
  return { version: data.tag_name.slice(1), tag: data.tag_name, body: typeof data.body === 'string' ? data.body.slice(0, 20000) : '', assets: Array.isArray(data.assets) ? data.assets : [] };
}
export function releaseUrl(release) {
  if (!release || !/^v\d+\.\d+\.\d+$/.test(release.tag)) throw new Error('Invalid release tag.');
  return `https://github.com/${OFFICIAL_REPOSITORY}/releases/tag/${release.tag}`;
}
