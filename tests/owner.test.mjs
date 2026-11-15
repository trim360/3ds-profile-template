import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,stat,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {Readable,Writable} from 'node:stream';
import {request as httpRequest} from 'node:http';
import {fixture,updateFixture} from './helpers.mjs';
import {loadProfile,saveProfile,buildSite,sha256} from '../lib/project.mjs';
import {configureOwner,readOwner} from '../lib/owner-auth.mjs';
import {startOwnerServer,publishProfile} from '../lib/owner-server.mjs';
import {runSetup} from '../scripts/setup.mjs';

const username='owner-test',password='Local-test-only-2026-password';
async function application(t,{configure=true,...options}={}){
 const root=await fixture(t);if(configure)await configureOwner(root,username,password);
 const instance=await startOwnerServer({root,port:0,...options});t.after(()=>instance.close());
 let cookie='',csrf='';
 const request=(route,{json,method='GET',origin=instance.url,token=csrf,session=cookie,headers={},...rest}={})=>fetch(instance.url+route,{method,headers:{Origin:origin,...(session?{Cookie:session}:{}),...(token?{'X-CSRF-Token':token}:{}),...(json!==undefined?{'Content-Type':'application/json'}:{}),...headers},...(json!==undefined?{body:JSON.stringify(json)}:{}),...rest});
 async function login(){const response=await request('/owner-api/login',{method:'POST',json:{username,password}});assert.equal(response.status,200);cookie=response.headers.get('set-cookie').split(';')[0];csrf=(await response.json()).csrf;return response;}
 return{root,...instance,request,login};
}
test('fresh CLI setup configures a private local owner without changing profile data',async t=>{
 const root=await fixture(t),old=await readFile(path.join(root,'config.js'));let output='';
 await runSetup({root,input:Readable.from([['2','o',username,password,password,'0',''].join('\n')]),output:new Writable({write(chunk,_,done){output+=chunk;done();}})});
 const account=await readOwner(root);assert.equal(account.username,username);assert.notEqual(account.hash,password);assert.ok(!JSON.stringify(account).includes(password));assert.ok(!output.includes(password));
 assert.deepEqual(await readFile(path.join(root,'config.js')),old);
 if(process.platform!=='win32')assert.equal((await stat(path.join(root,'.owner/account.json'))).mode&0o777,0o600);
 await buildSite(root);await assert.rejects(readFile(path.join(root,'dist/.owner/account.json')));
 assert.ok(!(await readFile(path.join(root,'dist/config.js'),'utf8')).includes(password));
});
test('static export retains settings, owner guidance and no public update button',async t=>{
 const root=await fixture(t);await configureOwner(root,username,password);await buildSite(root);
 const html=await readFile(path.join(root,'dist/index.html'),'utf8'),script=await readFile(path.join(root,'dist/script.js'),'utf8');
 assert.match(html,/assets\/owner\/index.html/);assert.match(html,/id="theme-select"/);assert.doesNotMatch(html,/check-updates|update-notice/);assert.doesNotMatch(script,/latestRelease|checkUpdates|api.github.com/);
 assert.match(await readFile(path.join(root,'dist/assets/owner/index.html'),'utf8'),/Hébergement statique/);
 await assert.rejects(readFile(path.join(root,'dist/lib/owner-auth.mjs')));
});
test('visitors cannot read or mutate owner endpoints, private files or uploads',async t=>{
 const app=await application(t);
 for(const route of ['/owner-api/profile','/owner-api/updates','/owner-api/media/image-123.png'])assert.equal((await app.request(route)).status,401,route);
 for(const route of ['/owner-api/profile','/owner-api/media?kind=image&name=x.png','/owner-api/updates/install'])assert.equal((await app.request(route,{method:'POST',json:{}})).status,401,route);
 for(const route of ['/.owner/account.json','/%2eowner/account.json','/backups/example','/.env','/user-content/profile.json','/scripts/owner.mjs'])assert.equal((await app.request(route)).status,404,route);
 assert.equal((await app.request('/owner-api/status')).status,200);
 const spoofed=await new Promise((resolve,reject)=>{const req=httpRequest(app.url,{headers:{Host:'attacker.invalid'}},response=>{response.resume();resolve(response.statusCode);});req.on('error',reject);req.end();});assert.equal(spoofed,421);
 assert.equal((await app.request('/owner-api/login',{method:'POST',origin:'https://attacker.invalid',json:{username,password}})).status,403);
});
test('sessions require CSRF, reject cross-origin writes, expire, logout and reset',async t=>{
 let clock=Date.now();const app=await application(t,{now:()=>clock});
 const response=await app.login();assert.match(response.headers.get('set-cookie'),/HttpOnly/);assert.match(response.headers.get('set-cookie'),/SameSite=Strict/);
 const current=await(await app.request('/owner-api/profile')).json();
 assert.equal((await app.request('/owner-api/profile',{method:'PUT',token:'',json:{profile:{name:'Bad'},revision:current.revision}})).status,403);
 assert.equal((await app.request('/owner-api/profile',{method:'PUT',origin:'https://attacker.invalid',json:{profile:{name:'Bad'},revision:current.revision}})).status,403);
 await configureOwner(app.root,username,password,{reset:true});assert.equal((await app.request('/owner-api/profile')).status,401);
 await app.login();clock+=31*60000;assert.equal((await app.request('/owner-api/profile')).status,401);
 await app.login();assert.equal((await app.request('/owner-api/logout',{method:'POST'})).status,200);assert.equal((await app.request('/owner-api/profile')).status,401);
});
test('failed login is rate-limited without trusting spoofed proxy addresses',async t=>{
 const app=await application(t);
 for(let i=0;i<5;i++)assert.equal((await app.request('/owner-api/login',{method:'POST',headers:{'X-Forwarded-For':'192.0.2.'+i},json:{username:'unknown',password:'incorrect'}})).status,401);
 assert.equal((await app.request('/owner-api/login',{method:'POST',json:{username,password}})).status,429);
});

