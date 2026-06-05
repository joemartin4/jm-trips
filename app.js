import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, onSnapshot, setDoc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

/* ══════════ WEATHER & COLORS ══════════ */
const WX=[
  {i:'🌧️',d:'Lluvioso',h:29,l:26,t:'Lleva paraguas hoy'},
  {i:'⛅',d:'Nublado',h:29,l:25,t:'Puede lloviznar por la tarde'},
  {i:'🌦️',d:'Lluvia parcial',h:28,l:26,t:'Aguacero probable al atardecer'},
  {i:'⛅',d:'Nublado',h:29,l:26,t:'Fresco por la mañana'},
  {i:'🌧️',d:'Lluvioso',h:28,l:25,t:'Paraguas recomendado todo el día'},
  {i:'🌦️',d:'Lluvia parcial',h:29,l:26,t:'Mañana despejada, tarde lluvia'},
  {i:'⛅',d:'Mayormente nublado',h:29,l:25,t:'Buen día para actividades matutinas'},
  {i:'🌤️',d:'Parcialmente soleado',h:30,l:26,t:'¡Mejor día de la semana! ☀️'},
  {i:'🌦️',d:'Lluvia parcial',h:28,l:25,t:'Cubrirse al salir del Canal'},
  {i:'🌧️',d:'Lluvioso',h:28,l:26,t:'Playa cubierta en Taboga'},
  {i:'⛅',d:'Nublado',h:29,l:25,t:'Buen día para salida temprana'},
];
const CC={Comida:'#4a7c59',Turismo:'#3d7ca8',Hotel:'#6a6db5',Logística:'#666',Transporte:'#888',Tour:'#a05a30',Playa:'#3d7ca8',Actividad:'#9a3060',Espiritual:'#6a6db5',Evento:'#9a7a20',Libre:'#555',Ocio:'#3d7ca8'};

// Outfit categories
const OCAT={
  superior:{label:'Prenda Superior',icon:'👕',color:'#3d7ca8'},
  inferior:{label:'Prenda Inferior',icon:'👖',color:'#4a7c59'},
  conjunto:{label:'Conjunto Completo',icon:'👔',color:'#6a6db5'},
  calzado:{label:'Calzado',icon:'👟',color:'#a05a30'},
  accesorios:{label:'Accesorios',icon:'🎒',color:'#9a7a20'}
};
const OCAT_KEYS=Object.keys(OCAT);

// Expense categories with colors
const GCAT={
  'Comida / Restaurante':'#4a7c59',
  'Transporte':'#888',
  'Turismo / Entrada':'#a05a30',
  'Souvenirs / Compras':'#9a7a20',
  'Hotel / Alojamiento':'#6a6db5',
  'Entretenimiento':'#9a3060',
  'Farmacia / Salud':'#3d8c7a',
  'Otros':'#555'
};
const GCATS=Object.keys(GCAT);

/* ══════════ STORAGE & FIREBASE ══════════ */
const firebaseConfig = {
  apiKey: "AIzaSyDhlyfT6_mTtsy7tKmED8rP0AfYs3LVzro",
  authDomain: "jm-trips.firebaseapp.com",
  projectId: "jm-trips",
  storageBucket: "jm-trips.firebasestorage.app",
  messagingSenderId: "295499693424",
  appId: "1:295499693424:web:0f56978753af88c6e1a3b5"
};
const fApp = initializeApp(firebaseConfig);
const db = getFirestore(fApp);
const auth = getAuth(fApp);
const googleProvider = new GoogleAuthProvider();

let currentUser = null;
let currentTripId = null;
let currentTripRef = null;
let unsubTrip = null;
let isSyncing = false;
let tripMembers = [];
let armario = [];
let unsubArmario = null;
let wardrobeFilter = 'all';
let wardrobeSort = 'added';
let selectedClothForDates = null;
let selectedWardrobeClothes = new Set();
let activeDayForWardrobe = null;
let uploadingClothImage = null;
let isAnalyzingImage = false;

/* ── Save ── */
async function saveState(){
  if (isSyncing) return;
  const gastosObj = {};
  gastos.forEach((g, i) => { gastosObj[i] = g; });
  const outfitsObj = {};
  outfits.forEach((o, i) => { outfitsObj[i] = o; });
  const data = { P, IT, gastos: gastosObj, outfits: outfitsObj, people, nid, ngid, noid, openDays: [...openDays] };
  try{ localStorage.setItem('jmtrips_v1', JSON.stringify(data)); }catch(e){}
  if(currentTripRef){
    try { await setDoc(currentTripRef, data, { merge: true }); }
    catch(e){ console.error("Firebase save error", e); }
  }
}

/* ── Load from a Firestore data object ── */
function applyTripData(data){
  if(data.P) P = data.P;
  if(data.IT) IT = data.IT;
  if(data.gastos){
    const g = Array(11).fill(null).map(()=>[]);
    for(let i=0;i<11;i++) if(data.gastos[i]) g[i]=data.gastos[i];
    gastos = g;
  }
  if(data.outfits){
    const o = Array(11).fill(null).map(()=>[]);
    for(let i=0;i<11;i++) if(data.outfits[i]) o[i]=data.outfits[i];
    outfits = o;
  }
  if(data.people){ people=data.people; if(people.length>0&&!activePerson) activePerson=people[0]; }
  if(data.nid) nid=data.nid;
  if(data.ngid) ngid=data.ngid;
  if(data.noid) noid=data.noid;
  if(data.openDays) openDays=new Set(data.openDays);
  if(data.memberEmails) tripMembers=data.memberEmails;
}

/* ── Load from localStorage (cache) ── */
function loadLocalState(){
  try{
    const raw=localStorage.getItem('jmtrips_v1');
    if(raw){ const s=JSON.parse(raw); applyTripData(s); }
  }catch(e){}
}

/* ── Real-time sync listener ── */
function startTripSync(){
  if(unsubTrip) unsubTrip();
  if(!currentTripRef) return;
  unsubTrip = onSnapshot(currentTripRef, (snap)=>{
    if(snap.exists()){
      isSyncing=true;
      applyTripData(snap.data());
      if($('pcount')) $('pcount').textContent=P;
      render();
      isSyncing=false;
    }
  });
}

function startArmarioSync(){
  if(unsubArmario) unsubArmario();
  if(!currentTripRef) return;
  const colRef = collection(db, 'trips', currentTripId, 'armario');
  unsubArmario = onSnapshot(colRef, (snap)=>{
    armario = [];
    snap.forEach(docSnap => {
      armario.push({ id: docSnap.id, ...docSnap.data() });
    });
    if(VIEW === 'armario') render();
  });
}

/* ══════════ AUTH & TRIP MANAGEMENT ══════════ */
window.googleLogin = function googleLogin(){
  const errEl=$('login-error');
  if(errEl) errEl.textContent='';
  signInWithPopup(auth, googleProvider).catch(err=>{
    console.error("Login error:", err);
    if(errEl) errEl.textContent='Error al iniciar sesión. Intenta de nuevo.';
  });
}

window.logout = function logout(){
  if(!confirm('¿Cerrar sesión?')) return;
  signOut(auth);
}

async function loadUserTrip(){
  const q = query(collection(db,'trips'), where('memberEmails','array-contains', currentUser.email));
  const snap = await getDocs(q);
  if(!snap.empty){
    const tripDoc=snap.docs[0];
    currentTripId=tripDoc.id;
    currentTripRef=doc(db,'trips',currentTripId);
    applyTripData(tripDoc.data());
    startTripSync();
    startArmarioSync();
  } else {
    await migrateOrCreateTrip();
  }
}

async function migrateOrCreateTrip(){
  // Try old trips/main document first
  try{
    const mainSnap=await getDoc(doc(db,'trips','main'));
    if(mainSnap.exists()) applyTripData(mainSnap.data());
    else loadLocalState();
  }catch(e){ loadLocalState(); }
  // Create new trip
  const gastosObj={}; gastos.forEach((g,i)=>{gastosObj[i]=g;});
  const outfitsObj={}; outfits.forEach((o,i)=>{outfitsObj[i]=o;});
  const tripData={
    owner:currentUser.uid, ownerEmail:currentUser.email,
    memberEmails:[currentUser.email], tripName:'Panamá 2025',
    P, IT, gastos:gastosObj, outfits:outfitsObj, people, nid, ngid, noid, openDays:[...openDays]
  };
  const newRef=await addDoc(collection(db,'trips'), tripData);
  currentTripId=newRef.id;
  currentTripRef=doc(db,'trips',currentTripId);
  tripMembers=[currentUser.email];
  startTripSync();
  startArmarioSync();
}

function updateUserUI(){
  const av=$('user-avatar'), nm=$('user-name');
  if(av){ av.src=currentUser.photoURL||''; av.style.display=currentUser.photoURL?'block':'none'; }
  if(nm) nm.textContent=currentUser.displayName||currentUser.email;
}

function setupAuth(){
  onAuthStateChanged(auth, async(user)=>{
    if(user){
      currentUser=user;
      // Save user profile
      try{ await setDoc(doc(db,'users',user.uid),{email:user.email,displayName:user.displayName,photoURL:user.photoURL},{merge:true}); }catch(e){}
      // Show app
      $('login-screen').style.display='none';
      $('app-shell').style.display='';
      updateUserUI();
      await loadUserTrip();
      if($('pcount')) $('pcount').textContent=P;
      render();
    } else {
      currentUser=null;
      if(unsubTrip) unsubTrip();
      if(unsubArmario) { unsubArmario(); unsubArmario=null; }
      currentTripRef=null; currentTripId=null;
      $('login-screen').style.display='flex';
      $('app-shell').style.display='none';
    }
  });
}

