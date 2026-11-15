import {mkdir,copyFile,chmod} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {ROOT,exists,managedFiles,checkParents,loadProfile,saveProfile,mediaReferences} from '../lib/project.mjs';

const root=path.resolve(process.env.OWNER_ROOT||'/data/site');
await mkdir(root,{recursive:true});
if(!await exists(path.join(root,'version.json'))){
  for(const file of [...await managedFiles(ROOT),'config.js'].filter(file=>file!=='version.json')){
    const target=await checkParents(root,file);await mkdir(path.dirname(target),{recursive:true});await copyFile(path.join(ROOT,file),target);await chmod(target,file.endsWith('.sh')?0o755:0o644);
  }
  const profile=await loadProfile(ROOT);
  for(const file of mediaReferences(profile)){
    const source=await checkParents(ROOT,file),target=await checkParents(root,file);
    if(!await exists(target)){await mkdir(path.dirname(target),{recursive:true});await copyFile(source,target);}
  }
  await saveProfile(root,profile);
  await copyFile(path.join(ROOT,'version.json'),path.join(root,'version.json'));
}
const {readOwner}=await import(pathToFileURL(path.join(root,'lib/owner-auth.mjs')));
if(!await readOwner(root)){
  console.error('Owner not configured. Run the configure command with an interactive terminal before starting the owner service.');process.exitCode=1;
}else{
  const {startOwnerServer}=await import(pathToFileURL(path.join(root,'lib/owner-server.mjs')));
  const instance=await startOwnerServer({root,host:'0.0.0.0',port:8120,origin:process.env.OWNER_ORIGIN||'http://127.0.0.1:8120'});
  console.log('Owner service listening on port 8120.');
  process.once('SIGTERM',()=>void instance.close());process.once('SIGINT',()=>void instance.close());
}
