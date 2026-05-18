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

/* ══════════ STORAGE ══════════ */
const STORE_KEY='jmtrips_v1';

function saveState(){
  try{
    localStorage.setItem(STORE_KEY,JSON.stringify({
      P,IT,gastos,nid,ngid,
      openDays:[...openDays]
    }));
  }catch(e){console.warn('No se pudo guardar',e);}
}

function loadState(){
  try{
    const raw=localStorage.getItem(STORE_KEY);
    if(!raw)return false;
    const s=JSON.parse(raw);
    if(s.P)P=s.P;
    if(s.IT)IT=s.IT;
    if(s.gastos)gastos=s.gastos;
    if(s.nid)nid=s.nid;
    if(s.ngid)ngid=s.ngid;
    if(s.openDays)openDays=new Set(s.openDays);
    return true;
  }catch(e){return false;}
}

window.resetState = function resetState(){
  if(!confirm('¿Borrar todos los cambios y volver al itinerario original? Esta acción no se puede deshacer.'))return;
  localStorage.removeItem(STORE_KEY);
  location.reload();
}

/* ══════════ STATE ══════════ */
let P=2;
let VIEW='it';
let openDays=new Set([0]);
let openForms=new Set();
let editCtx=null;
let selDay=null;
let dragSrc=null;
let nid=200;
let ngid=1000;

/* ══════════ DATA ══════════ */
let gastos=Array(11).fill(null).map(()=>[]);

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

/* ══════════ RENDER ══════════ */
function render(){
  saveState();
  const mc=$('main');
  if(VIEW==='it') mc.innerHTML=renderIt();
  else if(VIEW==='gas') mc.innerHTML=renderGas();
  else mc.innerHTML=renderMv();
  renderSidebar();
}

window.go = function go(v){
  VIEW=v;
  ['it','gas','mv'].forEach(k=>{
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
  if(e.key==='Escape')closeModal();
  if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();openAdd();}
});

// Load saved state, then render
loadState();
$('pcount').textContent=P;
render();