/* ── Share Trip ── */
window.openShareModal = function openShareModal(){
  renderMembersList();
  $('share-modal-bg').classList.add('open');
}
window.closeShareModal = function closeShareModal(){
  $('share-modal-bg').classList.remove('open');
}
window.shareModalBgClick = function shareModalBgClick(e){
  if(e.target.id==='share-modal-bg') closeShareModal();
}
window.shareTrip = async function shareTrip(){
  const email=$('share-email')?.value.trim().toLowerCase();
  if(!email||!email.includes('@'))return;
  if(tripMembers.includes(email)){ alert('Esta persona ya tiene acceso.'); return; }
  if(!currentTripRef) return;
  try{
    await updateDoc(currentTripRef, { memberEmails: arrayUnion(email) });
    tripMembers.push(email);
    $('share-email').value='';
    renderMembersList();
  }catch(e){ console.error('Share error',e); alert('Error al compartir. Intenta de nuevo.'); }
}
window.removeMember = async function removeMember(email){
  if(!currentTripRef||!currentUser) return;
  if(email===currentUser.email){ alert('No puedes quitarte a ti mismo.'); return; }
  if(!confirm(`¿Quitar acceso a ${email}?`)) return;
  try{
    await updateDoc(currentTripRef, { memberEmails: arrayRemove(email) });
    tripMembers=tripMembers.filter(e=>e!==email);
    renderMembersList();
  }catch(e){ console.error('Remove error',e); }
}
function renderMembersList(){
  const el=$('members-list');
  if(!el) return;
  el.innerHTML=tripMembers.map(em=>{
    const isOwner=em===(currentUser?.email);
    return `<div class="member-row">
      <span class="member-email">${em}</span>
      <span class="member-role">${isOwner?'Propietario':'Invitado'}</span>
      ${!isOwner?`<button class="member-remove" onclick="removeMember('${em}')">&times;</button>`:''}
    </div>`;
  }).join('');
}

window.resetState = function resetState(){
  if(!confirm('¿Borrar todos los cambios y volver al itinerario original? Esta acción no se puede deshacer.'))return;
  localStorage.removeItem('jmtrips_v1');
  location.reload();
}

/* ══════════ STATE ══════════ */
let P=2;
let VIEW='it';
let openDays=new Set([0]);
let openForms=new Set();
let openOutfitForms=new Set();
let editCtx=null;
let selDay=null;
let editingOutfit=null; // {di, idx} for inline editing
let outfitDragSrc=null;
let dragSrc=null;
let nid=200;
let ngid=1000;
let noid=2000;
let people=[];
let activePerson=null;

/* ══════════ DATA ══════════ */
let gastos=Array(11).fill(null).map(()=>[]);
let outfits=Array(11).fill(null).map(()=>[]);

let IT=[
  {day:'Lunes 6 de julio',route:'Aeropuerto Tocumen + Hotel',acts:[
    {id:1,name:'Llegada al aeropuerto',time:'5:43 PM',pp:0,cat:'Logística',sub:'Llegada',done:false},
    {id:2,name:'Check-in en el hotel',time:'6:30 PM',pp:0,cat:'Hotel',sub:'Check-in',done:false},
    {id:3,name:'Cena de bienvenida',time:'8:00 PM - 10:00 PM',pp:20,cat:'Comida',sub:'Cena',done:false,v:'Garden Grille – Hilton',vu:'',vt:'Primera noche, cómodo no salir. Bar completo incluido.'}
  ]},
  {day:'Martes 7 de julio',route:'Amador Causeway + Casco Viejo',acts:[
    {id:4,name:'Servicio del campo',time:'7:30 AM - 1:45 PM',pp:0,cat:'Actividad',sub:'Servicio',done:false},
    {id:5,name:'Causeway de Amador',time:'3:30 PM - 6:30 PM',pp:10,cat:'Turismo',sub:'Paseo',done:false},
    {id:6,name:'Cena en Casco Viejo',time:'7:30 PM - 10:30 PM',pp:30,cat:'Comida',sub:'Cena',done:false,v:'Fonda Lo Que Hay',vu:'',vt:'Top 50 América Latina. Cocina panameña de autor. Reservar con anticipación.'}
  ]},
  {day:'Miércoles 8 de julio',route:'Hotel + Reunión',acts:[
    {id:7,name:'Reunión de ánimo',time:'7:45 AM - 12:00 PM',pp:0,cat:'Espiritual',sub:'Reunión',done:false},
    {id:8,name:'Tarde libre / descanso',time:'1:00 PM - 6:00 PM',pp:0,cat:'Libre',sub:'Descanso',done:false},
    {id:9,name:'Cena relajada',time:'7:00 PM - 10:00 PM',pp:25,cat:'Comida',sub:'Cena',done:false,v:'La Pulpería – Casco Viejo',vu:'',vt:'Platos para compartir, cócteles creativos. Sin reserva.'}
  ]},
  {day:'Jueves 9 de julio',route:'Ciudad de Panamá – Casco Viejo',acts:[
    {id:10,name:'Colores de la capital',time:'8:15 AM - 2:50 PM',pp:0,cat:'Tour',sub:'Ciudad',done:false},
    {id:11,name:'Rooftop / paseo',time:'5:30 PM - 7:00 PM',pp:25,cat:'Ocio',sub:'Rooftop',done:false,v:'CasaCasco Rooftop – Plaza Herrera',vu:'',vt:'Vista panorámica al skyline. Atardecer espectacular.'},
    {id:12,name:'Cena en Casco Viejo',time:'7:30 PM - 10:30 PM',pp:30,cat:'Comida',sub:'Cena',done:false,v:'Santa Rita – Casco Viejo',vu:'',vt:'#2 en Ciudad de Panamá. Cocina española, tapas. Reservar 1 día antes.'}
  ]},
  {day:'Viernes 10 de julio',route:'Asamblea Internacional',acts:[
    {id:13,name:'Asamblea Internacional',time:'7:45 AM - 5:45 PM',pp:0,cat:'Evento',sub:'Asamblea',done:false},
    {id:14,name:'Cena ligera',time:'7:00 PM - 8:30 PM',pp:20,cat:'Comida',sub:'Cena',done:false,v:'Canal House – Amador',vu:'',vt:'Vista al canal. Música en vivo los viernes.'}
  ]},
  {day:'Sábado 11 de julio',route:'Asamblea Internacional',acts:[
    {id:15,name:'Asamblea Internacional',time:'7:45 AM - 5:45 PM',pp:0,cat:'Evento',sub:'Asamblea',done:false},
    {id:16,name:'Cena ligera',time:'7:00 PM - 8:30 PM',pp:20,cat:'Comida',sub:'Cena',done:false,v:'CascoMar – Casco Viejo',vu:'',vt:'Mariscos mediterráneos. Terraza exterior muy agradable.'}
  ]},
  {day:'Domingo 12 de julio',route:'Asamblea Internacional',acts:[
    {id:17,name:'Asamblea Internacional',time:'7:45 AM - 5:45 PM',pp:0,cat:'Evento',sub:'Asamblea',done:false},
    {id:18,name:'Cena ligera',time:'7:00 PM - 8:30 PM',pp:20,cat:'Comida',sub:'Cena',done:false,v:'Mi Ranchito – Causeway',vu:'',vt:'Cocina panameña frente al mar. Ropa vieja con patacones.'}
  ]},
  {day:'Lunes 13 de julio',route:'Valle de Antón',acts:[
    {id:19,name:'Excursión Valle de Antón',time:'6:45 AM - 5:45 PM',pp:30,cat:'Tour',sub:'Naturaleza',done:false},
    {id:20,name:'Cena al regreso',time:'7:00 PM - 8:30 PM',pp:15,cat:'Comida',sub:'Cena',done:false,v:'Garden Grille – Hilton',vu:'',vt:'Día de excursión larga. Mejor cenar en el hotel.'}
  ]},
  {day:'Martes 14 de julio',route:'Canal de Panamá + Miraflores',acts:[
    {id:21,name:'Esclusa de Miraflores',time:'8:00 AM - 2:30 PM',pp:13,cat:'Tour',sub:'Canal',done:false},
    {id:22,name:'Selva tropical',time:'3:30 PM - 6:00 PM',pp:10,cat:'Tour',sub:'Naturaleza',done:false},
    {id:23,name:'Cena especial – Noche de gala',time:'7:30 PM - 9:00 PM',pp:30,cat:'Comida',sub:'Cena',done:false,v:'Mai Mai – Ciudad de Panamá',vu:'',vt:'Mejor restaurante de Panamá. Fusión Nikkei-Peruana. ⚠️ RESERVA OBLIGATORIA.'}
  ]},
  {day:'Miércoles 15 de julio',route:'Isla Taboga',acts:[
    {id:24,name:'Ferry a Taboga',time:'8:00 AM - 9:00 AM',pp:25,cat:'Transporte',sub:'Ferry',done:false},
    {id:25,name:'Playa y descanso',time:'9:00 AM - 3:00 PM',pp:0,cat:'Playa',sub:'Relax',done:false},
    {id:26,name:'Almuerzo frente al mar',time:'1:00 PM - 2:30 PM',pp:30,cat:'Comida',sub:'Almuerzo',done:false,v:'Restaurantes locales – Taboga',vu:'',vt:'Corvina frita o camarones al ajillo. Llevar efectivo.'}
  ]},
  {day:'Jueves 16 de julio',route:'Hotel → Aeropuerto',acts:[
    {id:27,name:'Check-out hotel',time:'6:00 AM - 7:00 AM',pp:0,cat:'Logística',sub:'Salida',done:false},
    {id:28,name:'Traslado aeropuerto',time:'7:00 AM - 9:00 AM',pp:13,cat:'Transporte',sub:'Taxi',done:false}
  ]}
];

