const CLASS_META = {
  Gladiator: { label: 'Gladiator', role: 'Melee DPS', color: '#E4A25B', glyph: '⚔', icon: 'https://raw.githubusercontent.com/rynnkitty/Aion2DpsMeter/main/Resources/%EA%B2%80%EC%84%B1.png' },
  Templar: { label: 'Templar', role: 'Tank', color: '#D7C274', glyph: '◈', icon: 'https://raw.githubusercontent.com/rynnkitty/Aion2DpsMeter/main/Resources/%EC%88%98%ED%98%B8%EC%84%B1.png' },
  Assassin: { label: 'Assassin', role: 'Melee DPS', color: '#D7649A', glyph: '✣', icon: 'https://raw.githubusercontent.com/rynnkitty/Aion2DpsMeter/main/Resources/%EC%82%B4%EC%84%B1.png' },
  Ranger: { label: 'Ranger', role: 'Ranged DPS', color: '#6FB8F1', glyph: '➶', icon: 'https://raw.githubusercontent.com/rynnkitty/Aion2DpsMeter/main/Resources/%EA%B6%81%EC%84%B1.png' },
  Chanter: { label: 'Chanter', role: 'Support', color: '#D0A7F4', glyph: 'ϟ', icon: 'https://raw.githubusercontent.com/rynnkitty/Aion2DpsMeter/main/Resources/%ED%98%B8%EB%B2%95%EC%84%B1.png' },
  Cleric: { label: 'Cleric', role: 'Healer', color: '#7FE0A6', glyph: '+', icon: 'https://raw.githubusercontent.com/rynnkitty/Aion2DpsMeter/main/Resources/%EC%B9%98%EC%9C%A0%EC%84%B1.png' },
  Sorcerer: { label: 'Sorcerer', role: 'Magic DPS', color: '#9A7CE8', glyph: '✦', icon: 'https://raw.githubusercontent.com/rynnkitty/Aion2DpsMeter/main/Resources/%EB%A7%88%EB%8F%84%EC%84%B1.png' },
  Spiritmaster: { label: 'Spiritmaster', role: 'Support / DPS', color: '#6BC8C5', glyph: '◉', icon: 'https://raw.githubusercontent.com/rynnkitty/Aion2DpsMeter/main/Resources/%EC%A0%95%EB%A0%B9%EC%84%B1.png' },
  Brawler: { label: 'Brawler', role: 'Melee DPS', color: '#FF5F7A', glyph: '✊', icon: null },
};
const CLASS_OPTIONS = Object.keys(CLASS_META);
const QUEST_CATEGORIES = { Misión: '◆', Mazmorra: '▣', Raid: '◈', PvP: '⚔', Mundo: '✦', Evento: '★' };
const WEEKDAYS = ['LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO','DOMINGO'];
const DB_NAME = 'aion2_daeva_command_center';
const DB_VERSION = 1;
const STORE_STATE = 'state';
const STORE_BACKUPS = 'backups';
const STATE_KEY = 'app';
const MAX_BACKUPS = 5;

const defaultState = () => ({
  version: 27,
  personajes: {},
  personaje_orden: [],
  actividades_diarias: {},
  actividades_semanales: {},
  progreso_diario: {},
  progreso_semanal: {},
  historial: [],
  reset_settings: { daily: { mode: 'AUTO', time: '00:00' }, weekly: { mode: 'AUTO', day: 0, time: '00:00' } },
  reset_state: { daily_period: null, weekly_period: null },
  font_scale: 1,
  session_state: { personaje_actual: null, fecha_diaria: null, tipo_actual: 'diaria', solo_pendientes: false },
});

let db;
let state = defaultState();
let selectedCharacter = null;
let selectedDate = null;
let activeTab = 'diaria';
let soloPending = false;
let undoSnapshot = null;
let currentFontScale = 1;
let deferredInstallPrompt = null;
let pwaInstalledDetected = false;
const PWA_INSTALLED_KEY = 'aion2_pwa_installed';
// Añade aquí tu URL de apoyo cuando la tengas (Ko-fi, Buy Me a Coffee, etc.).
const SUPPORT_URL = 'https://ko-fi.com/dkinghd_';


const $ = (id) => document.getElementById(String(id).replace(/^#/, ''));
const clone = (x) => structuredClone(x);
const todayISO = () => {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0,10);
};
const parseISO = (s) => { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); };
const dateISO = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const weekday = (d) => (d.getDay()+6)%7;
const startOfWeek = (d) => { const x = new Date(d); x.setDate(x.getDate()-weekday(x)); x.setHours(12,0,0,0); return x; };
const addDays = (d,n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const escapeHtml = (s='') => String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function openDB() {
  return new Promise((resolve,reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_STATE)) db.createObjectStore(STORE_STATE);
      if (!db.objectStoreNames.contains(STORE_BACKUPS)) db.createObjectStore(STORE_BACKUPS, { keyPath: 'id' });
    };
    req.onsuccess = () => { db=req.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}
function idbGet(store,key) {
  return new Promise((resolve,reject) => { const tx=db.transaction(store,'readonly'); const r=tx.objectStore(store).get(key); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); });
}
function idbPut(store,value,key) {
  return new Promise((resolve,reject) => { const tx=db.transaction(store,'readwrite'); const r=key===undefined?tx.objectStore(store).put(value):tx.objectStore(store).put(value,key); r.onsuccess=()=>resolve(); r.onerror=()=>reject(r.error); });
}
function idbAdd(store,value) {
  return new Promise((resolve,reject) => { const tx=db.transaction(store,'readwrite'); const r=tx.objectStore(store).add(value); r.onsuccess=()=>resolve(); r.onerror=()=>reject(r.error); });
}
function idbGetAll(store) {
  return new Promise((resolve,reject) => { const tx=db.transaction(store,'readonly'); const r=tx.objectStore(store).getAll(); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); });
}
function idbDelete(store,key) {
  return new Promise((resolve,reject) => { const tx=db.transaction(store,'readwrite'); const r=tx.objectStore(store).delete(key); r.onsuccess=()=>resolve(); r.onerror=()=>reject(r.error); });
}

function corePayload(obj) {
  const c = clone(obj); delete c.session_state; return c;
}
function coreEqual(a,b) { return JSON.stringify(corePayload(a)) === JSON.stringify(corePayload(b)); }
async function saveState({backup=true}={}) {
  const previous = await idbGet(STORE_STATE, STATE_KEY);
  if (backup && previous && !coreEqual(previous, state)) {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await idbAdd(STORE_BACKUPS, { id, createdAt: new Date().toISOString(), state: corePayload(previous) });
    const backups = await idbGetAll(STORE_BACKUPS);
    backups.sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
    while (backups.length > MAX_BACKUPS) await idbDelete(STORE_BACKUPS, backups.shift().id);
  }
  state.session_state = { personaje_actual: selectedCharacter, fecha_diaria: selectedDate, tipo_actual: activeTab, solo_pendientes: soloPending };
  state.font_scale = currentFontScale;
  await idbPut(STORE_STATE, clone(state), STATE_KEY);
}

