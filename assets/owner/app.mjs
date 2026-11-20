import {DEFAULT_CONFIG} from '../../lib/config.mjs';
import {DEFAULT_CUSTOM,CUSTOM_KEYS,CONTRAST_RULES,contrastRatio,customProblems,normalizeCustom} from '../../lib/theme.mjs';
const $=id=>document.getElementById(id),site=new URL('../../',import.meta.url),endpoint=new URL('owner-api/',site);
let csrf='',profile,revision='',published='',tab='profil',restart=false,previewHash='',previewTimer=0,previewReady=false;
const panes=[['profil','Profil'],['pages','Pages'],['gallery','Galerie'],['links','Réseaux'],['audio','Audio'],['appearance','Apparence et langue'],['backups','Sauvegardes'],['updates','Mises à jour']];
const message=text=>{$('feedback').textContent=text;};
function element(tag,text){const e=document.createElement(tag);if(text)e.textContent=text;return e;}
function button(text,action,label){const e=element('button',text);e.type='button';if(label)e.setAttribute('aria-label',label);e.addEventListener('click',()=>void action());return e;}
async function api(route,options={}){
 const headers={'X-CSRF-Token':csrf,...options.headers};
 if(options.json!==undefined){headers['Content-Type']='application/json';options.body=JSON.stringify(options.json);}
 const response=await fetch(new URL(route,endpoint),{...options,headers,credentials:'same-origin'});
 const result=await response.json();
 if(!response.ok){if(response.status===401){csrf='';showLogin();}throw new Error(result.error||'Requête impossible.');}
 return result;
}
// The configuration sent to the server only contains schema keys (stored profiles may carry extra bookkeeping keys).
const clean=()=>Object.fromEntries(Object.keys(DEFAULT_CONFIG).map(key=>[key,profile[key]]));
const dirty=()=>Boolean(profile)&&JSON.stringify(clean())!==published;
function showLogin(){profile=null;$('editor').hidden=true;$('login-form').hidden=false;$('preview-screen').hidden=true;$('identity-screen').hidden=false;}
function updateDirty(){const changed=dirty();$('dirty').hidden=!changed;$('dirty').textContent=changed?'Modifications non enregistrées':'';$('discard').disabled=!changed;$('save-state').textContent=changed?'Brouillon non publié':'Tout est publié';$('save-state').dataset.state=changed?'draft':'saved';}
function changed(){updateDirty();clearTimeout(previewTimer);previewTimer=setTimeout(()=>void pushPreview(),500);}
async function pushPreview(){
 if(!profile)return;
 try{
  await api('preview',{method:'POST',json:{profile:clean()}});$('preview-status').textContent='';
  const frame=$('preview'),base=new URL('owner-api/preview/index.html',site);
  if(!previewReady){frame.src=base.href+(previewHash?'#'+previewHash:'');previewReady=true;}
  else{try{frame.contentWindow.location.reload();}catch{frame.src=base.href+(previewHash?'#'+previewHash:'');}}
 }catch(error){$('preview-status').textContent='Aperçu indisponible : '+error.message;}
}
function showInPreview(hash){previewHash=hash;try{if(previewReady)$('preview').contentWindow.location.hash=hash;}catch{}}
function confirmDialog(text,confirmLabel='Confirmer'){
 return new Promise(resolve=>{
  const dialog=$('confirm');$('confirm-text').textContent=text;$('confirm-yes').textContent=confirmLabel;
  const done=value=>{dialog.close();$('confirm-yes').onclick=$('confirm-no').onclick=null;dialog.onclose=null;resolve(value);};
  $('confirm-yes').onclick=()=>done(true);$('confirm-no').onclick=()=>done(false);dialog.onclose=()=>resolve(false);dialog.showModal();
 });
}
function field(parent,label,value,onChange,{type='text',options,rows}={}){
 const wrap=element('label'),name=element('span',label);wrap.append(name);
 const control=element(options?'select':rows?'textarea':'input');
 if(options)for(const [value,text]of options){const option=element('option',text);option.value=value;control.append(option);}
 if(!options&&!rows)control.type=type;
 if(type==='checkbox'){wrap.className='check';control.checked=Boolean(value);wrap.prepend(control);}
 else{control.value=value??'';wrap.append(control);}
 control.addEventListener(options||type==='checkbox'?'change':'input',()=>{onChange(type==='checkbox'?control.checked:type==='number'?Number(control.value):control.value);changed();});
 parent.append(wrap);return control;
}
function move(items,from,to){if(from===to||to<0||to>=items.length)return;items.splice(to,0,items.splice(from,1)[0]);}
// Generic list editor. options.pages enables reordering, duplication and confirmed removal.
function collection(parent,title,items,create,render,{pages=false,onChange=()=>{}}={}){
 const section=element('section');section.className='collection';section.append(element('h3',title));
 const list=element('div');section.append(list);let dragged=-1;
 function paint(){list.replaceChildren();items.forEach((item,index)=>{
  const row=element('div');row.className='entry';const heading=element('div');heading.className='entry-header';
  const label=pages?(item.title||item.id):`${title} ${index+1}`;
  heading.append(element('strong',label));
  const actions=element('div');actions.className='entry-actions';
  if(pages){
   row.draggable=true;row.dataset.index=String(index);
   row.addEventListener('dragstart',event=>{dragged=index;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',String(index));row.classList.add('dragging');});
   row.addEventListener('dragend',()=>{row.classList.remove('dragging');dragged=-1;});
   row.addEventListener('dragover',event=>{if(dragged>=0){event.preventDefault();event.dataTransfer.dropEffect='move';}});
   row.addEventListener('drop',event=>{event.preventDefault();if(dragged<0)return;move(items,dragged,index);dragged=-1;paint();onChange();changed();});
   actions.append(button('↑',()=>{move(items,index,index-1);paint();onChange();changed();},`Monter ${label}`),button('↓',()=>{move(items,index,index+1);paint();onChange();changed();},`Descendre ${label}`),
    button('Voir',()=>showInPreview(item.id),`Voir ${label} dans l’aperçu`),
    button('Dupliquer',()=>{const copy=structuredClone(item);let n=2;const taken=new Set(items.map(entry=>entry.id));while(taken.has(`${item.id}-${n}`.slice(0,64)))n++;copy.id=`${item.id}-${n}`.slice(0,64);copy.title=`${item.title||item.id} (copie)`;items.splice(index+1,0,copy);paint();onChange();changed();},`Dupliquer ${label}`));
  }
  actions.append(button('Retirer',async()=>{
   if(pages&&!await confirmDialog(`Retirer la page « ${label} » du brouillon ? Son contenu reste récupérable dans « Pages supprimées » après publication.`,'Retirer'))return;
   items.splice(index,1);paint();onChange();changed();},`Retirer ${label}`));
  heading.append(actions);row.append(heading);render(row,item);
  if(pages){const verbs=['Monter','Descendre','Voir dans l’aperçu','Dupliquer','Retirer'];
   // Keep the heading and the accessible names of the row buttons in step with the page title while it is typed.
   row.addEventListener('input',()=>{const name=item.title||item.id;heading.firstChild.textContent=name;[...actions.children].forEach((control,i)=>control.setAttribute('aria-label',i===2?`Voir ${name} dans l’aperçu`:`${verbs[i===3?3:i===4?4:i]} ${name}`));});}
  list.append(row);});}
 section.append(button('Ajouter',()=>{items.push(create());paint();onChange();changed();}));paint();parent.append(section);
}
function media(parent,kind,set){
 const row=element('div');row.className='upload';const input=element('input');input.type='file';input.accept=kind==='music'?'.mp3,.ogg,.wav':'.png,.jpg,.jpeg,.gif,.webp';input.setAttribute('aria-label',kind==='music'?'Fichier musical à importer':'Image à importer');
 row.append(input,button('Importer le fichier',async()=>{
  if(!input.files[0])return message('Choisis un fichier avant de l’importer.');
  const file=input.files[0];message('Importation…');
  try{const result=await api('media?kind='+kind+'&name='+encodeURIComponent(file.name),{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});set(result.path);changed();message('Fichier importé. Il apparaît dans l’aperçu ; publie pour l’enregistrer.');}
  catch(error){message(error.message);}
 }));parent.append(row);
}
function imageRows(parent,items){collection(parent,'Images',items,()=>({src:'',caption:'',credit:''}),(row,item)=>{const src=field(row,'Image (chemin public ou URL)',item.src,value=>item.src=value);media(row,'image',value=>{item.src=value;src.value=value;});field(row,'Légende',item.caption,value=>item.caption=value);field(row,'Crédit de l’image',item.credit,value=>item.credit=value);});}
function linkRows(parent,items){collection(parent,'Liens',items,()=>({name:'',url:'',icon:'assets/network.svg'}),(row,item)=>{field(row,'Nom',item.name,value=>item.name=value);field(row,'Adresse du lien',item.url,value=>item.url=value);field(row,'Icône (nom inclus ou chemin public)',item.icon,value=>item.icon=value);});}
function projectRows(parent,items){collection(parent,'Projets',items,()=>({title:'',description:'',url:'',image:''}),(row,item)=>{for(const [key,label]of [['title','Titre'],['description','Description'],['url','Lien'],['image','Image']])field(row,label,item[key],value=>item[key]=value);media(row,'image',value=>{item.image=value;render();});},{onChange:render});}
const customLabels={primary:'Couleur principale (liens, accent)',secondary:'Couleur secondaire (icônes)',button:'Boutons',background:'Fond de la page',border:'Bordures',selection:'Sélection (survol)',text:'Texte',window:'Fond des panneaux'};
function customTheme(parent){
 const box=element('fieldset'),legend=element('legend','Couleurs du thème personnalisé'),report=element('div');report.setAttribute('role','status');report.className='contrast-report';
 box.append(legend);profile.appearance.custom=normalizeCustom(profile.appearance.custom);
 function check(){const problems=customProblems(profile.appearance.custom);report.replaceChildren();
  if(!problems.length)report.append(element('p','Lisibilité vérifiée : tous les contrastes sont suffisants.'));
  else{report.append(element('p','Lisibilité insuffisante : ce thème ne peut pas être publié tant que ces contrastes ne sont pas corrigés.'));const list=element('ul');for(const problem of problems)list.append(element('li',`${problem.label} : ${problem.ratio}:1 (minimum ${problem.minimum}:1)`));report.append(list);}
  $('save').disabled=restart||problems.length>0;}
 for(const key of CUSTOM_KEYS){const input=field(box,customLabels[key],profile.appearance.custom[key],value=>{profile.appearance.custom[key]=value;check();},{type:'color'});input.setAttribute('aria-label',customLabels[key]);}
 box.append(button('Revenir aux couleurs par défaut',()=>{profile.appearance.custom={...DEFAULT_CUSTOM};changed();render();}),report);parent.append(box);check();
}
function uniquePageId(base){const taken=new Set(profile.pages.map(page=>page.id));let id=base,n=2;while(taken.has(id))id=`${base}-${n++}`.slice(0,64);return id;}
function deletedPagesPanel(parent){
 const box=element('section');box.className='collection';box.append(element('h3','Pages supprimées'));
 const result=element('div');
 box.append(element('p','Une page retirée puis publiée reste récupérable ici tant que son fichier n’est pas effacé à la main.'),button('Afficher les pages supprimées',async()=>{
  try{const data=await api('pages/deleted');result.replaceChildren();
   if(!data.pages.length)return result.append(element('p','Aucune page supprimée à restaurer.'));
   for(const item of data.pages){const row=element('div');row.className='entry';const heading=element('div');heading.className='entry-header';heading.append(element('strong',item.page.title||item.page.id),element('span',new Date(item.time).toLocaleString('fr-FR')));
    heading.append(button('Restaurer',()=>{const page=structuredClone(item.page);page.id=uniquePageId(page.id);profile.pages.push(page);changed();render();message(`Page « ${page.title||page.id} » ajoutée au brouillon. Publie pour la conserver.`);},`Restaurer ${item.page.title||item.page.id}`));row.append(heading);result.append(row);}
  }catch(error){message(error.message);}
 }),result);parent.append(box);
}
function render(){
 const panel=$('editor-panel');panel.replaceChildren();
 for(const control of $('editor-tabs').children)control.setAttribute('aria-current',control.dataset.tab===tab?'page':'false');
 panel.append(element('h2',panes.find(p=>p[0]===tab)[1]));
 $('save').hidden=['updates','backups'].includes(tab);$('save').disabled=restart;
 if(tab==='profil'){
  for(const [key,label]of [['name','Nom affiché'],['pronouns','Pronoms'],['title','Titre du site'],['domain','Libellé du domaine'],['about','À propos'],['bio','Biographie'],['website','Site web']])field(panel,label,profile[key],value=>profile[key]=value,{rows:['about','bio'].includes(key)?4:undefined});
  for(const [key,label]of [['avatar','Avatar'],['cover','Couverture']]){const input=field(panel,label,profile[key],value=>profile[key]=value);media(panel,'image',value=>{profile[key]=value;input.value=value;});}
  field(panel,'Centres d’intérêt (séparés par une virgule)',profile.interests.join(', '),value=>profile.interests=value.split(',').map(s=>s.trim()).filter(Boolean));
  const list=value=>value.split(',').map(item=>item.trim()).filter(Boolean);
  field(panel,'Statut personnalisé (une phrase courte)',profile.status,value=>profile.status=value);
  field(panel,'Jeux favoris (séparés par une virgule)',profile.favoriteGames.join(', '),value=>profile.favoriteGames=list(value));
  field(panel,'Consoles possédées (séparées par une virgule)',profile.consoles.join(', '),value=>profile.consoles=list(value));
  const zone=field(panel,'Fuseau horaire (ex. Europe/Paris, laisser vide pour ne rien afficher)',profile.timezone,value=>profile.timezone=value);
  try{const zones=Intl.supportedValuesOf('timeZone'),datalist=element('datalist');datalist.id='time-zones';for(const name of zones){const option=element('option');option.value=name;datalist.append(option);}zone.setAttribute('list','time-zones');panel.append(datalist);}catch{}
  const color=field(panel,'Couleur personnelle (cadre de la photo et du nom)',profile.personalColor||'#a76923',value=>profile.personalColor=value,{type:'color'});
  panel.append(button('Retirer la couleur personnelle',()=>{profile.personalColor='';color.value='#a76923';changed();},'Retirer la couleur personnelle'));
  const mascot=element('fieldset');mascot.append(element('legend','Personnage ou mascotte'));
  field(mascot,'Nom',profile.mascot.name,value=>profile.mascot.name=value);
  const mascotImage=field(mascot,'Image (chemin public ou URL)',profile.mascot.image,value=>profile.mascot.image=value);media(mascot,'image',value=>{profile.mascot.image=value;mascotImage.value=value;});
  field(mascot,'Crédit de l’image',profile.mascot.credit,value=>profile.mascot.credit=value);panel.append(mascot);
  projectRows(panel,profile.projects);
 }
 if(tab==='gallery')imageRows(panel,profile.gallery);
 if(tab==='links')linkRows(panel,profile.links);
 if(tab==='pages'){
  collection(panel,'Pages',profile.pages,()=>({id:uniquePageId('page-'+Date.now().toString(36)),title:'Nouvelle page',type:'custom',content:'',images:[],links:[],traits:[],projects:[],visible:true}),(row,page)=>{
   field(row,'Titre',page.title,value=>page.title=value);field(row,'Identifiant de la page',page.id,value=>page.id=value);
   field(row,'Type',page.type,value=>{page.type=value;render();},{options:[['custom','Texte libre'],['about','À propos'],['gallery','Galerie'],['links','Liens'],['sona','Personnage'],['projects','Projets']]});
   field(row,'Page publiée (décocher pour la garder en brouillon, invisible des visiteurs)',page.visible!==false,value=>page.visible=value,{type:'checkbox'});
   const icon=field(row,'Icône du menu (chemin public ou URL)',page.icon||'',value=>page.icon=value);media(row,'image',value=>{page.icon=value;icon.value=value;});
   field(row,'Contenu',page.content,value=>page.content=value,{rows:5});
   if(['gallery','sona','custom'].includes(page.type))imageRows(row,page.images||= []);
   if(page.type==='links')linkRows(row,page.links||= []);
   if(page.type==='projects')projectRows(row,page.projects||= []);
   if(page.type==='sona')collection(row,'Caractéristiques',page.traits||= [],()=>({label:'',value:''}),(item,trait)=>{field(item,'Nom',trait.label,value=>trait.label=value);field(item,'Valeur',trait.value,value=>trait.value=value);});
  },{pages:true,onChange:render});
  deletedPagesPanel(panel);
 }
 if(tab==='audio'){
  const input=field(panel,'Musique (chemin public ou URL)',profile.music,value=>profile.music=value);media(panel,'music',value=>{profile.music=value;input.value=value;});
  field(panel,'Titre du morceau',profile.musicTitle,value=>profile.musicTitle=value);
  field(panel,'Type de droits',profile.musicCredit.owner,value=>profile.musicCredit.owner=value,{options:[['unknown','À préciser'],['nintendo','Nintendo'],['other','Autre auteur'],['legacy','Fichier existant']]});
  field(panel,'Artiste',profile.musicCredit.artist,value=>profile.musicCredit.artist=value);field(panel,'Source et licence',profile.musicCredit.source,value=>profile.musicCredit.source=value);
  field(panel,'J’ai le droit de diffuser ce fichier sur mon site',profile.musicCredit.rightsConfirmed,value=>profile.musicCredit.rightsConfirmed=value,{type:'checkbox'});
  field(panel,'Musique activée par défaut',profile.audioDefaults.enabled,value=>profile.audioDefaults.enabled=value,{type:'checkbox'});
  const volume=field(panel,'Volume initial (0 à 100)',Math.round(profile.audioDefaults.volume*100),value=>profile.audioDefaults.volume=value/100,{type:'number'});volume.min='0';volume.max='100';
  field(panel,'Lire la musique en boucle',profile.audioDefaults.loop===true,value=>profile.audioDefaults.loop=value,{type:'checkbox'});
  field(panel,'Retour sonore activé par défaut',profile.audioDefaults.sounds,value=>profile.audioDefaults.sounds=value,{type:'checkbox'});
 }
 if(tab==='appearance'){
  field(panel,'Page d’accueil',profile.homePage,value=>profile.homePage=value,{options:[['accueil','Menu principal'],...['profil','reseaux','audio'].filter(id=>profile.sections[id]!==false).map(id=>[id,{profil:'Profil',reseaux:'Réseaux',audio:'Paramètres'}[id]]),...profile.pages.filter(page=>page.visible!==false).map(page=>[page.id,page.title||page.id])]});
  field(panel,'Thème initial',profile.appearance.theme,value=>{profile.appearance.theme=value;profile.appearance.custom=normalizeCustom(profile.appearance.custom);render();},{options:[['classic','3DS classique'],['light','Clair'],['night','Nuit'],['dsi','Style Nintendo DSi'],['eshop','Style eShop'],['network','Bleu Network'],['custom','Thème personnalisé']]});
  if(profile.appearance.theme==='custom')customTheme(panel);
  field(panel,'Couleur initiale',profile.appearance.accent,value=>profile.appearance.accent=value,{options:[['orange','Orange eShop'],['red','Rouge 3DS'],['blue','Bleu Internet']]});
  field(panel,'Taille du texte par défaut',profile.appearance.textSize,value=>profile.appearance.textSize=value,{options:[['small','Plus petit'],['normal','Normal'],['large','Plus grand'],['xlarge','Très grand']]});
  field(panel,'Forme des boutons et des cartes',profile.appearance.shape,value=>profile.appearance.shape=value,{options:[['soft','Arrondie (3DS)'],['square','Carrée'],['round','Très arrondie']]});
  field(panel,'Espacement des menus',profile.appearance.spacing,value=>profile.appearance.spacing=value,{options:[['compact','Compact'],['normal','Normal'],['roomy','Aéré']]});
  field(panel,'Disposition du menu',profile.appearance.layout,value=>profile.appearance.layout=value,{options:[['grid','Grille (3 colonnes)'],['list','Liste'],['compact','Grille compacte (4 colonnes)']]});
  field(panel,'Style des panneaux',profile.appearance.panel,value=>profile.appearance.panel=value,{options:[['raised','En relief'],['flat','Plat'],['outlined','Contour seul']]});
  field(panel,'Décorations (textures, séparateurs pointillés, ombres)',profile.appearance.decorations!==false,value=>profile.appearance.decorations=value,{type:'checkbox'});
  field(panel,'Intensité des animations',profile.appearance.motion,value=>profile.appearance.motion=value,{options:[['full','Complète'],['soft','Douce (sans mouvement)']]});
  field(panel,'Animations par défaut',profile.appearance.animations,value=>profile.appearance.animations=value,{type:'checkbox'});
  field(panel,'Lisibilité renforcée par défaut',profile.appearance.readable,value=>profile.appearance.readable=value,{type:'checkbox'});
  field(panel,'Langue initiale',profile.language,value=>profile.language=value,{options:[['auto','Langue du navigateur'],['fr','Français'],['en','English']]});
  panel.append(element('p','Les visiteurs conservent leurs propres préférences déjà enregistrées. Ces valeurs s’appliquent aux nouveaux visiteurs.'));
 }
 if(tab==='backups'){
  panel.append(element('p','Une sauvegarde du profil est créée à chaque publication. Restaurer une sauvegarde publie son contenu après avoir sauvegardé l’état actuel : rien n’est perdu.'));
  const result=element('div');panel.append(result);
  (async()=>{
   try{const data=await api('backups');
    if(!data.backups.length)return result.append(element('p','Aucune sauvegarde pour le moment. La première sera créée à ta prochaine publication.'));
    for(const item of data.backups){const row=element('div');row.className='entry';const heading=element('div');heading.className='entry-header';
     heading.append(element('strong',new Date(item.time).toLocaleString('fr-FR')),element('span',`${item.name||'Sans nom'} · ${item.pages} page${item.pages>1?'s':''}`));
     heading.append(button('Restaurer',async()=>{
      const warning=dirty()?' Tes modifications non publiées seront abandonnées.':'';
      if(!await confirmDialog(`Restaurer la sauvegarde du ${new Date(item.time).toLocaleString('fr-FR')} ?${warning} L’état actuel sera sauvegardé avant.`,'Restaurer'))return;
      try{message('Restauration…');const restored=await api('backups/restore',{method:'POST',json:{id:item.id,revision}});setProfile(restored.profile,restored.revision);message('Sauvegarde restaurée et publiée.');render();void pushPreview();}catch(error){message(error.message);}
     },`Restaurer la sauvegarde du ${new Date(item.time).toLocaleString('fr-FR')}`));row.append(heading);result.append(row);}
   }catch(error){message(error.message);}
  })();
 }
 if(tab==='updates'){
  panel.append(element('p','La recherche et l’installation sont réservées à ce compte. Les scripts setup.bat, setup.sh et scripts/update.mjs restent utilisables en local.'));
  const result=element('div');
  panel.append(button('Vérifier les mises à jour',async()=>{
   message('Vérification de la version officielle…');result.replaceChildren();
   try{const data=await api('updates');result.append(element('p','Version installée : '+data.version));
    if(!data.release)return message('Aucune version stable plus récente disponible.');
    result.append(element('h3','Version '+data.release.version),element('pre',data.release.body));
    const confirm=field(result,'Version à confirmer avant installation', '',()=>{});
    result.append(button('Sauvegarder et installer',async()=>{
     if(confirm.value!==data.release.version)return message('Recopie la version affichée pour confirmer.');
     try{const installed=await api('updates/install',{method:'POST',json:{confirmVersion:confirm.value}});restart=installed.restartRequired;$('save').disabled=true;message('Mise à jour sauvegardée et installée. Redémarre le backend avec la même commande, ou docker compose --profile owner restart owner. Reconnecte-toi ensuite.');result.replaceChildren();}
     catch(error){message(error.message);}
    }));message('Version disponible ; aucune installation n’a encore été effectuée.');
   }catch(error){message(error.message);}
  }),result);
 }
}
function setProfile(value,nextRevision){profile=structuredClone(value);revision=nextRevision;published=JSON.stringify(clean());updateDirty();}
async function load(){
 const data=await api('profile');setProfile(data.profile,data.revision);
 $('profile-name').textContent=profile.name||'Mon site';$('avatar').src=new URL(profile.avatar,site).href;$('mode-message').textContent='Connecté au compte propriétaire local';
 $('login-form').hidden=true;$('editor').hidden=false;$('identity-screen').hidden=true;$('preview-screen').hidden=false;previewReady=false;render();await pushPreview();
}
$('login-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;message('Connexion…');try{const data=await api('login',{method:'POST',json:{username:form.elements.username.value,password:form.elements.password.value}});csrf=data.csrf;form.reset();await load();message('Connexion établie.');}catch(error){form.elements.password.value='';message(error.message);}});
$('editor-form').addEventListener('submit',async event=>{
 event.preventDefault();$('save').disabled=true;message('Enregistrement et export…');
 try{
  const visible=['accueil',...['profil','reseaux','audio'].filter(id=>profile.sections[id]!==false),...profile.pages.filter(page=>page.visible!==false).map(page=>page.id)];
  if(!visible.includes(profile.homePage))profile.homePage='accueil';
  const data=await api('profile',{method:'PUT',json:{profile:clean(),revision}});
  setProfile(data.profile,data.revision);message('Modifications publiées. '+(data.backup?'Sauvegarde : '+data.backup:''));render();void pushPreview();
 }catch(error){message(error.message);}finally{$('save').disabled=restart;}
});
$('discard').addEventListener('click',async()=>{
 if(!dirty())return;
 if(!await confirmDialog('Annuler toutes les modifications non publiées ? Le brouillon reviendra à la version publiée.','Annuler les modifications'))return;
 profile=structuredClone(JSON.parse(published));updateDirty();render();void pushPreview();message('Modifications annulées.');
});
$('reload').addEventListener('click',()=>void load().then(()=>message('Données rechargées.')).catch(error=>message(error.message)));
$('logout').addEventListener('click',()=>void api('logout',{method:'POST'}).then(()=>{csrf='';showLogin();message('Déconnecté.');}).catch(error=>message(error.message)));
window.addEventListener('beforeunload',event=>{if(dirty()){event.preventDefault();event.returnValue='';}});
$('forgot').addEventListener('click',()=>$('recovery').showModal());$('close-recovery').addEventListener('click',()=>$('recovery').close());
function tabKeys(event){
 const tabs=[...$('editor-tabs').children],index=tabs.indexOf(document.activeElement);if(index<0||!['ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;
 event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next].focus();
}
for(const [id,label]of panes){const control=button(label,()=>{tab=id;render();});control.dataset.tab=id;$('editor-tabs').append(control);}
$('editor-tabs').addEventListener('keydown',tabKeys);
async function bootstrap(){
 $('retry').hidden=true;
 try{
  const response=await fetch(new URL('status',endpoint),{credentials:'same-origin'});
  if(response.status===404||!response.headers.get('content-type')?.includes('application/json')){$('static-mode').hidden=false;$('mode-message').textContent='Site statique · édition avec Easy Setup';return;}
  const status=await response.json();if(!response.ok)throw new Error(status.error||'Backend indisponible.');
  $('profile-name').textContent=status.name||'Mon site';if(status.avatar)$('avatar').src=new URL(status.avatar,site).href;
  $('unconfigured').hidden=status.configured;$('login-form').hidden=!status.configured;$('mode-message').textContent=status.configured?'Entre ton identifiant et ton mot de passe locaux.':'Configuration locale nécessaire.';
  restart=status.restartRequired;if(status.authenticated){csrf=status.csrf;await load();}
 }catch(error){message(error.message);$('retry').hidden=false;$('mode-message').textContent='Backend indisponible.';}
}
$('retry').addEventListener('click',()=>void bootstrap());await bootstrap();