/* ══════════ HELPERS ══════════ */
const $=id=>document.getElementById(id);
const f=n=>'$'+n;
const dpp=d=>d.acts.reduce((a,b)=>a+(+b.pp||0),0); // planned per person
const dpt=d=>dpp(d)*P;
const daySpentPP=di=>gastos[di].reduce((a,g)=>a+(+g.monto||0),0); // real per person from gastos
const daySpentT=di=>daySpentPP(di)*P;
const allPlan=()=>IT.reduce((a,d)=>a+dpt(d),0);
const allSpent=()=>IT.reduce((a,_,di)=>a+daySpentT(di),0);
const tdone=()=>IT.reduce((a,d)=>a+d.acts.filter(x=>x.done).length,0);
const tacts=()=>IT.reduce((a,d)=>a+d.acts.length,0);

window.chgP = function chgP(d){P=Math.max(1,P+d);$('pcount').textContent=P;render();}

/* ══════════ GASTOS HELPERS ══════════ */
window.addGasto = function addGasto(di){
  const c=$(`gf-con-${di}`)?.value.trim();
  const cat=$(`gf-cat-${di}`)?.value;
  const m=parseFloat($(`gf-mon-${di}`)?.value);
  if(!c||isNaN(m)||m<=0)return;
  gastos[di].push({id:ngid++,concepto:c,cat,monto:m});
  openForms.delete(di);
  render();
}
window.delGasto = function delGasto(di,gid){
  gastos[di]=gastos[di].filter(g=>g.id!==gid);
  render();
}
window.toggleForm = function toggleForm(di){
  if(openForms.has(di))openForms.delete(di);
  else openForms.add(di);
  render();
}

/* ══════════ OUTFITS HELPERS ══════════ */
window.addPerson = function addPerson(){
  const n=prompt("Nombre de la persona:");
  if(n && n.trim()) {
    const name=n.trim();
    if(!people.includes(name)) people.push(name);
    activePerson=name;
    render();
  }
}
window.selectPerson = function selectPerson(n){
  activePerson=n;
  render();
}
window.addOutfit = function addOutfit(di){
  if(!activePerson)return;
  const t=$(`of-txt-${di}`)?.value.trim();
  const cat=$(`of-cat-${di}`)?.value||'superior';
  const momento=$(`of-mom-${di}`)?.value||'dia';
  if(!t)return;
  outfits[di].push({id:noid++,persona:activePerson,texto:t,cat,momento});
  openOutfitForms.delete(di);
  render();
}
window.delOutfit = function delOutfit(di,oid){
  outfits[di]=outfits[di].filter(o=>o.id!==oid);
  render();
}
window.toggleOutfitForm = function toggleOutfitForm(di){
  if(openOutfitForms.has(di))openOutfitForms.delete(di);
  else openOutfitForms.add(di);
  render();
}
window.startEditOutfit = function startEditOutfit(di,idx){
  editingOutfit={di,idx};
  render();
}
window.saveEditOutfit = function saveEditOutfit(di,idx){
  const t=$(`oe-txt-${di}-${idx}`)?.value.trim();
  const cat=$(`oe-cat-${di}-${idx}`)?.value||'superior';
  const momento=$(`oe-mom-${di}-${idx}`)?.value||'dia';
  if(!t)return;
  outfits[di][idx].texto=t;
  outfits[di][idx].cat=cat;
  outfits[di][idx].momento=momento;
  editingOutfit=null;
  render();
}
window.cancelEditOutfit = function cancelEditOutfit(){
  editingOutfit=null;
  render();
}
// Outfit drag & drop
window.outfitDs = function outfitDs(e,di,idx){
  outfitDragSrc={di,idx};
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed='move';
}
window.outfitDov = function outfitDov(e){
  e.preventDefault();
  e.currentTarget.classList.add('dragover');
}
window.outfitDl = function outfitDl(e){
  e.currentTarget.classList.remove('dragover');
}
window.outfitDdr = function outfitDdr(e,di,idx){
  e.currentTarget.classList.remove('dragover');
  if(!outfitDragSrc||(outfitDragSrc.di===di&&outfitDragSrc.idx===idx))return;
  // Only allow reorder within the same day and person
  if(outfitDragSrc.di!==di)return;
  const personOutfits=outfits[di].filter(o=>o.persona===activePerson);
  const allOther=outfits[di].filter(o=>o.persona!==activePerson);
  const srcItem=personOutfits.splice(outfitDragSrc.idx,1)[0];
  const destItem=personOutfits[idx];
  if(destItem&&destItem.momento){
    srcItem.momento=destItem.momento;
  }
  personOutfits.splice(idx,0,srcItem);
  outfits[di]=[...allOther,...personOutfits];
  outfitDragSrc=null;
  render();
}

/* ══════════ SIDEBAR ══════════ */
function renderSidebar(){
  const tp=allPlan(),tr=allSpent(),done=tdone(),tot=tacts();
  $('sb-sum').innerHTML=`
    <div class="sr"><span class="sl">👥 Personas</span><span class="sv gold">${P} ${P===1?'persona':'personas'}</span></div>
    <div class="sr"><span class="sl">Presupuesto total</span><span class="sv">${f(tp)}</span></div>
    ${P>1?`<div class="sr"><span class="sl">Por persona</span><span class="sv">${f(Math.round(tp/P))}</span></div>`:''}
    <div class="sr"><span class="sl">Gasto registrado</span><span class="sv ${tr>tp&&tr>0?'bad':'ok'}">${tr>0?f(tr):'—'}</span></div>
    ${P>1&&tr>0?`<div class="sr"><span class="sl">Gastado / persona</span><span class="sv ok">${f(Math.round(tr/P))}</span></div>`:''}
    <div class="sr"><span class="sl">Actividades hechas</span><span class="sv gold">${done}/${tot}</span></div>`;

  $('sb-days').innerHTML=IT.map((d,di)=>{
    const tp2=dpt(d),tr2=daySpentT(di);
    const w=WX[di]||WX[0];
    const allDone=d.acts.every(a=>a.done);
    const over=tr2>tp2&&tr2>0&&tp2>0;
    return `<div class="sb-day ${openDays.has(di)?'active':''} ${allDone?'alldone':''}"
      onclick="scrollTo(${di})">
      <div class="sb-dot"></div>
      <div class="sb-di">
        <div class="sb-dn">${d.day}</div>
        <div class="sb-dr">${d.route}</div>
        <div style="font-size:.6rem;color:var(--dim)">${w.i} ${w.h}°</div>
      </div>
      <div>
        ${tp2>0?`<div class="sb-dp">Plan ${f(tp2)}</div>`:''}
        ${tr2>0?`<div class="sb-dp spent ${over?'bad':''}">${f(tr2)}</div>`:''}
      </div>
    </div>`;
  }).join('');
}