test('HTTPS deployments require the configured host and origin and issue Secure cookies',async t=>{
 const root=await fixture(t);await configureOwner(root,username,password);
 await assert.rejects(startOwnerServer({root,host:'0.0.0.0',port:0}),/HTTPS origin/);
 await assert.rejects(startOwnerServer({root,port:0,origin:'http://public.example'}),/HTTPS/);
 const app=await startOwnerServer({root,port:0,origin:'https://profile.example'});t.after(()=>app.close());
 const send=origin=>new Promise((resolve,reject)=>{const bytes=JSON.stringify({username,password});const request=httpRequest({hostname:'127.0.0.1',port:app.server.address().port,path:'/owner-api/login',method:'POST',headers:{Host:'profile.example',...(origin?{Origin:origin}:{}),'Content-Type':'application/json','Content-Length':Buffer.byteLength(bytes)}},response=>{response.resume();resolve({status:response.statusCode,cookie:response.headers['set-cookie']?.[0]});});request.on('error',reject);request.end(bytes);});
 assert.equal((await send()).status,403);assert.equal((await send('https://evil.example')).status,403);
 const result=await send('https://profile.example');assert.equal(result.status,200);assert.match(result.cookie,/; Secure/);assert.doesNotMatch(result.cookie,/Domain=/i);
});
test('online edits preserve legacy metadata, publish atomically, survive restart and reject conflicts',async t=>{
 const app=await application(t);await app.login();const original=await loadProfile(app.root);
 await saveProfile(app.root,{...original,name:'Existing profile',pronouns:'iel',bio:'Keep biography',customLegacyFlag:'preserved'});
 const current=await(await app.request('/owner-api/profile')).json();
 const update={name:'Edited owner',about:'Changed online',pages:[{id:'gallery',title:'Pictures',type:'gallery',images:[{src:'assets/avatar.svg',caption:'Existing image'}]}],appearance:{theme:'night',accent:'blue',animations:false,readable:true},audioDefaults:{enabled:false,volume:.1,sounds:false}};
 const response=await app.request('/owner-api/profile',{method:'PUT',json:{profile:update,revision:current.revision}});assert.equal(response.status,200);const saved=await response.json();assert.ok(saved.backup);
 const config=await loadProfile(app.root);assert.equal(config.bio,'Keep biography');assert.equal(config.pronouns,'iel');assert.equal(config.customLegacyFlag,'preserved');assert.equal(config.appearance.theme,'night');
 assert.match(await(await app.request('/config.js')).text(),/Edited owner/);assert.equal((await app.request('/owner-api/profile',{method:'PUT',json:{profile:{name:'Stale'},revision:current.revision}})).status,409);
 assert.equal((await app.request('/owner-api/profile',{method:'PUT',json:{profile:{password:'never-public'},revision:saved.revision}})).status,400);
 assert.equal((await app.request('/owner-api/profile',{method:'PUT',json:{profile:{avatar:'.owner/account.json'},revision:saved.revision}})).status,400);
 const bytes=await readFile(path.join(app.root,'user-content/profile.json'));
 const bad=await app.request('/owner-api/profile',{method:'PUT',json:{profile:{avatar:'user-content/media/missing.png'},revision:saved.revision}});assert.equal(bad.status,404);
 assert.deepEqual(await readFile(path.join(app.root,'user-content/profile.json')),bytes);assert.match(await(await app.request('/config.js')).text(),/Edited owner/);
 await app.close();const again=await startOwnerServer({root:app.root,port:0});t.after(()=>again.close());assert.match(await(await fetch(again.url+'/config.js')).text(),/Edited owner/);
});
test('uploads validate signatures and cannot publish active HTML; media range and static protections work',async t=>{
 const app=await application(t);await app.login();
 const invalid=await app.request('/owner-api/media?kind=image&name=x.png',{method:'POST',body:'<script>bad()</script>',headers:{'Content-Type':'application/octet-stream'}});assert.equal(invalid.status,400);
 const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+xjicAAAAASUVORK5CYII=','base64');
 const response=await app.request('/owner-api/media?kind=image&name=picture.png',{method:'POST',body:bytes,headers:{'Content-Type':'application/octet-stream'}});assert.equal(response.status,201);const media=await response.json();
 assert.deepEqual(Buffer.from(await(await app.request(media.preview)).arrayBuffer()),bytes);
 const config=await(await app.request('/owner-api/profile')).json();assert.equal((await app.request('/owner-api/profile',{method:'PUT',json:{profile:{avatar:media.path},revision:config.revision}})).status,200);
 const range=await app.request('/'+media.path,{headers:{Range:'bytes=0-7'}});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,8);
 assert.equal((await app.request('/'+media.path,{headers:{Range:'bytes=999999-'}})).status,416);
});
test('owner update uses existing verified installer and preserves credentials and personal data',async t=>{
 const root=await fixture(t);await configureOwner(root,username,password);
 const update=await updateFixture(root),original=await readFile(path.join(root,'.owner/account.json'));
 const fetchImpl=async url=>String(url).includes('api.github.com')?new Response(JSON.stringify({tag_name:'v1.3.0',body:'Verified fixture',assets:update.release.assets})):new Response(update.bytes);
 const app=await startOwnerServer({root,port:0,fetchImpl});t.after(()=>app.close());
 const login=await fetch(app.url+'/owner-api/login',{method:'POST',headers:{Origin:app.url,'Content-Type':'application/json'},body:JSON.stringify({username,password})});const cookie=login.headers.get('set-cookie').split(';')[0],{csrf}=await login.json();
 const headers={Origin:app.url,Cookie:cookie,'X-CSRF-Token':csrf,'Content-Type':'application/json'};
 assert.equal((await fetch(app.url+'/owner-api/updates',{headers})).status,200);
 assert.equal((await fetch(app.url+'/owner-api/updates/install',{method:'POST',headers,body:JSON.stringify({confirmVersion:'1.4.0'})})).status,409);
 const result=await fetch(app.url+'/owner-api/updates/install',{method:'POST',headers,body:JSON.stringify({confirmVersion:'1.3.0'})});assert.equal(result.status,200);assert.equal((await result.json()).restartRequired,true);
 assert.deepEqual(await readFile(path.join(root,'.owner/account.json')),original);assert.equal((await fetch(app.url+'/owner-api/profile',{headers})).status,401);
});