function normalizeLoadedData(raw) {
  const s = defaultState();
  if (!raw || typeof raw !== 'object') return s;
  s.version = raw.version || 16;
  s.personajes = raw.personajes || {};
  s.personaje_orden = Array.isArray(raw.personaje_orden) ? raw.personaje_orden.filter(n => n in s.personajes) : Object.keys(s.personajes);
  const orderedNames = s.personaje_orden.filter(n => n in s.personajes);
  let mainName = orderedNames.find(n => Boolean(s.personajes[n]?.main)) || orderedNames.find(n => Boolean(s.personajes[n]?.favorito)) || null;
  Object.keys(s.personajes).forEach(n => {
    const p = s.personajes[n] || {};
    p.nivel = String(p.nivel ?? 'N/A');
    p.clase = normalizeClass(p.clase);
    // Migración de la antigua marca de favorito a MAIN. Solo puede existir un MAIN.
    p.main = mainName ? (n === mainName) : false;
    delete p.favorito;
    delete p.cuenta;
    s.personajes[n] = p;
    if (!s.personaje_orden.includes(n)) s.personaje_orden.push(n);
  });
  s.actividades_diarias = raw.actividades_diarias || {};
  s.actividades_semanales = raw.actividades_semanales || {};
  for (const col of [s.actividades_diarias,s.actividades_semanales]) {
    for (const [n,infoRaw] of Object.entries(col)) {
      const info = (infoRaw && typeof infoRaw === 'object') ? infoRaw : {};
      col[n] = { descripcion: String(info.descripcion ?? ''), recompensa: String(info.recompensa ?? ''), categoria: QUEST_CATEGORIES[info.categoria] ? info.categoria : 'Misión' };
    }
  }
  if ('progreso_diario' in raw || 'progreso_semanal' in raw) {
    s.progreso_diario = raw.progreso_diario || {};
    s.progreso_semanal = raw.progreso_semanal || {};
  } else {
    const legacy = raw.actividades_completadas || {};
    s.progreso_diario = legacy || {};
    s.progreso_semanal = {};
  }
  s.historial = Array.isArray(raw.historial) ? raw.historial.slice(-500) : [];
  s.reset_settings = clone(defaultState().reset_settings);
  if (raw.reset_settings?.daily) Object.assign(s.reset_settings.daily, raw.reset_settings.daily);
  if (raw.reset_settings?.weekly) Object.assign(s.reset_settings.weekly, raw.reset_settings.weekly);
  s.reset_settings.daily.mode = s.reset_settings.daily.mode === 'MANUAL' ? 'MANUAL' : 'AUTO';
  s.reset_settings.weekly.mode = s.reset_settings.weekly.mode === 'MANUAL' ? 'MANUAL' : 'AUTO';
  s.reset_settings.daily.time = normalizeTime(s.reset_settings.daily.time);
  s.reset_settings.weekly.time = normalizeTime(s.reset_settings.weekly.time);
  s.reset_settings.weekly.day = Math.max(0,Math.min(6,Number(s.reset_settings.weekly.day)||0));
  s.reset_state = Object.assign(s.reset_state, raw.reset_state || {});
  currentFontScale = Math.max(.85, Math.min(1.5, Number(raw.font_scale)||1));
  if (raw.session_state) s.session_state = Object.assign(s.session_state, raw.session_state);
  return s;
}
function normalizeClass(c) {
  const x=String(c||'').trim().toLowerCase();
  const map={gladiator:'Gladiator',gladiador:'Gladiator',templar:'Templar',templario:'Templar',assassin:'Assassin',asesino:'Assassin',marksman:'Ranger',tirador:'Ranger',ranger:'Ranger',chanter:'Chanter',cleric:'Cleric',clérigo:'Cleric',clerigo:'Cleric',sorcerer:'Sorcerer',hechicero:'Sorcerer',spiritmaster:'Spiritmaster',elementalist:'Spiritmaster',elementalista:'Spiritmaster',brawler:'Brawler'};
  return map[x] || 'Gladiator';
}
function normalizeTime(v) { const m=String(v||'00:00').match(/^(\d{1,2}):(\d{1,2})$/); if(!m) return '00:00'; const h=Math.max(0,Math.min(23,+m[1])); const mi=Math.max(0,Math.min(59,+m[2])); return `${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}`; }

function dailyBoundary(d=new Date()) {
  const [hh,mm]=normalizeTime(state.reset_settings.daily.time).split(':').map(Number);
  const b=new Date(d); b.setHours(hh,mm,0,0); if(d<b) b.setDate(b.getDate()-1); return b;
}
function activeDailyKey(d=new Date()) {
  if(state.reset_settings.daily.mode==='MANUAL') return state.reset_state.daily_period || dateISO(dailyBoundary(d));
  return dateISO(dailyBoundary(d));
}
function activeDailyDate(d=new Date()) { return parseISO(activeDailyKey(d)); }
function weeklyBoundary(d=new Date()) {
  const [hh,mm]=normalizeTime(state.reset_settings.weekly.time).split(':').map(Number);
  const day=Number(state.reset_settings.weekly.day)||0;
  const x=new Date(d); const delta=(x.getDay()+6)%7-day; x.setDate(x.getDate()-((delta+7)%7)); x.setHours(hh,mm,0,0); if(d<x) x.setDate(x.getDate()-7); return x;
}
function activeWeeklyKey(d=new Date()) { return state.reset_settings.weekly.mode==='MANUAL' ? (state.reset_state.weekly_period || dateISO(weeklyBoundary(d))) : dateISO(weeklyBoundary(d)); }
function nextDaily(d=new Date()) { const [hh,mm]=normalizeTime(state.reset_settings.daily.time).split(':').map(Number); const x=new Date(d); x.setHours(hh,mm,0,0); if(x<=d)x.setDate(x.getDate()+1); return x; }
function nextWeekly(d=new Date()) { const [hh,mm]=normalizeTime(state.reset_settings.weekly.time).split(':').map(Number); const day=Number(state.reset_settings.weekly.day)||0; const x=new Date(d); const delta=(day-(x.getDay()+6)%7+7)%7; x.setDate(x.getDate()+delta); x.setHours(hh,mm,0,0); if(x<=d)x.setDate(x.getDate()+7); return x; }

async function processAutomaticResets() {
  let changed=false;
  const now=new Date();
  const dKey=dateISO(dailyBoundary(now));
  const wKey=dateISO(weeklyBoundary(now));
  if(!state.reset_state.daily_period) state.reset_state.daily_period=dKey;
  if(!state.reset_state.weekly_period) state.reset_state.weekly_period=wKey;
  if(state.reset_settings.daily.mode==='AUTO' && state.reset_state.daily_period!==dKey){
    delete state.progreso_diario[dKey]; state.reset_state.daily_period=dKey; log('TODOS','sistema','','RESET DIARIO AUTOMÁTICO'); changed=true;
  }
  if(state.reset_settings.weekly.mode==='AUTO' && state.reset_state.weekly_period!==wKey){
    delete state.progreso_semanal[wKey]; state.reset_state.weekly_period=wKey; log('TODOS','sistema','','RESET SEMANAL AUTOMÁTICO'); changed=true;
  }
  if(changed) await saveState({backup:true});
}

function getDailyProgress(char, key=selectedDate || dateISO(activeDailyDate())) { return state.progreso_diario[key]?.[char] || {}; }
function getWeeklyProgress(char) { return state.progreso_semanal[activeWeeklyKey()]?.[char] || {}; }
function ensureProgress(type,key,char){ const root=type==='diaria'?state.progreso_diario:state.progreso_semanal; root[key]??={}; root[key][char]??={}; return root[key][char]; }
function counts(char){
  const dKey=selectedDate || dateISO(activeDailyDate());
  const d=getDailyProgress(char,dKey), s=getWeeklyProgress(char);
  const dt=Object.keys(state.actividades_diarias).length, st=Object.keys(state.actividades_semanales).length;
  const dc=Object.keys(state.actividades_diarias).filter(q=>d[q]).length, sc=Object.keys(state.actividades_semanales).filter(q=>s[q]).length;
  return {dc,dt,sc,st,pendingDaily:dt-dc,pendingWeekly:st-sc,pending:(dt-dc)+(st-sc), pct:(dt+st)?Math.round(((dc+sc)/(dt+st))*100):0};
}
function log(character,type,activity,action){ state.historial.push({ts:new Date().toLocaleString('es-ES'),personaje:character,tipo:type,actividad:activity,accion:action}); state.historial=state.historial.slice(-500); }