/* ══════════ ITINERARY VIEW ══════════ */
function renderIt(){
  const tp=allPlan(),tr=allSpent(),pct=tp>0?Math.min(100,Math.round(tr/tp*100)):0,over=tr>tp&&tr>0;
  const done=tdone(),tot=tacts();

  let h=`<div class="hero">
    <div>
      <h2>Mi <em>Guía de Viaje</em></h2>
      <div class="hero-sub">JM Trips · ${P} ${P===1?'persona':'personas'}</div>
    </div>
    <div class="hstats">
      <div class="hstat">
        <div class="hv">${f(tp)}</div><div class="hl">Presupuesto</div>
        ${P>1?`<div class="hpp">${f(Math.round(tp/P))}/pers</div>`:''}
      </div>
      <div class="hstat">
        <div class="hv ${over?'bad':tr>0?'ok':''}">${tr>0?f(tr):'—'}</div><div class="hl">Gastado</div>
        ${P>1&&tr>0?`<div class="hpp">${f(Math.round(tr/P))}/pers</div>`:''}
      </div>
      <div class="hstat">
        <div class="hv">${done}<span style="font-size:.9rem;color:var(--dim)">/${tot}</span></div>
        <div class="hl">Realizadas</div>
      </div>
    </div>
  </div>`;

  if(tp>0&&tr>0)h+=`<div class="bbar">
    <div class="bbar-lbl"><span>${f(0)}</span><span>${f(tr)} de ${f(tp)} · ${pct}%</span><span>${f(tp)}</span></div>
    <div class="bbar-track"><div class="bbar-fill${over?' over':''}" style="width:${pct}%"></div></div>
  </div>`;

  IT.forEach((day,di)=>{
    const isOpen=openDays.has(di);
    const tp2=dpt(day),tr2=daySpentT(di);
    const pct2=tp2>0?Math.min(100,Math.round(tr2/tp2*100)):0,over2=tr2>tp2&&tr2>0&&tp2>0;
    const doneC=day.acts.filter(a=>a.done).length,allDone=doneC===day.acts.length;
    const w=WX[di]||WX[0];
    const mapUrl='https://www.google.com/maps/search/'+encodeURIComponent(day.route);
    const gs=gastos[di];
    const hasGastos=gs.length>0;

    // Activities
    let actsH='';
    day.acts.forEach((a,ai)=>{
      const col=CC[a.cat]||'#666';
      const isFood=a.cat==='Comida'||a.sub==='Almuerzo';
      const vH=a.v?`<div class="avenue">
        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/></svg>
        ${a.vu?`<a href="${a.vu}" target="_blank">${a.v}</a>`:`<span>${a.v}</span>`}
      </div>${a.vt?`<div class="atip">${a.vt}</div>`:''}`:'';
      actsH+=`<div class="act${isFood?' food':''}${a.done?' done':''}"
        draggable="true"
        ondragstart="ds(event,${di},${ai})"
        ondragover="dov(event)"
        ondrop="ddr(event,${di},${ai})"
        ondragleave="dl(event)">
        <button class="achk${a.done?' on':''}" onclick="togDone(${di},${ai},event)">
          ${a.done?`<svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>`:''}
        </button>
        <div class="adot" style="background:${col}"></div>
        <div class="abody">
          <div class="aname">${a.name}</div>
          ${vH}
          <div class="ameta">
            <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            ${a.time} <span class="acat">${a.cat}</span>
          </div>
        </div>
        <div class="aright">
          ${a.pp>0?`<span class="ptag pplan">${P>1?f(a.pp)+'/p = ':''}<b>${f(a.pp*P)}</b></span>`:'<span style="font-size:.62rem;color:var(--dim)">sin costo</span>'}
          <button class="aedit" onclick="openEdit(${di},${ai})">Editar</button>
        </div>
      </div>`;
    });

    // Gastos section
    const formOpen=openForms.has(di);
    const catOptions=GCATS.map(c=>`<option>${c}</option>`).join('');
    let gastosH=`<div class="gasto-list">`;
    if(gs.length===0&&!formOpen){
      gastosH+=`<div class="gasto-empty">Sin gastos registrados aún</div>`;
    }
    gs.forEach(g=>{
      const col=GCAT[g.cat]||'#666';
      const total=g.monto*P;
      gastosH+=`<div class="gasto-item">
        <div class="gasto-cat-dot" style="background:${col}"></div>
        <div class="gasto-body">
          <div class="gasto-concepto">${g.concepto}</div>
          <div class="gasto-cat-label">${g.cat}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div class="gasto-monto">${f(total)}</div>
          ${P>1?`<div class="gasto-monto-pp">${f(g.monto)}/pers</div>`:''}
        </div>
        <button class="gasto-del" onclick="delGasto(${di},${g.id})" title="Eliminar">×</button>
      </div>`;
    });
    gastosH+=`</div>`;

    // Inline form
    gastosH+=`<div class="gasto-form${formOpen?' open':''}" id="gf-${di}">
      <div class="gf-row3">
        <input class="gf-input" id="gf-con-${di}" placeholder="Ej: Taxi al hotel, Helado..." 
          onkeydown="if(event.key==='Enter')addGasto(${di})"/>
        <select class="gf-select" id="gf-cat-${di}">${catOptions}</select>
        <input class="gf-input" id="gf-mon-${di}" type="number" min="0" step="0.5"
          placeholder="${P>1?'$/persona':'$'}"
          onkeydown="if(event.key==='Enter')addGasto(${di})"/>
      </div>
      ${P>1?`<div style="font-size:.6rem;color:var(--dim);margin-top:-2px">Ingresa el monto por persona — el total para ${P} personas se calculará automáticamente</div>`:''}
      <div class="gf-actions">
        <button class="gf-save" onclick="addGasto(${di})">✓ Guardar gasto</button>
        <button class="gf-cancel" onclick="toggleForm(${di})">Cancelar</button>
      </div>
    </div>`;

    h+=`<div class="day-card" id="dc-${di}">
      <div class="dh" onclick="togDay(${di})">
        <div class="dnum">${String(di+1).padStart(2,'0')}</div>
        <div class="dinfo">
          <div class="dtitle">${day.day}</div>
          <div class="dsub">
            <span class="droute">
              <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/></svg>
              <a href="${mapUrl}" target="_blank" onclick="event.stopPropagation()">${day.route}</a>
            </span>
            <span class="wchip">${w.i} ${w.h}°/${w.l}° · ${w.d}</span>
          </div>
          <div class="wtip">${w.t}</div>
        </div>
        <div class="dright">
          ${allDone?'<span class="done-badge">✓ Listo</span>':(doneC>0?`<span style="font-size:.62rem;color:var(--dim)">${doneC}/${day.acts.length}</span>`:'')}
          <div class="dbud">
            ${tp2>0?`<span class="dbc">Plan ${f(tp2)}</span>`:''}
            ${tr2>0?`<span class="dbc ${over2?'bad':'ok'}">Gastado ${f(tr2)}</span>`:(hasGastos?'':'<span class="dbc" style="color:var(--amber)">Sin gastos</span>')}
            ${tp2>0&&tr2>0?`<div class="dprog"><div class="dpf${over2?' over':''}" style="width:${pct2}%"></div></div>`:''}
          </div>
          <svg class="chev${isOpen?' open':''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/></svg>
        </div>
      </div>
      <div class="card-body${isOpen?' open':''}">
        <div class="acts-section">
          <div class="section-label">Actividades planificadas</div>
          ${actsH}
        </div>
        <div class="gastos-section">
          <div class="gastos-header">
            <div class="gastos-title-row">
              <span class="gastos-title">💰 Gastos del día</span>
              ${tr2>0?`<span class="gastos-total${over2?' over':''}">${f(tr2)} total${P>1?` (${f(daySpentPP(di))}/pers)`:''}</span>`:''}
            </div>
            <button class="btn-add-gasto" onclick="toggleForm(${di});event.stopPropagation()">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
              Agregar gasto
            </button>
          </div>
          ${gastosH}
        </div>
      </div>
    </div>`;
  });
  return h;
}

/* ══════════ GASTOS VIEW ══════════ */
function renderGas(){
  // Aggregate by GCAT
  const bycat={};
  IT.forEach((_,di)=>{
    gastos[di].forEach(g=>{
      if(!bycat[g.cat])bycat[g.cat]={total:0};
      bycat[g.cat].total+=(+g.monto||0)*P;
    });
  });
  const cats=Object.entries(bycat).filter(([,v])=>v.total>0).sort((a,b)=>b[1].total-a[1].total);
  const mx=Math.max(...cats.map(([,v])=>v.total),1);
  const tp=allPlan(),tr=allSpent();
  const done=tdone(),tot=tacts();

  // Day breakdown
  const dayRows=IT.map((d,di)=>{
    const sp=daySpentT(di);
    if(sp===0)return '';
    const pct=Math.round(sp/Math.max(...IT.map((_,i)=>daySpentT(i)),1)*100);
    return `<div class="db-item">
      <div class="db-day" style="font-size:.7rem">${d.day.split(' ').slice(0,2).join(' ')}</div>
      <div class="db-bar-wrap"><div class="db-bar" style="width:${pct}%"></div></div>
      <div class="db-amt">${f(sp)}</div>
    </div>`;
  }).join('');

  const catH=cats.length>0?cats.map(([cat,v])=>{
    const col=GCAT[cat]||'#666';
    const pct=Math.round(v.total/mx*100);
    return `<div class="cbar-row">
      <div class="cbar-lbl"><span class="cswatch" style="background:${col}"></span>${cat.split('/')[0].trim()}</div>
      <div class="cbar-outer"><div class="cbar-track"><div class="cbar-fill" style="width:${pct}%;background:${col}"></div></div></div>
      <div class="cbar-amt">${f(v.total)}</div>
    </div>`;
  }).join('')
  :`<p style="font-size:.77rem;color:var(--dim);font-style:italic">Registra gastos en el itinerario para ver el desglose aquí.</p>`;

  return `<div class="hero" style="margin-bottom:1.5rem">
    <div><h2>Resumen de <em>gastos</em></h2>
    <div class="hero-sub">${P} ${P===1?'persona':'personas'} · basado en gastos registrados por día</div></div>
  </div>
  <div class="res-grid">
    <div class="res-card">
      <h3>Por categoría de gasto</h3>${catH}
      ${dayRows?`<div class="day-breakdown"><div style="font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);margin-bottom:.5rem">Por día</div>${dayRows}</div>`:''}
    </div>
    <div class="res-card">
      <h3>Totales del viaje</h3>
      <div class="srow"><span class="slbl">Presupuesto total</span>
        <div><div class="sval gold">${f(tp)}</div>${P>1?`<div class="ssub">${f(Math.round(tp/P))} por persona</div>`:''}</div></div>
      <div class="srow"><span class="slbl">Gasto real registrado</span>
        <div><div class="sval ${tr>tp&&tr>0?'bad':tr>0?'ok':''}">${tr>0?f(tr):'Sin registros aún'}</div>
        ${P>1&&tr>0?`<div class="ssub">${f(Math.round(tr/P))} por persona</div>`:''}</div></div>
      <div class="srow"><span class="slbl">Diferencia</span>
        <div><div class="sval ${tp-tr<0?'bad':'ok'}">${tr>0?f(tp-tr):'—'}</div>
        ${tr>0?`<div class="ssub">${tp-tr>=0?'✓ dentro del presupuesto':'⚠ sobre el presupuesto'}</div>`:''}</div></div>
      <div class="srow"><span class="slbl">Gastos registrados</span>
        <div><div class="sval gold">${IT.reduce((a,_,di)=>a+gastos[di].length,0)}</div>
        <div class="ssub">${cats.length} categorías distintas</div></div></div>
      <div class="srow"><span class="slbl">Actividades realizadas</span>
        <div><div class="sval">${done}/${tot}</div><div class="ssub">${Math.round(done/tot*100)}% completadas</div></div></div>
    </div>
  </div>`;
}

