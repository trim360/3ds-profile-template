import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, writeFile, unlink, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ROOT, loadProfile, saveProfile, profileWrites, buildSite, checkParents, exists, atomicWrite, withLock, sha256, importMedia, mediaReferences } from './project.mjs';
import { DEFAULT_CONFIG, validateConfig } from './config.mjs';
import { newToken, digestToken, equal, readOwner, verifyOwner } from './owner-auth.mjs';
import { checkForUpdate, installRelease, installedVersion } from '../scripts/update.mjs';
import { compareVersions } from './releases.mjs';

const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.gif':'image/gif', '.webp':'image/webp', '.mp3':'audio/mpeg', '.wav':'audio/wav', '.ogg':'audio/ogg', '.txt':'text/plain' };
const error = (status, message) => Object.assign(new Error(message), { status });
const revision = config => sha256(JSON.stringify(config));
async function body(request, limit, json = true) {
  if (Number(request.headers['content-length']) > limit) throw error(413, 'Fichier ou requête trop volumineux.');
  let length = 0; const chunks = [];
  for await (const chunk of request) { length += chunk.length; if (length > limit) throw error(413, 'Fichier ou requête trop volumineux.'); chunks.push(chunk); }
  const bytes = Buffer.concat(chunks);
  if (!json) return bytes;
  if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] || '')) throw error(415, 'JSON requis.');
  try { return JSON.parse(bytes.toString('utf8')); } catch { throw error(400, 'JSON invalide.'); }
}
export async function publishProfile(root, input, expectedRevision) {
  return withLock(root, async () => {
    const current = await loadProfile(root);
    if (!equal(expectedRevision, revision(current))) throw error(409, 'Le profil a changé. Recharge avant d’enregistrer.');
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !Object.hasOwn(DEFAULT_CONFIG, key))) throw error(400, 'Champ de profil non autorisé.');
    const next = { ...current, ...input };
    const problems = validateConfig(next); if (problems.length) throw error(400, problems.join('\n'));
    try { mediaReferences(next); } catch { throw error(400,'Utilise uniquement des chemins d’images et de musique publics.'); }
    if (next.music !== current.music && next.music && next.musicCredit?.rightsConfirmed !== true) throw error(400, 'Confirme les droits de diffusion de la musique.');
    const previous = new Map();
    for (const [name] of profileWrites(next)) { const file = await checkParents(root, name); previous.set(name, await exists(file) ? await readFile(file) : null); }
    let result;
    try { result = await saveProfile(root, next); await buildSite(root); }
    catch (failure) {
      for (const [name, bytes] of previous) { const file = await checkParents(root, name); if (bytes !== null) await atomicWrite(file, bytes); else if (await exists(file)) await unlink(file); }
      throw failure;
    }
    const published=await loadProfile(root);
    return { profile: published, revision: revision(published), backup: result.backup ? path.relative(root, result.backup).split(path.sep).join('/') : null };
  });
}
export async function startOwnerServer({ root = ROOT, host = '127.0.0.1', port = 8120, origin = '', fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  root = path.resolve(root);
  if (!origin && !['127.0.0.1','::1','localhost'].includes(host)) throw new Error('A public HTTPS origin is required when binding outside loopback.');
  if (origin) {
    const url = new URL(origin);
    if (url.origin !== origin || url.username || url.password || !['https:','http:'].includes(url.protocol) || url.protocol === 'http:' && !['127.0.0.1','localhost','[::1]'].includes(url.hostname)) throw new Error('Origin must be HTTPS, or loopback HTTP for local use.');
  }
  await readOwner(root);
  await withLock(root, () => buildSite(root));
  const sessions = new Map(), attempts = new Map();
  let authenticating = 0, pendingRelease = null, restarting = false, updating = false, canonical = origin;
  const json = (response, status, data) => { response.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' }); response.end(JSON.stringify(data)); };
  function sameOrigin(request) {
    if (request.headers.origin !== canonical || request.headers['sec-fetch-site'] === 'cross-site') throw error(403, 'Origine non autorisée.');
  }
  async function authorized(request) {
    const match = (request.headers.cookie || '').match(/(?:^|;\s*)profile_owner=([a-f0-9]{64})(?:;|$)/);
    const key = match && digestToken(match[1]), session = key && sessions.get(key);
    const owner = session && await readOwner(root);
    if (!session || session.expires <= now() || session.idle <= now() || owner?.generation !== session.generation) { if (key) sessions.delete(key); throw error(401, 'Connexion propriétaire requise.'); }
    session.idle = now() + 30 * 60000;
    return { session, key };
  }
  const cookie = value => `profile_owner=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${value ? 8 * 3600 : 0}${canonical.startsWith('https:') ? '; Secure' : ''}`;
  async function file(response, request, directory, relative, privateFile = false) {
    const target = await checkParents(directory, relative);
    const info=await stat(target);
    if (!info.isFile()) throw error(404, 'Introuvable.');
    let start=0,end=info.size-1,status=200;
    if(request.headers.range){
      const match=/^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
      if(!match||!info.size||!match[1]&&!match[2])throw error(416,'Plage invalide.');
      start=match[1]?Number(match[1]):Math.max(0,info.size-Number(match[2]));
      end=match[1]&&match[2]?Math.min(end,Number(match[2])):end;
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=info.size)throw error(416,'Plage invalide.');
      status=206;response.setHeader('Content-Range',`bytes ${start}-${end}/${info.size}`);
    }
    response.writeHead(status, { 'Content-Type': types[path.extname(target).toLowerCase()] || 'text/plain', 'Cache-Control': privateFile ? 'no-store' : 'no-cache','Content-Length':Math.max(0,end-start+1),'Accept-Ranges':'bytes' });
    if(request.method==='HEAD'||!info.size)return response.end();
    const stream=createReadStream(target,{start,end});stream.on('error',()=>response.destroy());response.on('close',()=>stream.destroy());stream.pipe(response);
  }
  const server = createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options','nosniff'); response.setHeader('Referrer-Policy','same-origin');
    try {
      if (request.headers.host !== new URL(canonical).host) throw error(421, 'Hôte non autorisé.');
      const url = new URL(request.url, canonical), pathname = decodeURIComponent(url.pathname);
      if (pathname.startsWith('/owner-api/') || pathname.startsWith('/assets/owner/')) {
        response.setHeader('Cache-Control','no-store'); response.setHeader('X-Frame-Options','DENY');
        response.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: http:; media-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
      }
      if (pathname === '/owner-api/status' && request.method === 'GET') {
        const configured = Boolean(await readOwner(root)); const profile = await loadProfile(root);
        let state = null; try { state = (await authorized(request)).session; } catch (failure) { if (failure.status !== 401) throw failure; }
        return json(response,200,{ configured, authenticated:Boolean(state), csrf:state?.csrf, name:profile.name, avatar:profile.avatar, restartRequired:restarting });
      }
      if (pathname === '/owner-api/login' && request.method === 'POST') {
        sameOrigin(request);
        const address = request.socket.remoteAddress || 'local';
        for (const [key, value] of attempts) if (value.until <= now()) attempts.delete(key);
        const limit = attempts.get(address);
        if (attempts.size > 1000 || limit?.count >= 5 || authenticating >= 2) throw error(429, 'Trop de tentatives. Réessaie dans quinze minutes.');
        const input = await body(request, 4096);
        if (typeof input.username !== 'string' || input.username.length > 64 || typeof input.password !== 'string' || input.password.length > 128) throw error(400,'Identifiant ou mot de passe invalide.');
        const record = limit || { count:0, until:now() + 15 * 60000 }; record.count++; attempts.set(address,record);
        authenticating++;
        let owner; try { owner = await verifyOwner(root,input.username,input.password); } finally { authenticating--; }
        if (!owner) throw error(401,'Identifiant ou mot de passe incorrect.');
        attempts.delete(address);
        for (const [key, session] of sessions) if (session.expires <= now() || session.idle <= now()) sessions.delete(key);
        if (sessions.size >= 16) sessions.delete(sessions.keys().next().value);
        const previous=(request.headers.cookie||'').match(/(?:^|;\s*)profile_owner=([a-f0-9]{64})(?:;|$)/);
        if(previous)sessions.delete(digestToken(previous[1]));
        const token = newToken(), csrf = newToken();
        sessions.set(digestToken(token),{csrf,generation:owner.generation,expires:now()+8*3600000,idle:now()+30*60000});
        response.setHeader('Set-Cookie',cookie(token)); return json(response,200,{csrf});
      }
      if (pathname.startsWith('/owner-api/')) {
        const { session, key } = await authorized(request);
        if (!['GET','HEAD'].includes(request.method)) { sameOrigin(request); if (!equal(request.headers['x-csrf-token'] || '',session.csrf)) throw error(403,'Jeton de formulaire invalide.'); }
        if (pathname === '/owner-api/logout' && request.method === 'POST') { sessions.delete(key);response.setHeader('Set-Cookie',cookie(''));return json(response,200,{ok:true}); }
        if ((updating || restarting) && request.method !== 'GET') throw error(503,'Mise à jour en cours ou redémarrage requis.');
        if (pathname === '/owner-api/profile' && request.method === 'GET') { const profile=await loadProfile(root);return json(response,200,{profile,revision:revision(profile)}); }
        if (pathname === '/owner-api/profile' && request.method === 'PUT') { const input=await body(request,2*1024*1024);return json(response,200,await publishProfile(root,input.profile,input.revision)); }
        if (pathname === '/owner-api/media' && request.method === 'POST') {
          const kind=url.searchParams.get('kind'), name=url.searchParams.get('name') || '';
          if (!['image','music'].includes(kind) || !/^[^/\\\x00-\x1f:]{1,128}$/.test(name)) throw error(400,'Nom ou type de fichier invalide.');
          const bytes=await body(request,kind==='music'?30*1024*1024:10*1024*1024,false);
          const temporary=await checkParents(root,`.owner/upload-${randomUUID()}${path.extname(name).toLowerCase()}`);
          await mkdir(path.dirname(temporary),{recursive:true,mode:0o700});
          await writeFile(temporary,bytes,{flag:'wx',mode:0o600});
          try {
            let relative;
            try { relative=await withLock(root,()=>importMedia(root,temporary,kind)); }
            catch(failure){if(/^(Supported|Expected a non-empty)/.test(failure.message))throw error(400,'Média invalide : images PNG/JPG/GIF/WebP ou musique MP3/OGG/WAV uniquement.');throw failure;}
            return json(response,201,{path:relative,preview:'/owner-api/media/'+path.basename(relative)});
          }
          finally { await unlink(temporary); }
        }
        if (pathname.startsWith('/owner-api/media/') && ['GET','HEAD'].includes(request.method)) {
          const name=pathname.slice('/owner-api/media/'.length);
          if (!/^(?:image|music)-[a-f0-9-]+\.(?:png|jpe?g|gif|webp|mp3|ogg|wav)$/.test(name)) throw error(404,'Introuvable.');
          return await file(response,request,root,'user-content/media/'+name,true);
        }
        if (pathname === '/owner-api/updates' && request.method === 'GET') {
          pendingRelease=await checkForUpdate({root,fetchImpl}); const version=await installedVersion(root);
          return json(response,200,{version,release:pendingRelease&&compareVersions(pendingRelease.version,version)>0?pendingRelease:null,restartRequired:restarting});
        }
        if (pathname === '/owner-api/updates/install' && request.method === 'POST') {
          const input=await body(request,4096);
          if (!pendingRelease || input.confirmVersion!==pendingRelease.version) throw error(409,'Vérifie la version puis confirme son installation.');
          updating=true;
          try { const result=await installRelease({root,release:pendingRelease,fetchImpl});restarting=true;sessions.clear();return json(response,200,{...result,restartRequired:true}); }
          finally { updating=false; }
        }
        throw error(404,'Action introuvable.');
      }
      if (!['GET','HEAD'].includes(request.method)) throw error(405,'Méthode non autorisée.');
      const relative=pathname==='/'?'index.html':pathname.slice(1);
      if (relative.split('/').some(part=>part.startsWith('.')) || /^(?:backups|scripts|user-content\/pages)(?:\/|$)/.test(relative)) throw error(404,'Introuvable.');
      await file(response,request,path.join(root,'dist'),relative);
    } catch (failure) {
      if (response.headersSent) { response.destroy(); return; }
      const status=failure.status || (['ENOENT','ENOTDIR'].includes(failure.code)?404:500);
      json(response,status,{error:status<500?failure.message:'Opération impossible. Vérifie les fichiers et les sauvegardes depuis le serveur.'});
    }
  });
  server.requestTimeout=20000;server.headersTimeout=10000;server.maxHeadersCount=64;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
  if (!canonical) canonical=`http://${host==='::1'?'[::1]':host}:${server.address().port}`;
  return {server,url:canonical,close:()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);})};
}