function render() {
  document.documentElement.style.setProperty('--scale', currentFontScale);
  renderResetStrip(); renderCharacterHeader(); renderRoster(); renderCalendar(); renderQuestTabs(); renderQuestLog(); updatePendingButton(); updateActionButtons();
}
function classEmblemHTML(clase, extra='') {
  const m=CLASS_META[clase]||CLASS_META.Gladiator;
  const inner=m.icon ? `<img src="${m.icon}" alt="${escapeHtml(m.label)}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="class-fallback" hidden>${m.glyph}</span>` : `<span class="class-fallback">${m.glyph}</span>`;
  return `<div class="class-emblem ${extra}" style="--class-color:${m.color}">${inner}</div>`;
}
function renderRoster() {
  const box=$('roster-list');
  const names=state.personaje_orden.filter(n=>n in state.personajes);
  if(!names.length){ box.innerHTML=`<div class="empty-state">Aún no hay personajes.<br>Usa + PERSONAJE para crear tu primer Daeva.</div>`; updateMoveButtons(); return; }
  box.innerHTML=names.map((name,i)=>{
    const p=state.personajes[name], c=counts(name), m=CLASS_META[p.clase];
    const status=c.pct===100?'COMPLETO':c.pending>Math.max(2,Math.ceil((c.dt+c.st)*.5))?'PENDIENTES':'EN PROGRESO';
    const statusClass=status==='COMPLETO'?'status-complete':status==='PENDIENTES'?'status-pending':'status-progress';
    return `<div class="alt-card ${name===selectedCharacter?'selected':''}" data-char="${escapeHtml(name)}">
      ${classEmblemHTML(p.clase)}
      <div class="alt-main"><div class="alt-name">${escapeHtml(name)}${p.main?'<span class="main-badge">MAIN</span>':''}</div><div class="alt-meta">Lv ${escapeHtml(p.nivel)} • ${escapeHtml(m.label)}</div><div class="alt-progress"><span style="width:${c.pct}%"></span></div><div class="alt-stats">D ${c.dc}/${c.dt} • S ${c.sc}/${c.st}</div></div>
      <div class="alt-side"><div class="alt-status ${statusClass}">${status}</div><div class="alt-quick"><button class="quick-btn" data-action="daily" data-char="${escapeHtml(name)}" ${isDailyActionAllowed(name)?'':'disabled'}>D</button><button class="quick-btn" data-action="weekly" data-char="${escapeHtml(name)}" ${isWeeklyActionAllowed(name)?'':'disabled'}>S</button></div></div>
    </div>`;
  }).join('');
  box.querySelectorAll('.alt-card').forEach(card=>card.addEventListener('click',e=>{ if(e.target.closest('button')) return; selectCharacter(card.dataset.char); }));
  box.querySelectorAll('.quick-btn').forEach(btn=>btn.addEventListener('click',async e=>{ e.stopPropagation(); const n=btn.dataset.char; if(btn.dataset.action==='daily') await completeDaily(n); else await completeWeekly(n); }));
  updateMoveButtons();
}
function renderCharacterHeader(){
  const box=$('character-header');
  if(!selectedCharacter || !(selectedCharacter in state.personajes)){ box.innerHTML=`<div class="character-identity"><div class="character-copy"><div class="section-kicker">CHARACTER</div><div class="name">Selecciona un personaje</div><div class="sub">Elige un alt en el roster para ver sus actividades.</div></div></div>`; return; }
  const p=state.personajes[selectedCharacter], c=counts(selectedCharacter), m=CLASS_META[p.clase];
  const pendingClass=c.pending===0?'clear':c.pending<=2?'low':'high';
  const pendingTitle=c.pending===0?'✓ PERSONAJE COMPLETO':`${c.pending} ACTIVIDADES PENDIENTES`;
  const pendingSub=c.pending===0?'No tienes tareas pendientes en este periodo.':`${c.pendingDaily} diarias • ${c.pendingWeekly} semanales`;
  box.innerHTML=`<div class="character-identity">${classEmblemHTML(p.clase,'character-big-emblem')}<div class="character-copy"><div class="section-kicker">ACTIVE DAEVA</div><div class="name">${escapeHtml(selectedCharacter)}${p.main?'<span class="main-badge main-badge-large">MAIN</span>':''}</div><div class="sub">Nivel ${escapeHtml(p.nivel)} • ${escapeHtml(m.label)} • ${escapeHtml(m.role)}</div></div></div><div class="pending-summary ${pendingClass}"><div class="pending-summary-title">${pendingTitle}</div><div class="pending-summary-sub">${pendingSub}</div></div><div class="character-metrics"><div class="metric"><div class="label">PROGRESO</div><div class="value">${c.pct}%</div></div><div class="metric"><div class="label">D / S</div><div class="value small">${c.dc}/${c.dt} · ${c.sc}/${c.st}</div></div></div>`;
}
function renderCalendar(){
  const box=$('week-grid');
  const start=startOfWeek(activeDailyDate());
  const wKey=activeWeeklyKey();
  const char=selectedCharacter;
  box.innerHTML=Array.from({length:7},(_,i)=>{
    const d=addDays(start,i), iso=dateISO(d), daily=getDailyProgress(char,iso), weekly=getWeeklyProgress(char);
    const dc=Object.keys(state.actividades_diarias).filter(q=>daily[q]).length, dt=Object.keys(state.actividades_diarias).length;
    const sc=Object.keys(state.actividades_semanales).filter(q=>weekly[q]).length, st=Object.keys(state.actividades_semanales).length;
    const isSel=selectedDate===iso, isToday=iso===dateISO(activeDailyDate());
    return `<div class="day-card ${isSel?'selected':''} ${isToday?'today':''}" data-date="${iso}"><div><div class="day-head"><div class="day-name">${WEEKDAYS[i]}</div>${isToday?'<span class="today-badge">● HOY</span>':''}</div><div class="day-date">${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}</div></div><div class="day-status"><div class="d">DIARIAS <strong>${dc}/${dt}</strong></div><div class="s">SEMANALES <strong>${sc}/${st}</strong></div></div></div>`;
  }).join('');
  box.querySelectorAll('.day-card').forEach(el=>el.addEventListener('click',()=>{selectedDate=el.dataset.date; render(); persistSession();}));
}
function renderQuestTabs(){
  const d=countForTab('diaria'), s=countForTab('semanal');
  $('tab-daily').innerHTML=`DIARIAS <span>${d.done}/${d.total}</span>`;
  $('tab-weekly').innerHTML=`SEMANALES <span>${s.done}/${s.total}</span>`;
  document.querySelectorAll('.quest-tab').forEach(b=>b.classList.toggle('active',b.dataset.type===activeTab));
}
function countForTab(type){ const char=selectedCharacter, list=type==='diaria'?state.actividades_diarias:state.actividades_semanales; const p=type==='diaria'?getDailyProgress(char,selectedDate):getWeeklyProgress(char); const total=Object.keys(list).length; const done=Object.keys(list).filter(q=>p[q]).length; return {done,total}; }
function renderQuestLog(){
  const list=activeTab==='diaria'?state.actividades_diarias:state.actividades_semanales;
  const prog=activeTab==='diaria'?getDailyProgress(selectedCharacter,selectedDate):getWeeklyProgress(selectedCharacter);
  const entries=Object.entries(list).filter(([q])=>!soloPending || !prog[q]);
  const box=$('quest-log');
  if(!selectedCharacter){ box.innerHTML=`<div class="empty-state">Selecciona un personaje para cargar sus actividades.</div>`; return; }
  if(!entries.length){ box.innerHTML=`<div class="empty-state">No quedan misiones pendientes en este periodo.</div>`; return; }
  box.innerHTML=entries.map(([name,info])=>`<div class="quest-row ${prog[name]?'completed':''}"><label class="quest-check-wrap" title="Marcar actividad"><input class="quest-check" type="checkbox" data-q="${escapeHtml(name)}" ${prog[name]?'checked':''}><span class="check-visual"></span></label><div class="quest-icon">${QUEST_CATEGORIES[info.categoria]||'◆'}</div><div class="quest-copy"><div class="quest-name">${escapeHtml(name)}</div>${info.descripcion?`<div class="quest-desc">${escapeHtml(info.descripcion)}</div>`:''}${info.recompensa?`<div class="quest-reward">${escapeHtml(info.recompensa)}</div>`:''}</div><div class="quest-category">${escapeHtml(info.categoria)}</div></div>`).join('');
  box.querySelectorAll('.quest-check').forEach(ch=>ch.addEventListener('change',()=>toggleQuest(ch.dataset.q,ch.checked)));
}
function renderResetStrip(){
  const nd=nextDaily(), nw=nextWeekly();
  const dailyMode=state.reset_settings.daily.mode==='AUTO'?'AUTO':'MANUAL';
  const weeklyMode=state.reset_settings.weekly.mode==='AUTO'?'AUTO':'MANUAL';
  $('reset-banner').innerHTML=`
    <div class="reset-card daily-reset">
      <div class="reset-card-top">
        <span class="reset-card-title">RESET DIARIO</span>
        <span class="reset-mode">${dailyMode}</span>
      </div>
      <div class="reset-countdown" aria-label="Tiempo hasta el reset diario">${fmtCountdown(nd)}</div>
      <div class="reset-meta">PRÓXIMO RESET · ${state.reset_settings.daily.time}</div>
    </div>
    <div class="reset-card weekly-reset">
      <div class="reset-card-top">
        <span class="reset-card-title">RESET SEMANAL</span>
        <span class="reset-mode">${weeklyMode}</span>
      </div>
      <div class="reset-countdown" aria-label="Tiempo hasta el reset semanal">${fmtCountdown(nw)}</div>
      <div class="reset-meta">PRÓXIMO RESET · ${WEEKDAYS[state.reset_settings.weekly.day]} ${state.reset_settings.weekly.time}</div>
    </div>`;
}
function updateActionButtons(){
  const has=Boolean(selectedCharacter), c=has?counts(selectedCharacter):null;
  $('btn-complete-daily').disabled=!has || !isDailyDateToday() || c.dc===c.dt;
  $('btn-complete-weekly').disabled=!has || c.sc===c.st;
  $('btn-clear').disabled=!has;
  $('btn-undo').disabled=!undoSnapshot;
  $('btn-edit-char').disabled=!has; $('btn-delete-char').disabled=!has;
}
function updateMoveButtons(){
  const names=state.personaje_orden.filter(n=>n in state.personajes); const i=names.indexOf(selectedCharacter); $('btn-up').disabled=i<=0; $('btn-down').disabled=i<0 || i>=names.length-1; }