/* ══════════ MI VIAJE VIEW ══════════ */
function renderMv(){
  const tr=allSpent(),tp=allPlan(),done=tdone(),tot=tacts();
  let h=`<div class="hero" style="margin-bottom:1.5rem">
    <div><h2>Mi <em>viaje</em></h2>
    <div class="hero-sub">Todo lo que hicimos y gastamos · ${P} ${P===1?'persona':'personas'}</div></div>
    <div class="hstats">
      <div class="hstat"><div class="hv">${done}<span style="font-size:.9rem;color:var(--dim)">/${tot}</span></div><div class="hl">Realizadas</div></div>
      <div class="hstat">
        <div class="hv ${tr>tp&&tr>0?'bad':tr>0?'ok':''}">${tr>0?f(tr):'—'}</div>
        <div class="hl">Total gastado</div>
        ${P>1&&tr>0?`<div class="hpp">${f(Math.round(tr/P))}/persona</div>`:''}
      </div>
    </div>
  </div>`;

  let hasContent=false;
  IT.forEach((day,di)=>{
    const gs=gastos[di];
    const hasDone=day.acts.some(a=>a.done);
    const sp=daySpentT(di);
    if(!hasDone&&gs.length===0)return;
    hasContent=true;

    h+=`<div class="mv-day">
      <div class="mv-dh">
        <div class="mv-dt">${day.day} <span style="font-size:.76rem;color:var(--dim);font-weight:300">· ${day.route}</span></div>
        ${sp>0?`<div class="mv-ds">${f(sp)} gastado${P>1?` (${f(Math.round(sp/P))}/pers)`:''}</div>`:''}
      </div>`;

    // Activities done
    day.acts.forEach(a=>{
      h+=`<div class="mv-act">
        <div class="mv-dot ${a.done?'done':'pend'}">
          ${a.done?`<svg width="7" height="7" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>`:''}
        </div>
        <div class="mv-ainfo">
          <div class="mv-an ${a.done?'':'pend'}">${a.name}</div>
          ${a.v?`<div class="mv-av">${a.v}</div>`:''}
        </div>
      </div>`;
    });

    // Gastos del día
    if(gs.length>0){
      h+=`<div class="mv-gastos">`;
      gs.forEach(g=>{
        const col=GCAT[g.cat]||'#666';
        h+=`<div class="mv-gasto-item">
          <div class="mv-g-dot" style="background:${col}"></div>
          <div class="mv-g-concepto">${g.concepto}</div>
          <div class="mv-g-cat">${g.cat.split('/')[0].trim()}</div>
          <div class="mv-g-amt">${f(g.monto*P)}${P>1?`<span style="font-size:.58rem;color:var(--dim)"> (${f(g.monto)}/p)</span>`:''}</div>
        </div>`;
      });
      h+=`</div>`;
    }
    h+=`</div>`;
  });

  if(!hasContent){
    h+=`<div class="mv-empty">
      Marca actividades como hechas y registra gastos<br>en el itinerario para verlos aquí al finalizar el viaje.
    </div>`;
  }
  return h;
}

/* ══════════ OUTFITS VIEW ══════════ */
function renderOutfits(){
  // Global summary across all days for this person
  let globalCounts={};
  OCAT_KEYS.forEach(k=>globalCounts[k]=0);
  if(activePerson){
    const uniqueItems=new Set();
    IT.forEach((_,di)=>{
      outfits[di].filter(o=>o.persona===activePerson).forEach(o=>{
        const c=o.cat||'superior';
        const key=`${c}::${o.texto.trim().toLowerCase()}`;
        if(!uniqueItems.has(key)){
          uniqueItems.add(key);
          globalCounts[c]=(globalCounts[c]||0)+1;
        }
      });
    });
  }
  const totalItems=Object.values(globalCounts).reduce((a,b)=>a+b,0);

  let h=`<div class="hero" style="margin-bottom:1rem">
    <div><h2>Equipaje de <em>Viaje</em></h2>
    <div class="hero-sub">Organiza la ropa por persona para cada día</div></div>
    ${activePerson&&totalItems>0?`<div class="hstats">
      <div class="hstat"><div class="hv">${totalItems}</div><div class="hl">Prendas Total</div></div>
    </div>`:''}
  </div>`;
  
  let pChips = people.map(p=>`<button class="btn" style="width:auto;display:inline-block;margin-right:8px;margin-bottom:8px;background:${p===activePerson?'var(--gold)':'var(--card2)'};color:${p===activePerson?'var(--bg)':'var(--text)'};border:none;padding:.4rem .8rem;border-radius:var(--r);font-family:var(--fb);font-weight:500;font-size:.78rem;cursor:pointer;transition:var(--tr)" onclick="selectPerson('${p}')">${p}</button>`).join('');
  pChips += `<button class="btn" style="width:auto;display:inline-block;margin-bottom:8px;background:transparent;color:var(--gold);border:1px dashed var(--goldd);padding:.4rem .8rem;border-radius:var(--r);font-family:var(--fb);font-weight:500;font-size:.78rem;cursor:pointer" onclick="addPerson()">+ Añadir Persona</button>`;
  
  h += `<div style="margin-bottom:1rem;display:flex;flex-wrap:wrap">${pChips}</div>`;

  // Global summary bar
  if(activePerson&&totalItems>0){
    let summaryChips=OCAT_KEYS.filter(k=>globalCounts[k]>0).map(k=>{
      const c=OCAT[k];
      return `<span class="outfit-summary-chip" style="border-color:${c.color}40">${c.icon} ${globalCounts[k]} ${c.label}${globalCounts[k]>1?'s':''}</span>`;
    }).join('');
    h+=`<div class="outfit-global-summary">${summaryChips}</div>`;
  }

  if(!activePerson) {
    return h + `<div class="mv-empty" style="text-align:left;background:transparent;border:none">Selecciona o añade una persona arriba para comenzar a planificar su ropa.</div>`;
  }

  IT.forEach((day,di)=>{
    const os=outfits[di].filter(o=>o.persona===activePerson);
    const isOpen=openDays.has(di);
    const ofFormOpen=openOutfitForms.has(di);
    // Activity names for subtitle
    const actNames=day.acts.map(a=>a.name).join(' · ');
    // Category select options
    const catOpts=OCAT_KEYS.map(k=>`<option value="${k}">${OCAT[k].icon} ${OCAT[k].label}</option>`).join('');

    // Day category counts
    let dayCounts={};
    OCAT_KEYS.forEach(k=>dayCounts[k]=0);
    os.forEach(o=>{const c=o.cat||'superior';dayCounts[c]=(dayCounts[c]||0)+1;});
    const daySummary=OCAT_KEYS.filter(k=>dayCounts[k]>0).map(k=>`${OCAT[k].icon}${dayCounts[k]}`).join(' ');
    
    let oh=`<div class="gasto-list">`;
    if(os.length===0 && !ofFormOpen){
      oh+=`<div class="gasto-empty">Sin ropa planificada para ${activePerson} este día.</div>`;
    } else {
      const diaOutfits = os.filter(o => o.momento !== 'tarde');
      const tardeOutfits = os.filter(o => o.momento === 'tarde');

      // ☀️ Día (AM)
      oh+=`<div class="outfit-group-title">☀️ Día (AM)</div>`;
      if(diaOutfits.length===0){
        oh+=`<div class="gasto-empty" style="padding:.2rem 0; font-size:.68rem">Sin prendas para el día</div>`;
      } else {
        diaOutfits.forEach((o)=>{
          const realIdx=outfits[di].indexOf(o);
          const personIdx=os.indexOf(o);
          const cat=OCAT[o.cat||'superior']||OCAT.superior;
          const isEditing=editingOutfit&&editingOutfit.di===di&&editingOutfit.idx===realIdx;
          if(isEditing){
            const editCatOpts=OCAT_KEYS.map(k=>`<option value="${k}"${(o.cat||'superior')===k?' selected':''}>${OCAT[k].icon} ${OCAT[k].label}</option>`).join('');
            const editMomOpts=`
              <option value="dia"${o.momento!=='tarde'?' selected':''}>☀️ Día (AM)</option>
              <option value="tarde"${o.momento==='tarde'?' selected':''}>🌙 Tarde/Noche (PM)</option>
            `;
            oh+=`<div class="outfit-edit-form">
              <div class="gf-row" style="grid-template-columns: 1fr 1fr; margin-bottom: .4rem;">
                <select class="gf-select" id="oe-cat-${di}-${realIdx}">${editCatOpts}</select>
                <select class="gf-select" id="oe-mom-${di}-${realIdx}">${editMomOpts}</select>
              </div>
              <input class="gf-input" id="oe-txt-${di}-${realIdx}" value="${o.texto.replace(/"/g,'&quot;')}" 
                onkeydown="if(event.key==='Enter')saveEditOutfit(${di},${realIdx});if(event.key==='Escape')cancelEditOutfit()"/>
              <div class="gf-actions" style="margin-top:.4rem">
                <button class="gf-save" onclick="saveEditOutfit(${di},${realIdx})">✓ Guardar</button>
                <button class="gf-cancel" onclick="cancelEditOutfit()">Cancelar</button>
              </div>
            </div>`;
          } else {
            const wMatch = o.wardrobeId ? armario.find(a=>a.id===o.wardrobeId) : null;
            const thumbH = wMatch&&wMatch.imagen
              ? `<img class="outfit-img-thumb" src="${wMatch.imagen}" alt=""/>`
              : `<div class="outfit-cat-icon" style="background:${cat.color}22;color:${cat.color}">${cat.icon}</div>`;
            oh+=`<div class="outfit-item"
              draggable="true"
              ondragstart="outfitDs(event,${di},${personIdx})"
              ondragover="outfitDov(event)"
              ondrop="outfitDdr(event,${di},${personIdx})"
              ondragleave="outfitDl(event)">
              ${thumbH}
              <div class="outfit-body">
                <div class="outfit-texto">${o.texto}</div>
                <div class="outfit-cat-label" style="color:${cat.color}">${cat.label}</div>
              </div>
              <div class="outfit-actions">
                <button class="outfit-edit-btn" onclick="startEditOutfit(${di},${realIdx})" title="Editar">✏️</button>
                <button class="gasto-del" onclick="delOutfit(${di},${o.id})" title="Eliminar">×</button>
              </div>
            </div>`;
          }
        });
      }

      // 🌙 Tarde/Noche (PM)
      oh+=`<div class="outfit-group-title">🌙 Tarde/Noche (PM)</div>`;
      if(tardeOutfits.length===0){
        oh+=`<div class="gasto-empty" style="padding:.2rem 0; font-size:.68rem">Sin prendas para la tarde/noche</div>`;
      } else {
        tardeOutfits.forEach((o)=>{
          const realIdx=outfits[di].indexOf(o);
          const personIdx=os.indexOf(o);
          const cat=OCAT[o.cat||'superior']||OCAT.superior;
          const isEditing=editingOutfit&&editingOutfit.di===di&&editingOutfit.idx===realIdx;
          if(isEditing){
            const editCatOpts=OCAT_KEYS.map(k=>`<option value="${k}"${(o.cat||'superior')===k?' selected':''}>${OCAT[k].icon} ${OCAT[k].label}</option>`).join('');
            const editMomOpts=`
              <option value="dia"${o.momento!=='tarde'?' selected':''}>☀️ Día (AM)</option>
              <option value="tarde"${o.momento==='tarde'?' selected':''}>🌙 Tarde/Noche (PM)</option>
            `;
            oh+=`<div class="outfit-edit-form">
              <div class="gf-row" style="grid-template-columns: 1fr 1fr; margin-bottom: .4rem;">
                <select class="gf-select" id="oe-cat-${di}-${realIdx}">${editCatOpts}</select>
                <select class="gf-select" id="oe-mom-${di}-${realIdx}">${editMomOpts}</select>
              </div>
              <input class="gf-input" id="oe-txt-${di}-${realIdx}" value="${o.texto.replace(/"/g,'&quot;')}" 
                onkeydown="if(event.key==='Enter')saveEditOutfit(${di},${realIdx});if(event.key==='Escape')cancelEditOutfit()"/>
              <div class="gf-actions" style="margin-top:.4rem">
                <button class="gf-save" onclick="saveEditOutfit(${di},${realIdx})">✓ Guardar</button>
                <button class="gf-cancel" onclick="cancelEditOutfit()">Cancelar</button>
              </div>
            </div>`;
          } else {
            const wMatch = o.wardrobeId ? armario.find(a=>a.id===o.wardrobeId) : null;
            const thumbH = wMatch&&wMatch.imagen
              ? `<img class="outfit-img-thumb" src="${wMatch.imagen}" alt=""/>`
              : `<div class="outfit-cat-icon" style="background:${cat.color}22;color:${cat.color}">${cat.icon}</div>`;
            oh+=`<div class="outfit-item"
              draggable="true"
              ondragstart="outfitDs(event,${di},${personIdx})"
              ondragover="outfitDov(event)"
              ondrop="outfitDdr(event,${di},${personIdx})"
              ondragleave="outfitDl(event)">
              ${thumbH}
              <div class="outfit-body">
                <div class="outfit-texto">${o.texto}</div>
                <div class="outfit-cat-label" style="color:${cat.color}">${cat.label}</div>
              </div>
              <div class="outfit-actions">
                <button class="outfit-edit-btn" onclick="startEditOutfit(${di},${realIdx})" title="Editar">✏️</button>
                <button class="gasto-del" onclick="delOutfit(${di},${o.id})" title="Eliminar">×</button>
              </div>
            </div>`;
          }
        });
      }
    }
    oh+=`</div>`;

    // Add form with category select
    oh+=`<div class="gasto-form${ofFormOpen?' open':''}" id="of-${di}">
      <div class="gf-row" style="grid-template-columns:1fr 1fr; margin-bottom:.4rem">
        <select class="gf-select" id="of-cat-${di}">${catOpts}</select>
        <select class="gf-select" id="of-mom-${di}">
          <option value="dia">☀️ Día (AM)</option>
          <option value="tarde">🌙 Tarde/Noche (PM)</option>
        </select>
      </div>
      <input class="gf-input" id="of-txt-${di}" placeholder="Ej: Camisa de lino blanca, Short beige..." 
        onkeydown="if(event.key==='Enter')addOutfit(${di})"/>
      <div class="gf-actions" style="margin-top:.4rem">
        <button class="gf-save" onclick="addOutfit(${di})">✓ Guardar prenda</button>
        <button class="gf-cancel" onclick="toggleOutfitForm(${di})">Cancelar</button>
      </div>
    </div>`;

    // Day summary chips
    let daySumH='';
    if(os.length>0){
      const chips=OCAT_KEYS.filter(k=>dayCounts[k]>0).map(k=>{
        const c=OCAT[k];
        return `<span class="outfit-day-chip" style="color:${c.color}">${c.icon} ${dayCounts[k]}</span>`;
      }).join('');
      daySumH=`<div class="outfit-day-summary">${chips}</div>`;
    }

    h+=`<div class="day-card" id="dc-${di}">
      <div class="dh" onclick="togDay(${di})">
        <div class="dnum">${String(di+1).padStart(2,'0')}</div>
        <div class="dinfo">
          <div class="dtitle">${day.day}</div>
          <div class="dsub">
            <span class="outfit-acts-subtitle">${actNames}</span>
          </div>
        </div>
        <div class="dright">
          ${daySummary?`<span class="outfit-header-counts">${daySummary}</span>`:''}
          ${os.length>0?`<span style="font-size:.62rem;color:var(--dim)">${os.length} prendas</span>`:''}
          <svg class="chev${isOpen?' open':''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/></svg>
        </div>
      </div>
      <div class="card-body${isOpen?' open':''}">
        <div class="gastos-section" style="border-top:none;padding-top:0">
          <div class="gastos-header" style="flex-wrap:wrap;gap:.5rem">
            <span class="gastos-title" style="letter-spacing:.05em">👕 Prendas de ${activePerson}</span>
            <div style="display:flex;gap:.4rem;flex-shrink:0">
              ${armario.length>0?`<button class="btn-add-gasto" style="background:var(--goldg);border-color:var(--goldd);color:var(--gold)" onclick="openAddFromWardrobeModal(${di});event.stopPropagation()">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3a3 3 0 00-3 3v2.25a2.25 2.25 0 00-2.25 2.25v6.75A2.25 2.25 0 009 19.5h6a2.25 2.25 0 002.25-2.25v-6.75A2.25 2.25 0 0015 8.25V6a3 3 0 00-3-3z"/></svg>
                Armario
              </button>`:''
              }
              <button class="btn-add-gasto" onclick="toggleOutfitForm(${di});event.stopPropagation()">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
                Manual
              </button>
            </div>
          </div>
          ${oh}
          ${daySumH}
        </div>
      </div>
    </div>`;
  });

  return h;
}

