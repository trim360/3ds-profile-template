import {DEFAULT_CONFIG} from '../../lib/config.mjs';
const $=id=>document.getElementById(id),site=new URL('../../',import.meta.url),endpoint=new URL('owner-api/',site);
let csrf='',profile,revision='',tab='profil',restart=false;
const panes=[['profil','Profil'],['pages','Pages'],['gallery','Galerie'],['links','Réseaux'],['audio','Audio'],['appearance','Apparence et langue'],['updates','Mises à jour']];
const message=text=>{$('feedback').textContent=text;};
function element(tag,text){const e=document.createElement(tag);if(text)e.textContent=text;return e;}
function button(text,action){const e=element('button',text);e.type='button';e.addEventListener('click',()=>void action());return e;}
async function api(route,options={}){
 const headers={'X-CSRF-Token':csrf,...options.headers};
 if(options.json!==undefined){headers['Content-Type']='application/json';options.body=JSON.stringify(options.json);}
 const response=await fetch(new URL(route,endpoint),{...options,headers,credentials:'same-origin'});
 const result=await response.json();
 if(!response.ok){if(response.status===401){csrf='';$('editor').hidden=true;$('login-form').hidden=false;}throw new Error(result.error||'Requête impossible.');}
 return result;
}
function field(parent,label,value,onChange,{type='text',options,rows}={}){
 const wrap=element('label'),name=element('span',label);wrap.append(name);
 const control=element(options?'select':rows?'textarea':'input');
 if(options)for(const [value,text]of options){const option=element('option',text);option.value=value;control.append(option);}
 if(!options&&!rows)control.type=type;
 if(type==='checkbox'){wrap.className='check';control.checked=Boolean(value);wrap.prepend(control);}
 else{control.value=value??'';wrap.append(control);}
 control.addEventListener(options||type==='checkbox'?'change':'input',()=>onChange(type==='checkbox'?control.checked:type==='number'?Number(control.value):control.value));
 parent.append(wrap);return control;
}
function collection(parent,title,items,create,render){
 const section=element('section');section.className='collection';section.append(element('h3',title));
 const list=element('div');section.append(list);
 function paint(){list.replaceChildren();items.forEach((item,index)=>{const row=element('div');row.className='entry';const heading=element('div');heading.className='entry-header';heading.append(element('strong',`${title} ${index+1}`),button('Retirer',()=>{items.splice(index,1);paint();}));row.append(heading);render(row,item);list.append(row);});}
 section.append(button('Ajouter',()=>{items.push(create());paint();}));paint();parent.append(section);
}
function media(parent,kind,set){
 const row=element('div');row.className='upload';const input=element('input');input.type='file';input.accept=kind==='music'?'.mp3,.ogg,.wav':'.png,.jpg,.jpeg,.gif,.webp';input.setAttribute('aria-label',kind==='music'?'Fichier musical à importer':'Image à importer');
 row.append(input,button('Importer le fichier',async()=>{
  if(!input.files[0])return message('Choisis un fichier avant de l’importer.');
  const file=input.files[0];message('Importation…');
  try{const result=await api('media?kind='+kind+'&name='+encodeURIComponent(file.name),{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});set(result.path);message('Fichier importé. Enregistre le profil pour le publier.');}
  catch(error){message(error.message);}
 }));parent.append(row);
}
function imageRows(parent,items){collection(parent,'Images',items,()=>({src:'',caption:'',credit:''}),(row,item)=>{const src=field(row,'Image (chemin public ou URL)',item.src,value=>item.src=value);media(row,'image',value=>{item.src=value;src.value=value;});field(row,'Légende',item.caption,value=>item.caption=value);field(row,'Crédit de l’image',item.credit,value=>item.credit=value);});}
function linkRows(parent,items){collection(parent,'Liens',items,()=>({name:'',url:'',icon:'assets/network.svg'}),(row,item)=>{field(row,'Nom',item.name,value=>item.name=value);field(row,'Adresse du lien',item.url,value=>item.url=value);field(row,'Icône (nom inclus ou chemin public)',item.icon,value=>item.icon=value);});}
function projectRows(parent,items){collection(parent,'Projets',items,()=>({title:'',description:'',url:'',image:''}),(row,item)=>{for(const [key,label]of [['title','Titre'],['description','Description'],['url','Lien'],['image','Image']])field(row,label,item[key],value=>item[key]=value);media(row,'image',value=>{item.image=value;render();});});}
function render(){
 const panel=$('editor-panel');panel.replaceChildren();
 for(const control of $('editor-tabs').children)control.setAttribute('aria-current',control.dataset.tab===tab?'page':'false');
 panel.append(element('h2',panes.find(p=>p[0]===tab)[1]));
 $('save').hidden=tab==='updates';$('save').disabled=restart;
 if(tab==='profil'){
  for(const [key,label]of [['name','Nom affiché'],['pronouns','Pronoms'],['title','Titre du site'],['domain','Libellé du domaine'],['about','À propos'],['bio','Biographie'],['website','Site web']])field(panel,label,profile[key],value=>profile[key]=value,{rows:['about','bio'].includes(key)?4:undefined});
  for(const [key,label]of [['avatar','Avatar'],['cover','Couverture']]){const input=field(panel,label,profile[key],value=>profile[key]=value);media(panel,'image',value=>{profile[key]=value;input.value=value;});}
  field(panel,'Centres d’intérêt (séparés par une virgule)',profile.interests.join(', '),value=>profile.interests=value.split(',').map(s=>s.trim()).filter(Boolean));
  projectRows(panel,profile.projects);
 }
 if(tab==='gallery')imageRows(panel,profile.gallery);
 if(tab==='links')linkRows(panel,profile.links);
 if(tab==='pages')collection(panel,'Pages',profile.pages,()=>({id:'page-'+Date.now().toString(36),title:'Nouvelle page',type:'custom',content:'',images:[],links:[],traits:[],projects:[],visible:true}),(row,page)=>{
  field(row,'Titre',page.title,value=>page.title=value);field(row,'Identifiant de la page',page.id,value=>page.id=value);
  field(row,'Type',page.type,value=>{page.type=value;render();},{options:[['custom','Texte libre'],['about','À propos'],['gallery','Galerie'],['links','Liens'],['sona','Personnage'],['projects','Projets']]});
  field(row,'Afficher cette page',page.visible!==false,value=>page.visible=value,{type:'checkbox'});
  field(row,'Contenu',page.content,value=>page.content=value,{rows:5});
  if(['gallery','sona','custom'].includes(page.type))imageRows(row,page.images||= []);
  if(page.type==='links')linkRows(row,page.links||= []);
  if(page.type==='projects')projectRows(row,page.projects||= []);
  if(page.type==='sona')collection(row,'Caractéristiques',page.traits||= [],()=>({label:'',value:''}),(item,trait)=>{field(item,'Nom',trait.label,value=>trait.label=value);field(item,'Valeur',trait.value,value=>trait.value=value);});
 });
 if(tab==='audio'){
  const input=field(panel,'Musique (chemin public ou URL)',profile.music,value=>profile.music=value);media(panel,'music',value=>{profile.music=value;input.value=value;});
  field(panel,'Titre du morceau',profile.musicTitle,value=>profile.musicTitle=value);
  field(panel,'Type de droits',profile.musicCredit.owner,value=>profile.musicCredit.owner=value,{options:[['unknown','À préciser'],['nintendo','Nintendo'],['other','Autre auteur'],['legacy','Fichier existant']]});
  field(panel,'Artiste',profile.musicCredit.artist,value=>profile.musicCredit.artist=value);field(panel,'Source et licence',profile.musicCredit.source,value=>profile.musicCredit.source=value);
  field(panel,'J’ai le droit de diffuser ce fichier sur mon site',profile.musicCredit.rightsConfirmed,value=>profile.musicCredit.rightsConfirmed=value,{type:'checkbox'});
  field(panel,'Musique activée par défaut',profile.audioDefaults.enabled,value=>profile.audioDefaults.enabled=value,{type:'checkbox'});
  const volume=field(panel,'Volume initial (0 à 100)',Math.round(profile.audioDefaults.volume*100),value=>profile.audioDefaults.volume=value/100,{type:'number'});volume.min='0';volume.max='100';
  field(panel,'Retour sonore activé par défaut',profile.audioDefaults.sounds,value=>profile.audioDefaults.sounds=value,{type:'checkbox'});
 }
 if(tab==='appearance'){
  field(panel,'Page d’accueil',profile.homePage,value=>profile.homePage=value,{options:[['accueil','Menu principal'],...['profil','reseaux','audio'].filter(id=>profile.sections[id]!==false).map(id=>[id,{profil:'Profil',reseaux:'Réseaux',audio:'Paramètres'}[id]]),...profile.pages.filter(page=>page.visible!==false).map(page=>[page.id,page.title||page.id])]});
  field(panel,'Thème initial',profile.appearance.theme,value=>profile.appearance.theme=value,{options:[['classic','3DS classique'],['light','Clair'],['night','Nuit']]});
  field(panel,'Couleur initiale',profile.appearance.accent,value=>profile.appearance.accent=value,{options:[['orange','Orange eShop'],['red','Rouge 3DS'],['blue','Bleu Internet']]});
  field(panel,'Animations par défaut',profile.appearance.animations,value=>profile.appearance.animations=value,{type:'checkbox'});
  field(panel,'Lisibilité renforcée par défaut',profile.appearance.readable,value=>profile.appearance.readable=value,{type:'checkbox'});
  field(panel,'Langue initiale',profile.language,value=>profile.language=value,{options:[['auto','Langue du navigateur'],['fr','Français'],['en','English']]});
  panel.append(element('p','Les visiteurs conservent leurs propres préférences déjà enregistrées. Ces valeurs s’appliquent aux nouveaux visiteurs.'));
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
async function load(){const data=await api('profile');profile=data.profile;revision=data.revision;$('profile-name').textContent=profile.name||'Mon site';$('avatar').src=new URL(profile.avatar,site).href;$('mode-message').textContent='Connecté au compte propriétaire local';$('login-form').hidden=true;$('editor').hidden=false;render();}
$('login-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;message('Connexion…');try{const data=await api('login',{method:'POST',json:{username:form.elements.username.value,password:form.elements.password.value}});csrf=data.csrf;form.reset();await load();message('Connexion établie.');}catch(error){form.elements.password.value='';message(error.message);}});
$('editor-form').addEventListener('submit',async event=>{event.preventDefault();$('save').disabled=true;message('Enregistrement et export…');try{const visible=['accueil',...['profil','reseaux','audio'].filter(id=>profile.sections[id]!==false),...profile.pages.filter(page=>page.visible!==false).map(page=>page.id)];if(!visible.includes(profile.homePage))profile.homePage='accueil';const clean=Object.fromEntries(Object.keys(DEFAULT_CONFIG).map(key=>[key,profile[key]]));const data=await api('profile',{method:'PUT',json:{profile:clean,revision}});profile=data.profile;revision=data.revision;message('Modifications publiées. '+(data.backup?'Sauvegarde : '+data.backup:''));}catch(error){message(error.message);}finally{$('save').disabled=restart;}});
$('reload').addEventListener('click',()=>void load().then(()=>message('Données rechargées.')).catch(error=>message(error.message)));
$('logout').addEventListener('click',()=>void api('logout',{method:'POST'}).then(()=>{csrf='';profile=null;$('editor').hidden=true;$('login-form').hidden=false;message('Déconnecté.');}).catch(error=>message(error.message)));
$('forgot').addEventListener('click',()=>$('recovery').showModal());$('close-recovery').addEventListener('click',()=>$('recovery').close());
for(const [id,label]of panes){const control=button(label,()=>{tab=id;render();});control.dataset.tab=id;$('editor-tabs').append(control);}
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