function updatePendingButton(){ const c=selectedCharacter?counts(selectedCharacter):null; const pending=c?c.pending:0; const b=$('btn-pending'); if(!b)return; b.textContent=(soloPending?'●':'◌')+' SOLO PENDIENTES · '+pending; b.classList.toggle('pending-active',soloPending); b.classList.toggle('has-pending',pending>0); }
function updateUndoButton(){ $('btn-undo').disabled=!undoSnapshot; }
function updateAll(){ updatePendingButton(); render(); }

function selectCharacter(name){ if(!(name in state.personajes)) return; selectedCharacter=name; if(!selectedDate) selectedDate=dateISO(activeDailyDate()); render(); persistSession(); }
function persistSession(){ saveState({backup:false}).catch(console.error); }
function isDailyDateToday(){ return selectedDate===dateISO(activeDailyDate()); }
function isDailyActionAllowed(){ return isDailyDateToday(); }
function isWeeklyActionAllowed(name){ const c=counts(name); return c.sc<c.st; }

async function toggleQuest(name, value){
  if(!selectedCharacter) return;
  if(activeTab==='diaria' && !isDailyDateToday()){ toast('Las diarias solo se pueden marcar en el día actual.'); render(); return; }
  const key=activeTab==='diaria'?selectedDate:activeWeeklyKey();
  const p=ensureProgress(activeTab,key,selectedCharacter); p[name]=value;
  log(selectedCharacter,activeTab,name,value?'COMPLETADA':'DESMARCADA');
  undoSnapshot=null; await saveState(); render();
}
async function completeDaily(name=selectedCharacter){
  if(!name || !(name in state.personajes)) return;
  if(!isDailyDateToday()){toast('Las diarias solo están disponibles en el día actual.');return;}
  const p=ensureProgress('diaria',selectedDate,name);
  for(const q of Object.keys(state.actividades_diarias)) p[q]=true;
  log(name,'diaria','','COMPLETAR TODAS LAS DIARIAS'); await saveState(); render(); toast(`${name}: diarias completadas.`);
}
async function completeWeekly(name=selectedCharacter){
  if(!name || !(name in state.personajes)) return;
  const p=ensureProgress('semanal',activeWeeklyKey(),name);
  for(const q of Object.keys(state.actividades_semanales)) p[q]=true;
  log(name,'semanal','','COMPLETAR TODAS LAS SEMANALES'); await saveState(); render(); toast(`${name}: semanales completadas.`);
}
async function clearActive(){
  if(!selectedCharacter) return;
  undoSnapshot=clone(state);
  if(activeTab==='diaria'){
    const p=ensureProgress('diaria',selectedDate,selectedCharacter); for(const q of Object.keys(p)) delete p[q]; log(selectedCharacter,'diaria','','LIMPIAR');
  } else {
    const p=ensureProgress('semanal',activeWeeklyKey(),selectedCharacter); for(const q of Object.keys(p)) delete p[q]; log(selectedCharacter,'semanal','','LIMPIAR');
  }
  await saveState(); render(); toast(activeTab==='diaria'?'Diarias limpiadas.':'Semanales limpiadas.');
}
async function undoClear(){ if(!undoSnapshot)return; state=clone(undoSnapshot); undoSnapshot=null; selectedCharacter=state.session_state.personaje_actual||selectedCharacter; selectedDate=state.session_state.fecha_diaria||selectedDate; activeTab=state.session_state.tipo_actual||activeTab; soloPending=Boolean(state.session_state.solo_pendientes); await saveState({backup:false}); render(); toast('Última limpieza deshecha.'); }
async function moveCharacter(delta){
  const names=state.personaje_orden.filter(n=>n in state.personajes), i=names.indexOf(selectedCharacter), j=i+delta; if(i<0||j<0||j>=names.length)return;
  const a=names[i],b=names[j]; const idxA=state.personaje_orden.indexOf(a), idxB=state.personaje_orden.indexOf(b); [state.personaje_orden[idxA],state.personaje_orden[idxB]]=[state.personaje_orden[idxB],state.personaje_orden[idxA]]; await saveState(); render(); }