/* ══════════ RENDER ══════════ */
function render(){
  saveState();
  const mc=$('main');
  if(VIEW==='it') mc.innerHTML=renderIt();
  else if(VIEW==='gas') mc.innerHTML=renderGas();
  else if(VIEW==='outfits') mc.innerHTML=renderOutfits();
  else if(VIEW==='armario') mc.innerHTML=renderArmario();
  else mc.innerHTML=renderMv();
  renderSidebar();
}

window.go = function go(v){
  VIEW=v;
  ['it','gas','mv','outfits','armario'].forEach(k=>{
    $('st-'+k)?.classList.toggle('active',k===v);
    $('mt-'+k)?.classList.toggle('active',k===v);
  });
  render();
}

window.togDay = function togDay(i){if(openDays.has(i))openDays.delete(i);else openDays.add(i);render();}
window.scrollTo = function scrollTo(di){
  openDays.add(di);
  if(VIEW!=='it')go('it');
  else render();
  setTimeout(()=>$('dc-'+di)?.scrollIntoView({behavior:'smooth',block:'start'}),80);
}
window.togDone = function togDone(di,ai,e){e.stopPropagation();IT[di].acts[ai].done=!IT[di].acts[ai].done;render();}

/* drag */
window.ds = function ds(e,di,ai){dragSrc={di,ai};e.currentTarget.classList.add('dragging');e.dataTransfer.effectAllowed='move';}
window.dov = function dov(e){e.preventDefault();e.currentTarget.classList.add('dragover');}
window.dl = function dl(e){e.currentTarget.classList.remove('dragover');}
window.ddr = function ddr(e,di,ai){
  e.currentTarget.classList.remove('dragover');
  if(!dragSrc||(dragSrc.di===di&&dragSrc.ai===ai))return;
  const s=IT[dragSrc.di].acts.splice(dragSrc.ai,1)[0];
  IT[di].acts.splice(ai,0,s);dragSrc=null;render();
}

/* modal */
function buildPicker(sel){
  $('dpicker').innerHTML=IT.map((d,i)=>
    `<button class="dopt${sel===i?' sel':''}" onclick="pickDay(${i})">${d.day}<div class="dopt-r">${d.route}</div></button>`
  ).join('');
}
window.pickDay = function pickDay(i){selDay=i;document.querySelectorAll('.dopt').forEach((b,idx)=>b.classList.toggle('sel',idx===i));}

