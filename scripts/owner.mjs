import { createInterface } from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from '../lib/project.mjs';
import { configureOwner, readOwner } from '../lib/owner-auth.mjs';
import { startOwnerServer } from '../lib/owner-server.mjs';

export async function hiddenPassword(label, input = process.stdin, output = process.stdout) {
  if (!input.isTTY || !input.setRawMode) throw new Error('Use an interactive terminal to enter the owner password.');
  output.write(label + '\n> ');
  const raw = input.isRaw;
  input.setRawMode(true); input.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = (failure) => {
      input.off('data', receive); input.setRawMode(Boolean(raw)); input.pause(); output.write('\n');
      if (failure) reject(failure); else resolve(value);
    };
    function receive(chunk) {
      const text = chunk.toString('utf8');
      if (text.startsWith('\x1b')) return;
      for (const char of text) {
        if (char === '\x03') return finish(new Error('SETUP_EXIT'));
        if (char === '\r' || char === '\n') return finish();
        if (char === '\x7f' || char === '\b') value = [...value].slice(0,-1).join('');
        else if (char >= ' ' && value.length < 128) value += char;
      }
    }
    input.on('data', receive);
  });
}
export async function configureFromTerminal({root = ROOT, reset = false, input = process.stdin, output = process.stdout, ask, secret} = {}) {
  let reader;
  if (!ask) {
    reader = createInterface({input,output,terminal:false});
    const lines = reader[Symbol.asyncIterator]();
    ask = async label => { output.write(label+'\n> '); const line=await lines.next(); if(line.done)throw new Error('SETUP_EXIT'); return line.value.trim(); };
  }
  let username;
  try { username = await ask('Identifiant local / Local identifier (3–64):'); }
  finally { reader?.close(); }
  const prompt = secret || (label => hiddenPassword(label,input,output));
  const password = await prompt('Mot de passe local / Local password (12–128, masqué / hidden):');
  if (password !== await prompt('Confirmer / Confirm password:')) throw new Error('Les mots de passe ne correspondent pas / Passwords do not match.');
  await configureOwner(root,username,password,{reset});
  output.write('Compte local enregistré dans .owner ; aucun compte Nintendo utilisé. / Local account saved in .owner.\n');
}
async function main() {
  const args = process.argv.slice(2), command = args[0] || 'configure';
  const option = name => { const index=args.indexOf(name);return index<0?undefined:args[index+1]; };
  const root=path.resolve(option('--root') || process.env.OWNER_ROOT || ROOT);
  if (command==='configure'||command==='reset') return configureFromTerminal({root,reset:command==='reset'});
  if(command!=='serve') throw new Error('Commands: configure | reset | serve [--root path] [--host 127.0.0.1] [--port 8120] [--origin https://site.example]');
  if(!await readOwner(root)) throw new Error('Configure the local owner account first: node scripts/owner.mjs configure');
  const instance=await startOwnerServer({root,host:option('--host')||'127.0.0.1',port:Number(option('--port')||8120),origin:option('--origin')||''});
  console.log(`Owner backend: ${instance.url}/assets/owner/index.html`);
  console.log('Updates require restarting this backend after installation. Ctrl+C stops it.');
  process.once('SIGINT',()=>void instance.close());process.once('SIGTERM',()=>void instance.close());
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) main().catch(error=>{if(error.message!=='SETUP_EXIT'){console.error(error.message);process.exitCode=1;}});