function currentMainName(exclude=null){
  return state.personaje_orden.find(n => n in state.personajes && n !== exclude && state.personajes[n]?.main) || null;
}
function setMainCharacter(name, enabled){
  if(enabled){
    const existing=currentMainName(name);
    if(existing){ return {ok:false, existing}; }
    state.personajes[name].main=true;
  }else{
    state.personajes[name].main=false;
  }
  return {ok:true};
}

function toast(msg){ const el=document.createElement('div'); el.className='toast'; el.textContent=msg; $('toast-root').appendChild(el); setTimeout(()=>el.remove(),2200); }
function isStandaloneMode(){
  return window.matchMedia?.('(display-mode: standalone)').matches || window.matchMedia?.('(display-mode: window-controls-overlay)').matches || window.navigator.standalone===true;
}
function isIOS(){
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function markPWAInstalled(){
  pwaInstalledDetected = true;
  try{ localStorage.setItem(PWA_INSTALLED_KEY,'1'); }catch(_){ }
}
function clearPWAInstalledMarker(){
  pwaInstalledDetected = false;
  try{ localStorage.removeItem(PWA_INSTALLED_KEY); }catch(_){ }
}
async function detectInstalledPWA(){
  // A standalone/window-controls-overlay launch is definitive.
  if(isStandaloneMode()){
    markPWAInstalled();
    return true;
  }

  // On supported Chromium desktop versions, getInstalledRelatedApps() can
  // detect this exact PWA from a normal browser tab. The manifest relates the
  // web app to itself, so we verify the returned webapp id when available.
  try{
    if(typeof navigator.getInstalledRelatedApps === 'function'){
      const apps = await navigator.getInstalledRelatedApps();
      const manifestUrl = new URL('manifest.webmanifest', document.baseURI).href;
      const manifestId = './?app=aion2-daeva-command-center';
      const installed = apps.some(app => {
        if(app?.platform !== 'webapp') return false;
        if(!app.id) return true;
        try {
          return app.id === new URL(manifestId, document.baseURI).href
              || app.id === manifestId
              || app.url === manifestUrl;
        } catch(_) {
          return false;
        }
      });
      if(installed){
        markPWAInstalled();
        return true;
      }
      // A supported API returning no matching webapp is stronger than an old
      // local marker and lets us recover correctly after an uninstall.
      clearPWAInstalledMarker();
      return false;
    }
  }catch(err){
    console.debug('No se pudo consultar la instalación PWA.',err);
  }

  // Fallback for browsers without the API. This marker is set only after the
  // browser confirms the installation through appinstalled.
  try{ pwaInstalledDetected = localStorage.getItem(PWA_INSTALLED_KEY)==='1'; }catch(_){ }
  return pwaInstalledDetected;
}
function updateInstallButton(){
  const b=$('btn-install');
  const help=$('btn-install-help');
  if(!b) return;
  const standalone=isStandaloneMode();
  const installed=standalone || pwaInstalledDetected;
  b.hidden=installed;
  if(help) help.hidden=installed;
  if(installed) return;
  if(deferredInstallPrompt){
    b.disabled=false;
    b.dataset.installReady='true';
    b.textContent='⬇ INSTALAR APP';
    const badge=document.createElement('span'); badge.className='install-new-badge'; badge.textContent='RECOMENDADO'; b.appendChild(badge);
    b.title='Instalar como aplicación';
    b.setAttribute('aria-busy','false');
  }else if(isIOS()){
    b.disabled=false;
    b.dataset.installReady='false';
    b.textContent='⬇ CÓMO INSTALAR';
    b.title='Abrir instrucciones de instalación para iPhone/iPad';
    b.setAttribute('aria-busy','false');
  }else{
    b.dataset.installReady='false';
    b.disabled=false;
    b.textContent='⬇ INSTALAR APP';
    const badge=document.createElement('span'); badge.className='install-new-badge'; badge.textContent='RECOMENDADO'; b.appendChild(badge);
    b.title='La instalación directa se activará cuando el navegador la ofrezca';
    b.setAttribute('aria-busy','true');
  }
}
function setupPWA(){
  // Register immediately so we cannot miss beforeinstallprompt.
  window.addEventListener('beforeinstallprompt', e=>{
    e.preventDefault();
    deferredInstallPrompt=e;
    updateInstallButton();
  });
  window.addEventListener('appinstalled', ()=>{
    deferredInstallPrompt=null;
    markPWAInstalled();
    updateInstallButton();
    toast('AION2 Daeva Command Center instalado.');
  });

  // Run an immediate check, then re-check when returning to the normal web
  // tab. This helps when the user installs/uninstalls the PWA from Chrome's
  // own menu rather than through our button.
  try{ pwaInstalledDetected = isStandaloneMode() || localStorage.getItem(PWA_INSTALLED_KEY)==='1'; }catch(_){ pwaInstalledDetected=isStandaloneMode(); }
  updateInstallButton();
  detectInstalledPWA().then(()=>updateInstallButton()).catch(()=>{});
  window.addEventListener('focus', ()=>{ detectInstalledPWA().then(()=>updateInstallButton()).catch(()=>{}); });
  document.addEventListener('visibilitychange', ()=>{
    if(document.visibilityState === 'visible') detectInstalledPWA().then(()=>updateInstallButton()).catch(()=>{});
  });
}
function fmtCountdown(target){ let sec=Math.max(0,Math.floor((target-new Date())/1000)); const d=Math.floor(sec/86400); sec%=86400; const h=Math.floor(sec/3600); sec%=3600; const m=Math.floor(sec/60); const s=sec%60; return d?`${d}d ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`:`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }

function openModal(title,body,footer=''){ const root=$('modal-root'); root.innerHTML=`<div class="modal-backdrop" data-close><div class="modal"><div class="modal-header"><h3>${title}</h3><button class="icon-btn" data-close>×</button></div><div class="modal-body">${body}</div>${footer?`<div class="modal-footer">${footer}</div>`:''}</div></div>`; root.querySelector('.modal-backdrop').addEventListener('click',e=>{if(e.target.dataset.close!==undefined)closeModal()}); return root.querySelector('.modal'); }
function closeModal(){ $('modal-root').innerHTML=''; }
function showInstallHelp(){
  openModal('CÓMO INSTALAR AION II DAEVA COMMAND CENTER',`
    <div class="install-help">
      <p><strong>Chrome / Edge en PC:</strong> cuando la instalación directa esté disponible, pulsa <strong>⬇ INSTALAR APP</strong> para abrir el diálogo nativo. Si no aparece todavía, Chrome puede mostrar el icono de instalación en la barra de direcciones.</p>
      <p><strong>Android:</strong> usa el menú <strong>⋮</strong> y selecciona <strong>Instalar app</strong> cuando el navegador lo ofrezca.</p>
      <p><strong>iPhone / iPad:</strong> en Safari, usa <strong>Compartir → Añadir a pantalla de inicio</strong>.</p>
      <p class="muted">El botón de instalación directa depende del navegador y solo se habilita cuando este comunica que la web puede instalarse.</p>
    </div>`,
    '<button class="btn btn-ghost" data-close>CERRAR</button>'
  );
}

function showCharacterForm(name=null){
  const existing=name?state.personajes[name]:null;
  const p=existing||{nivel:'',clase:'Gladiator',main:false};
  const anotherMain=currentMainName(name);
  const mainLocked=Boolean(anotherMain);
  const mainChecked=Boolean(p.main);
  const mainField = `<div class="field full main-field"><label class="main-option ${mainLocked&&!mainChecked?'disabled':''}"><input id="f-main" type="checkbox" ${mainChecked?'checked':''} ${mainLocked&&!mainChecked?'disabled':''}> <span>MARCAR COMO MAIN</span></label><div class="field-help">${mainLocked&&!mainChecked?`Ya tienes a <strong>${escapeHtml(anotherMain)}</strong> como MAIN. Solo puede haber un MAIN.`:'Tu personaje principal. Solo puede existir un MAIN en el roster.'}</div></div>`;
  const m=openModal(name?'EDITAR PERSONAJE':'NUEVO PERSONAJE',`<div class="form-grid"><div class="field"><label>NOMBRE</label><input id="f-name" value="${escapeHtml(name||'')}" autocomplete="off"></div><div class="field"><label>NIVEL</label><input id="f-level" value="${escapeHtml(p.nivel||'')}" autocomplete="off"></div><div class="field full"><label>CLASE</label><select id="f-class">${CLASS_OPTIONS.map(c=>`<option value="${c}" ${c===p.clase?'selected':''}>${c}</option>`).join('')}</select></div>${mainField}</div>`,`<button class="btn btn-ghost" data-close>CANCELAR</button><button class="btn btn-primary" id="form-save">GUARDAR</button>`);
  m.querySelector('#form-save').onclick=async()=>{
    const newName=m.querySelector('#f-name').value.trim();
    const level=m.querySelector('#f-level').value.trim()||'N/A';
    const clase=normalizeClass(m.querySelector('#f-class').value);
    const wantsMain=m.querySelector('#f-main').checked;
    if(!newName){toast('Escribe un nombre.');return;}
    if(!name && state.personajes[newName]){toast('Ese personaje ya existe.');return;}
    if(name && newName!==name && state.personajes[newName]){toast('Ya existe otro personaje con ese nombre.');return;}
    if(wantsMain){
      const existingMain=currentMainName(name);
      if(existingMain){ toast(`Ya existe un MAIN: ${existingMain}. Primero quítale el MAIN.`); return; }
    }
    if(name && newName!==name){
      state.personajes[newName]=state.personajes[name]; delete state.personajes[name];
      const i=state.personaje_orden.indexOf(name); if(i>=0)state.personaje_orden[i]=newName;
      renameProgress(name,newName); if(selectedCharacter===name)selectedCharacter=newName;
    }
    state.personajes[newName]={nivel:level,clase,main:Boolean(wantsMain)};
    if(!state.personaje_orden.includes(newName))state.personaje_orden.push(newName);
    selectedCharacter=newName; selectedDate=selectedDate||dateISO(activeDailyDate());
    log(newName,'sistema','', 'PERSONAJE '+(name?'EDITADO':'CREADO')+(wantsMain?' • MAIN':''));
    await saveState(); closeModal(); render();
    if(wantsMain) toast(`${newName} ahora es el MAIN.`);
  };
}
function renameProgress(oldName,newName){ for(const root of [state.progreso_diario,state.progreso_semanal]) for(const key of Object.keys(root)){ if(root[key]?.[oldName]){root[key][newName]=root[key][oldName]; delete root[key][oldName];} } }
async function deleteCharacter(){ if(!selectedCharacter)return; if(!confirm(`¿Eliminar a ${selectedCharacter}?`))return; const old=selectedCharacter; delete state.personajes[old]; state.personaje_orden=state.personaje_orden.filter(n=>n!==old); for(const root of [state.progreso_diario,state.progreso_semanal]) for(const key of Object.keys(root)) delete root[key]?.[old]; selectedCharacter=state.personaje_orden[0]||null; log(old,'sistema','','PERSONAJE ELIMINADO'); await saveState(); render(); }

function showQuestForm(tipo,name=null,returnToManager=false){
  const col=tipo==='diaria'?state.actividades_diarias:state.actividades_semanales;
  const q=name?col[name]:{descripcion:'',recompensa:'',categoria:'Misión'};
  const periodLabel=tipo==='diaria'?'ACTIVIDAD DIARIA':'ACTIVIDAD SEMANAL';
  const modeLabel=name?'EDITAR':'NUEVA';
  const identity=name
    ? `<div class="mission-edit-banner"><span class="mission-edit-kicker">${periodLabel}</span><strong>${escapeHtml(name)}</strong><span class="mission-edit-state">EDITANDO</span></div>`
    : `<div class="mission-edit-banner new"><span class="mission-edit-kicker">${periodLabel}</span><strong>Nueva actividad</strong><span class="mission-edit-state">CREANDO</span></div>`;
  const cancelAction = returnToManager ? 'id="form-cancel"' : 'data-close';
  const m=openModal(
    `${modeLabel} ${tipo==='diaria'?'DIARIA':'SEMANAL'}`,
    `${identity}<div class="form-grid"><div class="field full"><label>NOMBRE DE LA ACTIVIDAD</label><input id="q-name" value="${escapeHtml(name||'')}" autocomplete="off"></div><div class="field"><label>CATEGORÍA</label><select id="q-cat">${Object.keys(QUEST_CATEGORIES).map(c=>`<option value="${c}" ${c===q.categoria?'selected':''}>${c}</option>`).join('')}</select></div><div class="field"><label>RECOMPENSA</label><input id="q-reward" value="${escapeHtml(q.recompensa||'')}" autocomplete="off"></div><div class="field full"><label>DESCRIPCIÓN</label><textarea id="q-desc">${escapeHtml(q.descripcion||'')}</textarea></div></div>`,
    `<button class="btn btn-ghost" ${cancelAction}>CANCELAR</button><button class="btn btn-primary" id="form-save">${name?'GUARDAR CAMBIOS':'CREAR ACTIVIDAD'}</button>`
  );
  if(returnToManager){
    m.querySelector('#form-cancel').onclick=()=>showQuestManager();
  }
  m.querySelector('#form-save').onclick=async()=>{
    const nn=m.querySelector('#q-name').value.trim();
    if(!nn){toast('Escribe un nombre.');return;}
    if(!name&&col[nn]){toast('Esa misión ya existe.');return;}
    if(name&&nn!==name&&col[nn]){toast('Ya existe otra misión con ese nombre.');return;}
    if(name&&nn!==name){col[nn]=col[name];delete col[name];renameQuestProgress(tipo,name,nn);}
    col[nn]={
      descripcion:m.querySelector('#q-desc').value.trim(),
      recompensa:m.querySelector('#q-reward').value.trim(),
      categoria:m.querySelector('#q-cat').value
    };
    log(selectedCharacter||'TODOS',tipo,nn,'MISIÓN '+(name?'EDITADA':'CREADA'));
    await saveState();
    if(returnToManager){
      render();
      showQuestManager();
      toast(name?'Misión actualizada.':'Actividad creada.');
    }else{
      closeModal();
      render();
    }
  };
}
function renameQuestProgress(tipo,oldName,newName){ const root=tipo==='diaria'?state.progreso_diario:state.progreso_semanal; for(const key of Object.keys(root)) for(const p of Object.keys(root[key]||{})){ if(root[key][p]?.[oldName]!==undefined){root[key][p][newName]=root[key][p][oldName];delete root[key][p][oldName];}} }
async function deleteQuest(tipo,name){ const col=tipo==='diaria'?state.actividades_diarias:state.actividades_semanales; if(!confirm(`¿Eliminar la misión "${name}"?`))return; delete col[name]; const root=tipo==='diaria'?state.progreso_diario:state.progreso_semanal; for(const key of Object.keys(root)) for(const p of Object.keys(root[key]||{})) delete root[key][p]?.[name]; await saveState(); render(); }
function showQuestManager(){
  const dailyCount=Object.keys(state.actividades_diarias||{}).length;
  const weeklyCount=Object.keys(state.actividades_semanales||{}).length;
  const body=`<div class="manager-toolbar"><div class="manager-toolbar-copy"><div class="section-kicker">ACTIVIDADES</div><div class="manager-toolbar-sub">Selecciona EDITAR para modificar una misión sin perder su progreso. La ventana permanece abierta al crear o editar varias actividades.</div></div><div class="roster-actions" style="padding:0;border:0"><button class="btn btn-primary" id="add-d">+ DIARIA</button><button class="btn btn-secondary" id="add-s">+ SEMANAL</button></div></div><div class="form-grid manager-columns"><div class="manager-column"><div class="manager-column-head"><div class="section-kicker">DIARIAS</div><span class="manager-count">${dailyCount}</span></div><div id="daily-list"></div></div><div class="manager-column"><div class="manager-column-head"><div class="section-kicker">SEMANALES</div><span class="manager-count">${weeklyCount}</span></div><div id="weekly-list"></div></div></div>`;
  const m=openModal('GESTIONAR MISIONES',body,'<button class="btn btn-ghost" data-close>CERRAR</button>');
  const dailyList=m.querySelector('#daily-list');
  const weeklyList=m.querySelector('#weekly-list');

  const fill=(tipo,el)=>{
    const col=tipo==='diaria'?(state.actividades_diarias||{}):(state.actividades_semanales||{});
    const items=Object.entries(col);
    el.innerHTML=items.length?items.map(([n,info])=>{
      const safeInfo=info&&typeof info==='object'?info:{};
      const desc=safeInfo.descripcion||'';
      return `<div class="quest-manager-item"><div class="quest-manager-main"><div class="quest-manager-name">${escapeHtml(n)}</div><div class="quest-manager-badges"><span class="manager-badge category">${escapeHtml(safeInfo.categoria||'Misión')}</span>${safeInfo.recompensa?`<span class="manager-badge reward">${escapeHtml(safeInfo.recompensa)}</span>`:''}</div>${desc?`<div class="quest-manager-desc">${escapeHtml(desc)}</div>`:`<div class="quest-manager-desc empty">Sin descripción</div>`}</div><div class="quest-manager-actions"><button class="quick-btn edit" type="button" data-edit="${escapeHtml(n)}">✎ EDITAR</button><button class="quick-btn delete" type="button" data-del="${escapeHtml(n)}" aria-label="Eliminar ${escapeHtml(n)}">×</button></div></div>`;
    }).join(''):'<div class="quest-manager-empty">Sin misiones.</div>';
    el.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>showQuestForm(tipo,b.dataset.edit,true)));
    el.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',async()=>{
      await deleteQuest(tipo,b.dataset.del);
      render();
      fill('diaria',dailyList);
      fill('semanal',weeklyList);
    }));
  };

  m.querySelector('#add-d').addEventListener('click',()=>showQuestForm('diaria',null,true));
  m.querySelector('#add-s').addEventListener('click',()=>showQuestForm('semanal',null,true));
  fill('diaria',dailyList);
  fill('semanal',weeklyList);
}


function showSupport(){
  const body = `<div class="support-modal">
    <div class="support-hero">
      <div class="support-icon">☕</div>
      <div>
        <div class="support-kicker">PROYECTO COMUNITARIO</div>
        <div class="support-title">APOYA A <span>DKINGHD</span></div>
      </div>
    </div>
    <p class="support-copy">Daeva Command Center es una herramienta gratuita creada y mantenida por <strong>dkinghd</strong> para facilitar la gestión de personajes y actividades de AION II.</p>
    <div class="support-options">
      <div class="support-option">
        <div class="support-option-icon">☕</div>
        <div>
          <div class="support-option-title">APOYO ÚNICO</div>
          <div class="support-option-text">Una ayuda puntual para mantener y seguir mejorando el proyecto.</div>
        </div>
      </div>
      <div class="support-option">
        <div class="support-option-icon monthly">💙</div>
        <div>
          <div class="support-option-title">APOYO RECURRENTE</div>
          <div class="support-option-text">Si prefieres apoyar el proyecto de forma continuada, puedes elegir esa opción en Ko-fi.</div>
        </div>
      </div>
    </div>
    <div class="support-note">Todo el contenido del tracker sigue siendo gratuito.</div>
    ${SUPPORT_URL
      ? `<a class="btn support-cta" href="${SUPPORT_URL}" target="_blank" rel="noopener noreferrer">☕ IR A KO-FI <span>↗</span></a>`
      : `<div class="support-placeholder">ENLACE DE APOYO PENDIENTE</div>`}
    <div class="support-brandline">AION II DAEVA COMMAND CENTER · <strong>by dkinghd</strong></div>
  </div>`;
  openModal('APOYAR EL PROYECTO', body, '<button class="btn btn-ghost" data-close>CERRAR</button>');
}

function showHistory(){
  const body=`<div class="history-list">${state.historial.slice().reverse().slice(0,300).map(x=>`<div class="history-item">${escapeHtml(x.ts)} &nbsp;|&nbsp; ${escapeHtml(x.personaje||'-')} &nbsp;|&nbsp; ${escapeHtml(x.accion||'')}${x.actividad?` &nbsp;•&nbsp; ${escapeHtml(x.actividad)}`:''}</div>`).join('')||'<div style="color:var(--muted)">No hay actividad registrada.</div>'}</div>`;
  openModal('ACTIVITY HISTORY',body,'<button class="btn btn-ghost" data-close>CERRAR</button>');
}
function showFont(){
  const body=`<div class="font-control"><button class="btn btn-small" id="font-minus">−</button><div class="font-value" id="font-value">${Math.round(currentFontScale*100)}%</div><button class="btn btn-small" id="font-plus">+</button></div><p style="margin-top:12px;color:var(--muted);font-size:11px">Ajusta únicamente los textos de la aplicación. Los botones mantienen su tamaño.</p>`;
  const m=openModal('TAMAÑO DE TEXTO',body,'<button class="btn btn-ghost" data-close>CERRAR</button>');
  const set=(v)=>{currentFontScale=Math.max(.85,Math.min(1.5,Math.round(v*20)/20)); m.querySelector('#font-value').textContent=Math.round(currentFontScale*100)+'%'; render(); saveState({backup:false});};
  m.querySelector('#font-minus').onclick=()=>set(currentFontScale-.05); m.querySelector('#font-plus').onclick=()=>set(currentFontScale+.05);
}
function showResets(){
  const r=state.reset_settings; const body=`<div class="form-grid"><div class="field full"><label>RESET DIARIO</label><div class="radio-row"><label><input type="radio" name="d-mode" value="AUTO" ${r.daily.mode==='AUTO'?'checked':''}> AUTOMÁTICO</label><label><input type="radio" name="d-mode" value="MANUAL" ${r.daily.mode==='MANUAL'?'checked':''}> MANUAL</label></div></div><div class="field"><label>HORA DIARIA</label><input id="d-time" type="time" value="${r.daily.time}"></div><div></div><div class="field full"><label>RESET SEMANAL</label><div class="radio-row"><label><input type="radio" name="w-mode" value="AUTO" ${r.weekly.mode==='AUTO'?'checked':''}> AUTOMÁTICO</label><label><input type="radio" name="w-mode" value="MANUAL" ${r.weekly.mode==='MANUAL'?'checked':''}> MANUAL</label></div></div><div class="field"><label>DÍA</label><select id="w-day">${WEEKDAYS.map((d,i)=>`<option value="${i}" ${i===r.weekly.day?'selected':''}>${d}</option>`).join('')}</select></div><div class="field"><label>HORA SEMANAL</label><input id="w-time" type="time" value="${r.weekly.time}"></div></div><div style="margin-top:14px;padding:10px;border:1px solid #1d2c45;color:var(--muted);font-size:10px">AUTO detecta el nuevo periodo al abrir/usar la aplicación. MANUAL mantiene el periodo hasta que hagas el reset correspondiente.</div>`;
  const m=openModal('CONFIGURACIÓN DE RESETS',body,'<button class="btn btn-small" id="manual-d">↺ RESET DIARIO AHORA</button><button class="btn btn-small" id="manual-w">↺ RESET SEMANAL AHORA</button><button class="btn btn-ghost" data-close>CANCELAR</button><button class="btn btn-primary" id="save-reset">GUARDAR</button>');
  m.querySelector('#save-reset').onclick=async()=>{ state.reset_settings.daily.mode=m.querySelector('input[name="d-mode"]:checked').value; state.reset_settings.daily.time=normalizeTime(m.querySelector('#d-time').value); state.reset_settings.weekly.mode=m.querySelector('input[name="w-mode"]:checked').value; state.reset_settings.weekly.day=Number(m.querySelector('#w-day').value); state.reset_settings.weekly.time=normalizeTime(m.querySelector('#w-time').value); state.reset_state.daily_period=dateISO(dailyBoundary(new Date())); state.reset_state.weekly_period=dateISO(weeklyBoundary(new Date())); selectedDate=dateISO(activeDailyDate()); await saveState(); closeModal(); render(); toast('Configuración de resets guardada.'); };
  m.querySelector('#manual-d').onclick=async()=>{ if(!confirm('¿Resetear las diarias del periodo actual para TODOS los personajes?'))return; delete state.progreso_diario[activeDailyKey()]; state.reset_state.daily_period=dateISO(activeDailyDate()); log('TODOS','sistema','','RESET DIARIO MANUAL'); await saveState(); closeModal(); render(); toast('Diarias reseteadas.'); };
  m.querySelector('#manual-w').onclick=async()=>{ if(!confirm('¿Resetear las semanales del periodo actual para TODOS los personajes?'))return; delete state.progreso_semanal[activeWeeklyKey()]; state.reset_state.weekly_period=dateISO(weeklyBoundary(new Date())); log('TODOS','sistema','','RESET SEMANAL MANUAL'); await saveState(); closeModal(); render(); toast('Semanales reseteadas.'); };
}

async function exportData(){
  state.session_state={personaje_actual:selectedCharacter,fecha_diaria:selectedDate,tipo_actual:activeTab,solo_pendientes:soloPending}; state.font_scale=currentFontScale;
  const payload=clone(state); const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='aion2_control_web.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); toast('Datos exportados.'); }
function importData(){ $('import-file').value=''; $('import-file').click(); }
$('import-file').addEventListener('change',async e=>{ const file=e.target.files?.[0]; if(!file)return; try{ const txt=await file.text(); const raw=JSON.parse(txt); const incoming=normalizeLoadedData(raw); state=incoming; selectedCharacter=incoming.session_state.personaje_actual||incoming.personaje_orden[0]||null; selectedDate=incoming.session_state.fecha_diaria||dateISO(activeDailyDate()); activeTab=incoming.session_state.tipo_actual||'diaria'; soloPending=Boolean(incoming.session_state.solo_pendientes); undoSnapshot=null; await saveState({backup:false}); await processAutomaticResets(); render(); toast('Datos importados correctamente.'); }catch(err){console.error(err);toast('No se pudo importar el archivo.');} });

async function init(){
  try{ await openDB(); const stored=await idbGet(STORE_STATE,STATE_KEY); state=normalizeLoadedData(stored||defaultState()); await processAutomaticResets(); selectedCharacter=state.session_state.personaje_actual && state.personajes[state.session_state.personaje_actual] ? state.session_state.personaje_actual : state.personaje_orden[0]||null; selectedDate=state.session_state.fecha_diaria||dateISO(activeDailyDate()); activeTab=state.session_state.tipo_actual==='semanal'?'semanal':'diaria'; soloPending=Boolean(state.session_state.solo_pendientes); if(!state.reset_state.daily_period)state.reset_state.daily_period=dateISO(dailyBoundary()); if(!state.reset_state.weekly_period)state.reset_state.weekly_period=dateISO(weeklyBoundary()); await saveState({backup:false}); bindUI(); render(); setInterval(async()=>{ await processAutomaticResets(); renderResetStrip(); updateActionButtons(); },1000); if('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js?v=27',{updateViaCache:'none'}).then(reg=>reg.update().catch(()=>{})).catch(()=>{}); }catch(e){ console.error(e); toast('No se pudo iniciar el almacenamiento local.'); }
}
function bindUI(){
  const click=(id,handler)=>{ const el=$(id); if(!el){ console.warn(`No se encontró #${id}`); return false; } el.onclick=handler; return true; };
  click('btn-add-char',()=>showCharacterForm());
  click('btn-edit-char',()=>showCharacterForm(selectedCharacter));
  click('btn-delete-char',deleteCharacter);
  click('btn-up',()=>moveCharacter(-1));
  click('btn-down',()=>moveCharacter(1));

  document.addEventListener('keydown',e=>{
    const tag=document.activeElement?.tagName;
    if(tag!=='INPUT'&&tag!=='TEXTAREA'&&tag!=='SELECT'){
      if(e.key==='ArrowUp'){e.preventDefault();moveCharacter(-1);}
      if(e.key==='ArrowDown'){e.preventDefault();moveCharacter(1);}
    }
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){
      e.preventDefault();
      saveState().then(()=>toast('Guardado.')).catch(err=>{console.error(err);toast('No se pudo guardar.');});
    }
  });

  click('btn-install',async()=>{
    if(deferredInstallPrompt){
      const promptEvent=deferredInstallPrompt;
      deferredInstallPrompt=null;
      try{
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if(choice?.outcome === 'accepted') markPWAInstalled();
      }catch(err){
        console.warn('Instalación PWA cancelada o no disponible.',err);
      }
      updateInstallButton();
      return;
    }
    if(isIOS()){
      showInstallHelp();
      return;
    }
    toast('Chrome/Edge todavía no ha habilitado la instalación directa. Usa el icono de instalación de la barra del navegador o pulsa ? para ver la ayuda.');
  });
  click('btn-install-help',showInstallHelp);
  click('btn-history',showHistory);
  click('btn-support',showSupport);
  click('btn-resets',showResets);
  click('btn-font',showFont);
  click('btn-export',exportData);
  click('btn-import',importData);
  click('btn-pending',()=>{soloPending=!soloPending;render();persistSession();});
  click('btn-clear',clearActive);
  click('btn-undo',undoClear);
  click('tab-daily',()=>{activeTab='diaria';render();persistSession();});
  click('tab-weekly',()=>{activeTab='semanal';render();persistSession();});
  click('btn-complete-daily',()=>completeDaily());
  click('btn-complete-weekly',()=>completeWeekly());
  click('btn-manage-quests',showQuestManager);
}

window.addEventListener('beforeunload',()=>{ saveState({backup:false}).catch(()=>{}); });
document.addEventListener('click',e=>{ if(e.target.matches('[data-close]')) closeModal(); });
setupPWA();
init();