window.openAdd = function openAdd(){
  editCtx={di:null,ai:null};selDay=null;
  $('modal-title').textContent='Nueva actividad';
  $('dp-sec').style.display='block';
  ['fn','ft','fsc','fv','fvu','fvt','fp'].forEach(id=>$(id).value='');
  $('fc').value='Comida';
  $('del-btn').style.display='none';
  buildPicker(null);
  $('modal-bg').classList.add('open');
}
window.openEdit = function openEdit(di,ai){
  const a=IT[di].acts[ai];
  editCtx={di,ai};selDay=di;
  $('modal-title').textContent='Editar actividad';
  $('dp-sec').style.display='none';
  $('fn').value=a.name||'';$('ft').value=a.time||'';$('fc').value=a.cat||'Comida';
  $('fsc').value=a.sub||'';$('fv').value=a.v||'';$('fvu').value=a.vu||'';
  $('fvt').value=a.vt||'';$('fp').value=a.pp||'';
  $('del-btn').style.display='block';
  $('modal-bg').classList.add('open');
}
window.saveAct = function saveAct(){
  if(selDay===null){const g=$('dpicker');g.style.outline='2px solid var(--red)';setTimeout(()=>g.style.outline='',1400);return;}
  const name=$('fn').value.trim();
  if(!name){$('fn').focus();return;}
  const act={id:nid++,name,time:$('ft').value.trim(),cat:$('fc').value,sub:$('fsc').value.trim(),
    v:$('fv').value.trim(),vu:$('fvu').value.trim(),vt:$('fvt').value.trim(),
    pp:Number($('fp').value)||0,done:false};
  const{di,ai}=editCtx;
  if(ai===null){IT[selDay].acts.push(act);openDays.add(selDay);}
  else{act.id=IT[di].acts[ai].id;act.done=IT[di].acts[ai].done;IT[di].acts[ai]=act;}
  closeModal();render();
}
window.delAct = function delAct(){IT[editCtx.di].acts.splice(editCtx.ai,1);closeModal();render();}
window.closeModal = function closeModal(){$('modal-bg').classList.remove('open');editCtx=null;selDay=null;}
window.bgClick = function bgClick(e){if(e.target.id==='modal-bg')closeModal();}
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    closeModal();
    closeClothDatesModal();
    closeAddFromWardrobeModal();
  }
  if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();openAdd();}
});

/* ══════════════════════════════════════════════════════
   MI ARMARIO – CLOSET MANAGEMENT
══════════════════════════════════════════════════════ */

/* ── Image Compression ── */
async function compressImage(file, maxPx=300){
  return new Promise((resolve)=>{
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = ()=>{
      const scale = Math.min(1, maxPx/Math.max(img.width,img.height));
      const w = Math.round(img.width*scale);
      const h = Math.round(img.height*scale);
      const canvas = document.createElement('canvas');
      canvas.width=w; canvas.height=h;
      canvas.getContext('2d').drawImage(img,0,0,w,h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.src = url;
  });
}

/* ── AI Categorization via Firebase Vertex AI ── */
async function classifyImageWithAI(base64data, mimeType){
  // Try Firebase Vertex AI (Gemini)
  try {
    const endpoint = `https://firebasevertexai.googleapis.com/v1beta/projects/jm-trips/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent?key=${firebaseConfig.apiKey}`;
    const body = {
      contents: [{
        parts: [
          { text: 'Clasifica esta prenda de ropa en UNA de estas categorías exactas: superior, inferior, conjunto, calzado, accesorios. Responde SOLO con la palabra de la categoría, sin más texto.' },
          { inlineData: { mimeType, data: base64data } }
        ]
      }],
      generationConfig: { maxOutputTokens: 20, temperature: 0 }
    };
    const resp = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    if(resp.ok){
      const json = await resp.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase() || '';
      const valid = ['superior','inferior','conjunto','calzado','accesorios'];
      const found = valid.find(v => text.includes(v));
      if(found) return found;
    }
  } catch(e){ console.warn('AI classify failed', e); }
  return null; // fallback
}

/* ── Filename fallback categorizer ── */
function guessCategory(name){
  const n = name.toLowerCase();
  if(/zapato|zapatilla|bota|sandalia|tenis|sneaker|heel|mocasin|chancla|calzado/.test(n)) return 'calzado';
  if(/pantalon|jean|short|falda|legging|bermuda|inferior/.test(n)) return 'inferior';
  if(/vestido|traje|conjunto|enterizo|mono|jumpsuit|overol/.test(n)) return 'conjunto';
  if(/collar|pulsera|aretes|sombrero|gorra|bolso|cinturon|bufanda|accesorio|gafas|reloj|cartera/.test(n)) return 'accesorios';
  return 'superior'; // default: shirts, polos, etc
}

/* ── Wardrobe State ── */
let newClothForm = { nombre:'', cat:'superior', precio:'', fechaCompra:'', imagen:null, imagenMime:null };
let armarioFormOpen = false;

/* ── Render Mi Armario ── */
function renderArmario(){
  // Apply filter & sort
  let items = [...armario];
  if(wardrobeFilter!=='all') items = items.filter(i=>i.cat===wardrobeFilter);
  if(wardrobeSort==='added') items.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  else if(wardrobeSort==='purchase') items.sort((a,b)=>{
    const da = a.fechaCompra||'0', db = b.fechaCompra||'0';
    return da<db?1:da>db?-1:0;
  });
  else if(wardrobeSort==='cat') items.sort((a,b)=>(a.cat||'').localeCompare(b.cat||''));
  else if(wardrobeSort==='price') items.sort((a,b)=>(b.precio||0)-(a.precio||0));

  const catOpts = OCAT_KEYS.map(k=>`<option value="${k}">${OCAT[k].icon} ${OCAT[k].label}</option>`).join('');

  // Filter buttons
  const filters = [
    {key:'all', label:'Todas'},
    ...OCAT_KEYS.map(k=>({key:k, label:`${OCAT[k].icon} ${OCAT[k].label}`}))
  ];
  const filterBtns = filters.map(f=>`<button class="wardrobe-filter-btn${wardrobeFilter===f.key?' active':''}" onclick="setWardrobeFilter('${f.key}')">${f.label}</button>`).join('');

  // Add form HTML
  let addFormH = '';
  if(armarioFormOpen){
    const prevImg = newClothForm.imagen
      ? `<div class="image-preview-container">
           <img class="image-preview-img" src="${newClothForm.imagen}" alt=""/>
           <div class="image-preview-info">${isAnalyzingImage?'<span class="ai-loader">✨ Analizando con IA...</span>':'Imagen cargada'}</div>
           <button class="image-remove-btn" onclick="removeNewClothImage()">✕</button>
         </div>`
      : `<label class="image-upload-wrapper" for="cloth-img-input">
           <input id="cloth-img-input" type="file" accept="image/*" style="display:none" onchange="handleClothImageUpload(event)"/>
           <div class="image-upload-icon">📷</div>
           <div class="image-upload-text">Toca para subir foto<br><small>La IA categoriza automáticamente</small></div>
         </label>`;

    addFormH = `
    <div class="day-card" style="margin-bottom:1.5rem;padding:1.2rem">
      <h3 style="font-family:var(--fd);font-size:1rem;font-weight:400;color:var(--gold);margin-bottom:1rem">✨ Nueva prenda</h3>
      <div class="field"><label>Foto de la prenda</label>${prevImg}</div>
      <div class="field">
        <label>Nombre de la prenda</label>
        <input id="new-cloth-nombre" class="gf-input" style="width:100%" placeholder="Ej: Camisa de lino blanca" value="${newClothForm.nombre.replace(/"/g,'&quot;')}" oninput="newClothForm.nombre=this.value"/>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
        <div class="field">
          <label>Categoría ${isAnalyzingImage?'<span class="ai-loader">IA...</span>':''}</label>
          <select id="new-cloth-cat" class="gf-select" style="width:100%">
            ${OCAT_KEYS.map(k=>`<option value="${k}"${newClothForm.cat===k?' selected':''}>${OCAT[k].icon} ${OCAT[k].label}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Precio (opcional)</label>
          <input id="new-cloth-precio" class="gf-input" style="width:100%" type="number" min="0" step="0.5" placeholder="$0.00" value="${newClothForm.precio}" oninput="newClothForm.precio=this.value"/>
        </div>
      </div>
      <div class="field">
        <label>Fecha de compra (opcional)</label>
        <input id="new-cloth-fecha" class="gf-input" style="width:100%" type="date" value="${newClothForm.fechaCompra}" oninput="newClothForm.fechaCompra=this.value"/>
      </div>
      <div style="display:flex;gap:.5rem;margin-top:.75rem">
        <button class="mbtn pri" style="flex:1" onclick="saveNewCloth()">Guardar prenda</button>
        <button class="mbtn sec" style="flex:0 0 auto;padding:.62rem 1rem" onclick="cancelNewCloth()">Cancelar</button>
      </div>
    </div>`;
  }

  // Cards grid
  const totalAll = armario.length;
  const cardsH = items.length===0
    ? `<div class="mv-empty" style="text-align:center">${
        totalAll===0
          ? 'Tu armario está vacío.<br>¡Agrega tu primera prenda!'
          : 'No hay prendas con este filtro.'
      }</div>`
    : items.map(item=>{
        const cat = OCAT[item.cat||'superior']||OCAT.superior;
        const imgH = item.imagen
          ? `<img class="wardrobe-img" src="${item.imagen}" alt="${item.nombre}" loading="lazy"/>`
          : `<div class="wardrobe-img-placeholder">${cat.icon}</div>`;
        const priceH = item.precio>0 ? `<div class="wardrobe-card-price">$${Number(item.precio).toFixed(2)}</div>` : '';
        const dateH = item.fechaCompra ? `<div class="wardrobe-card-date">🛒 ${item.fechaCompra.split('-').reverse().join('/')}</div>` : '';
        return `<div class="wardrobe-card">
          <div class="wardrobe-img-container">
            ${imgH}
            <span class="wardrobe-card-tag" style="background:${cat.color}cc">${cat.icon} ${cat.label}</span>
          </div>
          <div class="wardrobe-card-info">
            <div class="wardrobe-card-name" title="${item.nombre}">${item.nombre}</div>
            ${priceH}${dateH}
          </div>
          <div class="wardrobe-card-actions">
            <button class="wardrobe-card-btn add-btn" onclick="openClothDatesModal('${item.id}')">
              🧳 Equipaje
            </button>
            <button class="wardrobe-card-btn del-btn" onclick="deleteCloth('${item.id}')">
              🗑
            </button>
          </div>
        </div>`;
      }).join('');

  return `<div class="hero" style="margin-bottom:1rem">
    <div>
      <h2>Mi <em>Armario</em></h2>
      <div class="hero-sub">${totalAll} prenda${totalAll!==1?'s':''} · tu ropa guardada</div>
    </div>
    ${totalAll>0?`<div class="hstats">
      ${OCAT_KEYS.filter(k=>armario.some(i=>i.cat===k)).map(k=>{
        const c=OCAT[k]; const cnt=armario.filter(i=>i.cat===k).length;
        return `<div class="hstat"><div class="hv">${cnt}</div><div class="hl">${c.label}${cnt!==1?'s':''}</div></div>`;
      }).join('')}
    </div>`:''}
  </div>

  ${!armarioFormOpen?`<button class="mbtn pri" style="width:100%;margin-bottom:1.5rem;display:flex;align-items:center;justify-content:center;gap:.5rem" onclick="openNewClothForm()">
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
    Agregar nueva prenda
  </button>`:''}

  ${addFormH}

  <div class="wardrobe-controls">
    <div class="wardrobe-filters">${filterBtns}</div>
    <div class="wardrobe-sort">
      <label>Ordenar:</label>
      <select class="wardrobe-sort-select" onchange="setWardrobeSort(this.value)">
        <option value="added"${wardrobeSort==='added'?' selected':''}>Último agregado</option>
        <option value="purchase"${wardrobeSort==='purchase'?' selected':''}>Último en comprar</option>
        <option value="cat"${wardrobeSort==='cat'?' selected':''}>Categoría</option>
        <option value="price"${wardrobeSort==='price'?' selected':''}>Mayor precio</option>
      </select>
    </div>
  </div>

  <div class="wardrobe-grid">${cardsH}</div>`;
}

/* ── Wardrobe Controls ── */
window.setWardrobeFilter = function(f){ wardrobeFilter=f; render(); };
window.setWardrobeSort = function(s){ wardrobeSort=s; render(); };
window.openNewClothForm = function(){ armarioFormOpen=true; newClothForm={nombre:'',cat:'superior',precio:'',fechaCompra:'',imagen:null,imagenMime:null}; render(); };
window.cancelNewCloth = function(){ armarioFormOpen=false; render(); };
window.removeNewClothImage = function(){ newClothForm.imagen=null; newClothForm.imagenMime=null; render(); };

window.handleClothImageUpload = async function(e){
  const file = e.target.files[0];
  if(!file) return;
  // Compress first
  const compressed = await compressImage(file, 300);
  const base64 = compressed.split(',')[1];
  newClothForm.imagen = compressed;
  newClothForm.imagenMime = 'image/jpeg';
  // Try AI
  isAnalyzingImage = true;
  render();
  const aiCat = await classifyImageWithAI(base64, 'image/jpeg');
  if(aiCat){
    newClothForm.cat = aiCat;
  } else {
    // Fallback: guess from filename
    newClothForm.cat = guessCategory(file.name);
  }
  isAnalyzingImage = false;
  render();
};

window.saveNewCloth = async function(){
  // Sync form values from DOM
  const nombre = ($('new-cloth-nombre')?.value||'').trim();
  const cat = $('new-cloth-cat')?.value || newClothForm.cat;
  const precio = parseFloat($('new-cloth-precio')?.value||'0')||0;
  const fechaCompra = $('new-cloth-fecha')?.value||'';
  if(!nombre){ $('new-cloth-nombre')?.focus(); return; }
  if(!currentTripId) return;
  const item = {
    nombre, cat, precio, fechaCompra,
    imagen: newClothForm.imagen||null,
    createdAt: Date.now()
  };
  try{
    await addDoc(collection(db,'trips',currentTripId,'armario'), item);
    armarioFormOpen = false;
    newClothForm = { nombre:'',cat:'superior',precio:'',fechaCompra:'',imagen:null,imagenMime:null };
    render();
  } catch(err){ console.error('Error guardando prenda',err); alert('Error al guardar la prenda.'); }
};

window.deleteCloth = async function(clothId){
  if(!confirm('¿Eliminar esta prenda del armario?')) return;
  try{
    await deleteDoc(doc(db,'trips',currentTripId,'armario',clothId));
  } catch(e){ console.error(e); }
};

/* ── Add Cloth to Dates Modal (from Wardrobe card) ── */
window.openClothDatesModal = function(clothId){
  selectedClothForDates = clothId;
  const listEl = $('cloth-dates-list');
  if(listEl){
    listEl.innerHTML = IT.map((d,di)=>`
      <label class="date-checkbox-item">
        <input type="checkbox" value="${di}" style="accent-color:var(--gold)">
        <span><strong>${d.day}</strong> · <span style="color:var(--dim);font-size:.65rem">${d.route}</span></span>
      </label>`).join('');
  }
  $('cloth-dates-moment').value = 'dia';
  $('cloth-dates-modal-bg').classList.add('open');
};
window.closeClothDatesModal = function(){
  $('cloth-dates-modal-bg').classList.remove('open');
  selectedClothForDates = null;
};
window.clothDatesModalBgClick = function(e){ if(e.target.id==='cloth-dates-modal-bg') closeClothDatesModal(); };

window.saveClothToDates = function(){
  if(!selectedClothForDates || !activePerson) {
    if(!activePerson) alert('Primero selecciona una persona en la sección Equipaje.');
    return;
  }
  const cloth = armario.find(a=>a.id===selectedClothForDates);
  if(!cloth) return;
  const momento = $('cloth-dates-moment')?.value || 'dia';
  const checked = [...($('cloth-dates-list')?.querySelectorAll('input[type=checkbox]:checked')||[])];
  if(checked.length===0){ alert('Selecciona al menos un día.'); return; }
  checked.forEach(cb=>{
    const di = parseInt(cb.value);
    outfits[di].push({
      id: noid++,
      persona: activePerson,
      texto: cloth.nombre,
      cat: cloth.cat||'superior',
      momento,
      wardrobeId: cloth.id
    });
  });
  closeClothDatesModal();
  render();
};

/* ── Add from Wardrobe Modal (from Outfit day button) ── */
window.openAddFromWardrobeModal = function(di){
  activeDayForWardrobe = di;
  selectedWardrobeClothes = new Set();
  renderWardrobeSelectionList();
  $('wardrobe-add-moment').value = 'dia';
  if($('wardrobe-search-input')) $('wardrobe-search-input').value = '';
  $('add-from-wardrobe-modal-bg').classList.add('open');
};
window.closeAddFromWardrobeModal = function(){
  $('add-from-wardrobe-modal-bg').classList.remove('open');
  activeDayForWardrobe = null;
  selectedWardrobeClothes = new Set();
};
window.addFromWardrobeModalBgClick = function(e){ if(e.target.id==='add-from-wardrobe-modal-bg') closeAddFromWardrobeModal(); };

window.renderWardrobeSelectionList = function(){
  const listEl = $('wardrobe-selection-list');
  if(!listEl) return;
  const query = ($('wardrobe-search-input')?.value||'').toLowerCase().trim();
  const filtered = armario.filter(i=>!query || i.nombre.toLowerCase().includes(query));
  if(filtered.length===0){
    listEl.innerHTML = `<div class="wardrobe-selection-empty">No hay prendas${query?' con ese nombre':' en tu armario'}</div>`;
    return;
  }
  listEl.innerHTML = filtered.map(item=>{
    const cat = OCAT[item.cat||'superior']||OCAT.superior;
    const sel = selectedWardrobeClothes.has(item.id);
    const imgH = item.imagen
      ? `<img class="wardrobe-select-img" src="${item.imagen}" alt=""/>`
      : `<div class="wardrobe-select-img" style="background:${cat.color}22;display:flex;align-items:center;justify-content:center;font-size:1rem">${cat.icon}</div>`;
    return `<div class="wardrobe-selection-item${sel?' selected':''}" onclick="toggleWardrobeSelection('${item.id}')">
      ${imgH}
      <span class="wardrobe-select-name">${item.nombre}</span>
      <span class="wardrobe-select-cat" style="background:${cat.color}33;color:${cat.color}">${cat.icon}</span>
      ${sel?`<svg fill="none" viewBox="0 0 24 24" stroke="var(--gold)" stroke-width="2.5" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>`:''}
    </div>`;
  }).join('');
};

window.toggleWardrobeSelection = function(clothId){
  if(selectedWardrobeClothes.has(clothId)) selectedWardrobeClothes.delete(clothId);
  else selectedWardrobeClothes.add(clothId);
  renderWardrobeSelectionList();
};

window.addSelectedClothesToDay = function(){
  if(activeDayForWardrobe===null || !activePerson) {
    if(!activePerson) alert('Primero selecciona una persona en la sección Equipaje.');
    return;
  }
  if(selectedWardrobeClothes.size===0){ alert('Selecciona al menos una prenda.'); return; }
  const momento = $('wardrobe-add-moment')?.value || 'dia';
  selectedWardrobeClothes.forEach(clothId=>{
    const cloth = armario.find(a=>a.id===clothId);
    if(!cloth) return;
    outfits[activeDayForWardrobe].push({
      id: noid++,
      persona: activePerson,
      texto: cloth.nombre,
      cat: cloth.cat||'superior',
      momento,
      wardrobeId: cloth.id
    });
  });
  closeAddFromWardrobeModal();
  render();
};

// Start auth – everything loads inside the auth state handler
setupAuth();
