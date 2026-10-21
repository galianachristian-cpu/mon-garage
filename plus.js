/* ============================================================
   MON GARAGE : modules complémentaires
   prix autour de soi, carte, rappels, compteur en photo, budget,
   coût d'un trajet, comparaison, sorties et hivernage moto,
   dossier PDF, Crit'Air / ZFE, collection, profils
   ============================================================ */

const hook = (k, fn) => (HOOKS[k] = HOOKS[k] || []).push(fn);
const KEY_GEO = 'garage_geo', KEY_NOTIF = 'garage_notif', KEY_NOTIF_DAY = 'garage_notif_day', KEY_PRIX = 'garage_prix';
const vIcon = v => typeOf(v) === 'moto' ? '🏍️' : typeOf(v) === 'van' ? '🚐' : '🚗';
const shortName = v => (MODELS[v.model] && MODELS[v.model].modele) || v.nom;
const r5 = n => Math.round(n * 1e5) / 1e5;
function specVal(v, label){ for (const [, rows] of variantOf(v).specs) for (const [k, val] of rows) if (k === label) return val; return null; }
function critair(v){ if (v.docs.critair) return v.docs.critair; const s = specVal(v, 'Vignette Crit’Air'); if (!s) return null; return /^\d/.test(s) ? s[0] : /non class/i.test(s) ? 'NC' : null; }
const CRIT_COL = { '0':'#22c55e', '1':'#a855f7', '2':'#facc15', '3':'#fb923c', '4':'#be123c', '5':'#6b7280', NC:'#334155' };
function avgPrice(vid){ const F = S.fuels.filter(x => (!vid || x.vid === vid) && ok(x.pu) && ok(x.l)); const L = sum(F, f => f.l); return L ? sum(F, f => f.eur) / L : null; }
function lastPrice(vid){ const f = S.fuels.filter(x => (!vid || x.vid === vid) && ok(x.pu)).sort(sortD).pop(); return f ? f.pu : null; }
const realConso = v => avgConso(v.id) || v.conso;
function vYear(v){ return +v.docs.annee || (v.model === 'express' && v.variant === 'express1-11' && PROFILE === 'moi' ? 1992 : null); }
const geoDist = (a, b) => { const t = x => x * Math.PI / 180, h = Math.sin(t(b.lat - a.lat) / 2) ** 2 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(t(b.lon - a.lon) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
function geoNow(timeout = 10000){
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('Localisation indisponible sur cet appareil'));
    navigator.geolocation.getCurrentPosition(p => res({ lat:p.coords.latitude, lon:p.coords.longitude }),
      e => rej(new Error(e.code === 1 ? 'Localisation refusée : autorise-la pour cette appli dans les réglages du téléphone' : 'Position introuvable, réessaie dehors')), { timeout, maximumAge:300000 });
  });
}
const sheetAfter = fn => { if ($('#sheet').classList.contains('on')){ closeSheet(); setTimeout(fn, 80); } else fn(); };
const ago = iso => { const m = Math.round((Date.now() - new Date(iso)) / 6e4); return !isFinite(m) ? '' : m < 60 ? 'il y a ' + Math.max(1, m) + ' min' : m < 1440 ? 'il y a ' + Math.round(m / 60) + ' h' : 'il y a ' + Math.round(m / 1440) + ' j'; };

/* rendu : certains écrans ont besoin d'agir après l'affichage (carte, formulaires) */
const _render = render;
render = function(){ _render(); HOOK('afterRender'); };

document.head.insertAdjacentHTML('beforeend', `<style>
.tools{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:14px}
.tool{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 4px;border-radius:16px;background:var(--card);border:1px solid var(--line);font-size:11.5px;font-weight:700;color:var(--soft);text-align:center;line-height:1.2}
.tool .e{font-size:23px}
.map{height:360px;border-radius:18px;overflow:hidden;margin-top:12px;border:1px solid var(--line);background:#0e1420}
.leaflet-container{font-family:inherit}
.price{font-size:21px;font-weight:900;letter-spacing:-.5px}
.item.best{border-color:var(--ok);box-shadow:0 0 0 1px var(--ok) inset}
.cmpw{overflow-x:auto;margin-top:12px}
.cmp{width:100%;border-collapse:collapse;font-size:13.5px}
.cmp th,.cmp td{padding:9px 6px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}
.cmp th{font-size:12.5px}
.cmp th:first-child,.cmp td:first-child{text-align:left;color:var(--muted);font-weight:600;white-space:normal}
.cmp td.best{color:var(--ok);font-weight:800}
.crit{display:inline-grid;place-items:center;min-width:28px;height:28px;padding:0 6px;border-radius:99px;font-weight:900;font-size:12.5px;color:#0a0d14;border:2px solid rgba(255,255,255,.7)}
.chk{display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:14px;background:var(--card);border:1px solid var(--line);margin-top:8px;font-weight:600;font-size:14px}
.chk input{width:20px;height:20px;accent-color:#34d399;flex:0 0 auto}
.stars{display:flex;gap:4px}.stars label{font-size:24px;cursor:pointer;filter:grayscale(1);opacity:.4}.stars input{display:none}.stars input:checked~span,.stars label.on{filter:none;opacity:1}
#printArea{display:none}
@media print{
  body>*:not(#printArea){display:none!important}
  html,body{background:#fff!important;padding:0!important;min-height:0!important}
  #printArea{display:block!important;color:#111;font-family:system-ui,-apple-system,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
.pr h1{font-size:22px;margin:0 0 2px}.pr .sub{color:#555;font-size:12px}
.pr h2{font-size:15px;margin:18px 0 6px;border-bottom:2px solid #111;padding-bottom:3px}
.pr table{width:100%;border-collapse:collapse;font-size:11.5px}.pr td,.pr th{border-bottom:1px solid #ccc;padding:5px 4px;text-align:left;vertical-align:top}
.pr .kv{display:grid;grid-template-columns:1fr 1fr;gap:4px 18px;font-size:12px}
.pr .vimg{width:55%;display:block;margin:6px auto}.pr .ph{max-width:48%;max-height:300px;margin:6px 1%;display:inline-block;page-break-inside:avoid;border:1px solid #ddd}
</style>`);

/* ======================= Profils (garage de Béa) ======================= */
hook('settings', () => `<h2 class="sec">Garage de</h2><div class="card"><div class="pick">${PROFILES.map(p => `<label><input type="radio" name="prof" value="${p.id}" ${p.id === PROFILE ? 'checked' : ''} data-x="profile" data-p="${p.id}"><span>${p.id === 'moi' ? '🙋' : '👩'} ${esc(p.nom)}</span></label>`).join('')}</div><p class="hint">Chaque personne a ses propres véhicules, pleins et entretiens, synchronisés séparément.</p></div>`);
ACTIONS.profile = b => { const p = b.dataset.p; if (p === PROFILE) return; safeSet('garage_profile', p); location.reload(); };
hook('start', () => { if (PROFILE !== 'moi') $('#subtitle').textContent = 'Garage de ' + (PROFILES.find(p => p.id === PROFILE) || {}).nom; });

/* ======================= Raccourcis de l'accueil ======================= */
hook('home', () => `<div class="tools">
  <button class="tool" data-nav="prix"><span class="e">⛽</span>Prix autour de moi</button>
  <button class="tool" data-x="trip"><span class="e">🧮</span>Coût d’un trajet</button>
  <button class="tool" data-nav="compare"><span class="e">⚖️</span>Comparer</button>
  <button class="tool" data-x="remind"><span class="e">🔔</span>Rappels</button>
</div>`);
hook('addMenu', () => `<button class="action" data-x="ride"><span class="e">🏍️</span><div><b>Sortie moto</b><small>Balade, distance et ressenti</small></div></button>
  <button class="action" data-x="trip"><span class="e">🧮</span><div><b>Coût d’un trajet</b><small>Carburant et partage des frais</small></div></button>`);

/* ======================= Prix des carburants autour de moi ======================= */
const FUEL_API = { 'SP95-E10':'e10', 'SP98':'sp98', 'SP95':'sp95', 'Gazole':'gazole', 'E85':'e85', 'GPL':'gplc' };
const PX = { fuel:null, tab:'liste', loading:false, err:'', data:safeGet(KEY_PRIX, null) };
const PX_URL = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records';
const normPrice = p => { const n = typeof p === 'string' ? pnum(p) : p; return ok(n) && n > 0 ? (n > 10 ? n / 1000 : n) : null; };
async function fetchStations(where){
  const r = await fetch(PX_URL + '?limit=100&where=' + encodeURIComponent(where));
  if (!r.ok) throw new Error('Service des prix indisponible (' + r.status + ')');
  const j = await r.json();
  return (j.results || []).map(x => {
    const g = x.geom || {}, lat = ok(g.lat) ? g.lat : pnum(x.latitude) / 1e5, lon = ok(g.lon) ? g.lon : pnum(x.longitude) / 1e5, p = {}, maj = {};
    Object.values(FUEL_API).forEach(k => { const v = normPrice(x[k + '_prix']); if (v) { p[k] = v; maj[k] = x[k + '_maj']; } });
    return { id:x.id, adr:x.adresse || '', ville:x.ville || '', cp:x.cp || '', lat, lon, p, maj, auto:x.horaires_automate_24_24 === 'Oui' };
  }).filter(s => ok(s.lat) && ok(s.lon) && Object.keys(s.p).length);
}
async function loadPrix(mode, q){
  PX.loading = true; PX.err = ''; render();
  try{
    let st, pos = null, label;
    if (mode === 'geo'){
      pos = await geoNow(); label = 'autour de toi';
      st = await fetchStations(`within_distance(geom, geom'POINT(${pos.lon} ${pos.lat})', 10km)`);
    } else {
      q = q.trim(); label = q;
      if (/^\d{5}$/.test(q)) st = await fetchStations(`cp="${q}"`);
      else { try{ st = await fetchStations(`search(ville, "${q.replace(/"/g, '')}")`); }catch(e){ st = await fetchStations(`"${q.replace(/"/g, '')}"`); } }
    }
    if (pos) st.forEach(s => { s.km = geoDist(pos, s); });
    PX.data = { at:Date.now(), pos, label, st }; safeSet(KEY_PRIX, PX.data);
    if (!st.length) PX.err = 'Aucune station trouvée' + (mode === 'geo' ? ' dans un rayon de 10 km.' : ' pour « ' + q + ' ».');
  }catch(e){ PX.err = e.message || 'Erreur de connexion'; }
  PX.loading = false; render();
}
function pxFuel(){ return PX.fuel || (sel !== 'all' && vById(sel) ? vById(sel).carb : (S.vehicles[0] || {}).carb) || 'SP95-E10'; }
EXTRA_VIEWS.prix = function(){
  const fuel = pxFuel(), k = FUEL_API[fuel] || 'e10', D = PX.data;
  const st = D ? D.st.filter(s => s.p[k]).sort((a, b) => a.p[k] - b.p[k] || (a.km || 0) - (b.km || 0)) : [];
  const best = st[0], med = st.length ? st[Math.floor(st.length / 2)].p[k] : null, mine = avgPrice(), tank = Math.round(sum(S.vehicles.filter(v => v.carb === fuel), v => v.reservoir) / Math.max(1, S.vehicles.filter(v => v.carb === fuel).length)) || 45;
  const head = `<div class="row" style="margin-top:16px"><button class="back" data-nav="home" style="font-weight:700;color:var(--soft)">‹ Garage</button></div>
    <h2 style="font-size:24px;font-weight:900;margin-top:4px">⛽ Prix autour de moi</h2>
    <p class="hint">Prix officiels déclarés par les stations (prix-carburants.gouv.fr).</p>
    <div class="chips">${Object.keys(FUEL_API).map(f => `<button class="chip ${f === fuel ? 'on' : ''}" data-x="pxfuel" data-f="${f}">${f}</button>`).join('')}</div>
    <div class="row" style="margin-top:8px"><button class="btn pri" style="flex:1" data-x="pxgeo" ${PX.loading ? 'disabled' : ''}>📍 Autour de moi</button>
    <form id="pxQ" style="flex:1;display:flex;gap:6px;min-width:180px"><input class="inp" id="pxQi" placeholder="Code postal ou ville" style="padding:11px 12px;font-size:15px"><button class="btn" aria-label="Chercher">🔎</button></form></div>
    ${PX.loading ? '<div class="scan"><div class="ring"></div><p class="hint">Recherche des stations…</p></div>' : ''}
    ${PX.err ? `<p class="hint ko" style="margin-top:12px">⚠️ ${esc(PX.err)}</p>` : ''}`;
  if (!D || PX.loading) return head + (!D && !PX.loading ? '<div class="card" style="margin-top:14px"><div class="empty"><div class="e">📍</div><b>Trouve le carburant le moins cher</b><p>Touche « Autour de moi » ou tape un code postal. Les stations sont classées de la moins chère à la plus chère.</p></div></div>' : '');
  const tabs = `<div class="tabs"><button class="${PX.tab === 'liste' ? 'on' : ''}" data-x="pxtab" data-t="liste">Liste</button><button class="${PX.tab === 'carte' ? 'on' : ''}" data-x="pxtab" data-t="carte">Carte</button></div>`;
  const summary = best ? `<div class="card" style="margin-top:12px;border-color:rgba(52,211,153,.4)"><div class="row"><span style="font-size:28px">🏆</span><div style="flex:1;min-width:0"><b>${nf(best.p[k], 3)} €/L</b> · ${esc(best.ville)}${ok(best.km) ? ' · ' + nf(best.km, 1) + ' km' : ''}<div class="hint" style="margin:2px 0 0">${esc(best.adr)}</div></div></div>
    ${mine && mine > best.p[k] + .005 ? `<p class="hint ok" style="margin-top:8px">💶 ${nf(mine - best.p[k], 3)} €/L de moins que ton prix moyen : ≈ ${eur((mine - best.p[k]) * tank)} d’économie sur un plein de ${tank} L.</p>` : ''}
    ${med && med - best.p[k] >= .02 ? `<p class="hint">Médiane du secteur : ${nf(med, 3)} €/L.</p>` : ''}</div>` : '';
  let body = '';
  if (PX.tab === 'carte') body = `<div class="map" id="pxMap"></div><div class="legend"><span><i style="background:#34d399"></i>Moins cher</span><span><i style="background:#f87171"></i>Plus cher</span><span><i style="background:#38bdf8"></i>Mes pleins</span></div>`;
  else body = st.length ? `<div class="list" style="margin-top:12px">${st.slice(0, 40).map((s, i) => `<a class="item ${i === 0 ? 'best' : ''}" href="https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">
      <span class="ic" style="--vc:${i === 0 ? '#34d399' : '#38bdf8'}">${i === 0 ? '🏆' : '⛽'}</span><div class="tx"><b>${esc(s.ville)}${ok(s.km) ? ' · ' + nf(s.km, 1) + ' km' : ''}</b><small>${esc(s.adr)}${s.auto ? ' · 24h/24' : ''}</small><small>${esc(ago(s.maj[k]))} · Itinéraire ›</small></div>
      <div class="rt"><span class="price num">${nf(s.p[k], 3)}</span><small>€/L</small></div></a>`).join('')}</div>` : `<p class="hint" style="margin-top:12px">Aucune station ne vend du ${esc(fuel)} dans cette zone.</p>`;
  return head + `<p class="hint" style="margin-top:10px">${st.length} stations ${esc(D.label || '')} · mis à jour ${esc(ago(new Date(D.at).toISOString()))}</p>` + summary + tabs + body;
};
ACTIONS.pxfuel = b => { PX.fuel = b.dataset.f; render(); };
ACTIONS.pxgeo = () => loadPrix('geo');
ACTIONS.pxtab = b => { PX.tab = b.dataset.t; render(); };
hook('afterRender', () => {
  if (view !== 'prix') return;
  const f = $('#pxQ'); if (f) f.onsubmit = ev => { ev.preventDefault(); const q = $('#pxQi').value; if (q.trim()) loadPrix('q', q); };
  if (PX.tab === 'carte' && $('#pxMap')) drawMap();
});
let leafletReady = null;
function loadLeaflet(){
  if (window.L) return Promise.resolve();
  if (!leafletReady){
    document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css">');
    leafletReady = loadScript('https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js');
  }
  return leafletReady;
}
async function drawMap(){
  try{ await loadLeaflet(); }catch(e){ $('#pxMap').innerHTML = '<p class="hint" style="padding:16px">Carte indisponible hors connexion.</p>'; return; }
  const el = $('#pxMap'); if (!el || el._done) return; el._done = true;
  const k = FUEL_API[pxFuel()], D = PX.data, st = D.st.filter(s => s.p[k]);
  const m = L.map(el, { zoomControl:true, attributionControl:true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:18, attribution:'© OpenStreetMap' }).addTo(m);
  const ps = st.map(s => s.p[k]), lo = Math.min(...ps), hi = Math.max(...ps), pts = [];
  st.forEach(s => {
    const t = hi > lo ? (s.p[k] - lo) / (hi - lo) : 0, col = `hsl(${Math.round(140 - t * 140)},75%,55%)`;
    L.circleMarker([s.lat, s.lon], { radius:9, color:'#0a0d14', weight:2, fillColor:col, fillOpacity:.95 }).addTo(m)
      .bindPopup(`<b>${nf(s.p[k], 3)} €/L</b><br>${esc(s.adr)}<br>${esc(s.ville)}<br><a href="https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}" target="_blank" rel="noopener">Itinéraire</a>`);
    pts.push([s.lat, s.lon]);
  });
  S.fuels.filter(f => f.geo).forEach(f => {
    L.circleMarker([f.geo.lat, f.geo.lon], { radius:6, color:'#fff', weight:1.5, fillColor:'#38bdf8', fillOpacity:1 }).addTo(m)
      .bindPopup(`<b>${esc((vById(f.vid) || {}).nom || '')}</b><br>${fmtD(f.d)} · ${nf(f.l, 1)} L<br>${ok(f.pu) ? nf(f.pu, 3) + ' €/L' : ''} ${esc(f.station || '')}`);
    if (!pts.length) pts.push([f.geo.lat, f.geo.lon]);
  });
  if (D.pos){ L.circleMarker([D.pos.lat, D.pos.lon], { radius:7, color:'#fff', weight:3, fillColor:'#818cf8', fillOpacity:1 }).addTo(m).bindPopup('Toi'); pts.push([D.pos.lat, D.pos.lon]); }
  if (pts.length) m.fitBounds(pts, { padding:[24, 24], maxZoom:14 }); else m.setView([43.61, 3.88], 11);
}

/* lieu du plein (facultatif) pour la carte « mes pleins » */
const _saveFuel = saveFuel;
saveFuel = function(){
  const id = fState && fState.f.id, isNew = fState && fState.isNew; _saveFuel();
  const f = S.fuels.find(x => x.id === id);
  if (f && isNew && safeGet(KEY_GEO, false) && !f.geo) geoNow(8000).then(p => { f.geo = { lat:r5(p.lat), lon:r5(p.lon) }; save(); }).catch(() => {});
};
hook('settings', () => `<h2 class="sec">Confort</h2><div class="card">
  <label class="tog" style="margin-top:0"><span>📍 Mémoriser le lieu de chaque plein <small class="muted">(carte de mes pleins)</small></span><input type="checkbox" data-x="geoset" ${safeGet(KEY_GEO, false) ? 'checked' : ''}><i class="sw"></i></label>
  <label class="tog"><span>🔔 Notifications de rappel</span><input type="checkbox" data-x="notifset" ${safeGet(KEY_NOTIF, false) ? 'checked' : ''}><i class="sw"></i></label>
  <p class="hint">Sur iPhone, les notifications ne marchent que si l’appli est installée sur l’écran d’accueil.</p></div>`);
ACTIONS.geoset = b => { const on = b.checked; if (on) geoNow().then(() => { safeSet(KEY_GEO, true); toast('📍 Lieu des pleins mémorisé'); }).catch(e => { b.checked = false; toast(e.message); }); else safeSet(KEY_GEO, false); };

/* ======================= Rappels : notifications et agenda ======================= */
function dueAlerts(){ return insights().filter(i => i.v && (i.lv === 'ko' || i.lv === 'warn')); }
async function notify(title, body){
  try{ const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); if (reg && reg.showNotification){ await reg.showNotification(title, { body, tag:'garage-rappel', icon:'icon-192.png', badge:'icon-192.png', data:{ url:location.href.split('#')[0] } }); return true; } }catch(e){}
  try{ new Notification(title, { body, icon:'icon-192.png' }); return true; }catch(e){ return false; }
}
async function enableNotif(){
  if (!('Notification' in window)) { toast('Notifications non disponibles ici (sur iPhone : installe l’appli sur l’écran d’accueil)'); return false; }
  const p = await Notification.requestPermission(); if (p !== 'granted'){ toast('Notifications refusées dans les réglages du téléphone'); return false; }
  safeSet(KEY_NOTIF, true); const a = dueAlerts();
  notify('Mon Garage', a.length ? a.slice(0, 3).map(i => shortName(i.v) + ' : ' + i.t).join('\n') : 'Rappels activés : tu seras prévenu des prochaines échéances.');
  return true;
}
ACTIONS.notifset = b => { if (b.checked) enableNotif().then(okk => { b.checked = okk; }); else safeSet(KEY_NOTIF, false); };
hook('start', () => setTimeout(() => {
  if (!safeGet(KEY_NOTIF, false) || !('Notification' in window) || Notification.permission !== 'granted' || safeGet(KEY_NOTIF_DAY, '') === today()) return;
  const a = dueAlerts(); safeSet(KEY_NOTIF_DAY, today());
  if (a.length) notify('Mon Garage · ' + a.length + ' rappel' + (a.length > 1 ? 's' : ''), a.slice(0, 3).map(i => shortName(i.v) + ' : ' + i.t).join('\n'));
}, 4000));
function icsEvents(){
  const ev = [];
  S.vehicles.forEach(v => {
    if (v.docs.ct) ev.push({ uid:v.id + '-ct', d:v.docs.ct, t:'Contrôle technique · ' + v.nom, desc:'Échéance du contrôle technique (Mon Garage).' });
    if (v.docs.assu) ev.push({ uid:v.id + '-assu', d:v.docs.assu, t:'Assurance · ' + v.nom, desc:'Échéance de l’assurance (Mon Garage).' });
    maintStatus(v).filter(x => x.state !== 'unk' && x.pred).forEach(x => ev.push({ uid:v.id + '-' + x.id, d: x.pred < today() ? today() : x.pred, t:x.nom + ' · ' + v.nom, desc:(x.txt || '') + ' (prévision Mon Garage selon ton rythme de roulage).' }));
  });
  return ev;
}
function downloadICS(){
  const ev = icsEvents(); if (!ev.length) return toast('Aucune échéance connue : renseigne le carnet et les papiers');
  const e = s => String(s).replace(/[\\,;]/g, m => '\\' + m).replace(/\n/g, '\\n'), dt = d => d.replace(/-/g, ''), stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mon Garage//FR', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Mon Garage'];
  ev.forEach(x => lines.push('BEGIN:VEVENT', 'UID:' + x.uid + '@mon-garage', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + dt(x.d), 'DTEND;VALUE=DATE:' + dt(addDays(x.d, 1)), 'SUMMARY:' + e(x.t), 'DESCRIPTION:' + e(x.desc),
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + e(x.t), 'TRIGGER:-P7D', 'END:VALARM', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + e(x.t), 'TRIGGER:-PT15H', 'END:VALARM', 'END:VEVENT'));
  lines.push('END:VCALENDAR');
  download('mon-garage-rappels.ics', lines.join('\r\n'), 'text/calendar');
  toast('📅 ' + ev.length + ' échéance' + (ev.length > 1 ? 's' : '') + ' exportée' + (ev.length > 1 ? 's' : ''));
}
ACTIONS.ics = downloadICS;
ACTIONS.remind = () => {
  const a = dueAlerts(), on = safeGet(KEY_NOTIF, false) && 'Notification' in window && Notification.permission === 'granted';
  openSheet(`<h2>🔔 Rappels</h2>
  ${a.length ? a.slice(0, 5).map(insHTML).join('') : '<p class="hint">Rien d’urgent pour l’instant.</p>'}
  <div class="card" style="margin-top:14px"><b>📱 Notifications</b><p class="hint">À l’ouverture de l’appli (une fois par jour), une notification résume ce qui arrive à échéance. Sur iPhone, l’appli doit être installée sur l’écran d’accueil.</p>
  <button class="btn ${on ? '' : 'pri'} block" style="margin-top:10px" id="rN">${on ? '✅ Activées · envoyer un test' : 'Activer les notifications'}</button></div>
  <div class="card"><b>📅 Agenda du téléphone (le plus fiable)</b><p class="hint">Ajoute toutes les échéances prévues (contrôle technique, assurance, vidanges, chaîne…) à ton agenda, avec une alerte 7 jours avant et la veille. Elles sonnent même appli fermée. À refaire de temps en temps : les dates se recalent sur ton rythme de roulage.</p>
  <button class="btn pri block" style="margin-top:10px" data-x="ics">📅 Ajouter à mon agenda (${icsEvents().length})</button></div>`);
  $('#rN').onclick = () => { if (on){ const x = dueAlerts(); notify('Mon Garage', x.length ? x.slice(0, 3).map(i => shortName(i.v) + ' : ' + i.t).join('\n') : 'Tout est à jour 👍'); } else enableNotif().then(okk => { if (okk){ closeSheet(); toast('🔔 Notifications activées'); } }); };
};

/* ======================= Compteur kilométrique en photo ======================= */
async function readOdo(file, v){
  const im = await loadImg(file), last = v ? curKm(v) : 0, expect = v && last ? last + kmRate(v) * Math.max(0, days((kmRecords(v).pop() || { d:today() }).d, today())) : 0;
  if (safeGet(KEY_AI, '')){
    try{
      const txt = await claude({ max_tokens:800, output_config:{ effort:'low', format:{ type:'json_schema', schema:{ type:'object', additionalProperties:false, required:['km'], properties:{ km:{ type:'number', description:'Kilométrage total (odomètre), 0 si illisible' } } } } },
        messages:[{ role:'user', content:[{ type:'image', source:{ type:'base64', media_type:'image/jpeg', data:toCanvas(im, 1400).toDataURL('image/jpeg', .85).split(',')[1] } }, { type:'text', text:'Photo du tableau de bord d’un véhicule. Donne le kilométrage TOTAL affiché par l’odomètre (pas le compteur journalier « trip », pas la vitesse, pas l’autonomie). Mets 0 si illisible.' + (last ? ' Indice : le dernier relevé connu était ' + last + ' km.' : '') }] }] });
      const km = JSON.parse(txt).km; if (ok(km) && km > 0) return { km:Math.round(km), src:'lu par l’IA' };
    }catch(e){}
  }
  await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js');
  const w = await Tesseract.createWorker('eng'); await w.setParameters({ tessedit_char_whitelist:'0123456789', tessedit_pageseg_mode:'11' });
  const { data } = await w.recognize(toCanvas(im, 1800, true)); await w.terminate();
  const nums = (data.text.match(/\d{3,7}/g) || []).map(Number);
  let cand = nums.filter(n => last ? n >= last - 5 && n <= last + 40000 : n >= 100);
  if (!cand.length) return { km:null };
  if (expect) cand.sort((a, b) => Math.abs(a - expect) - Math.abs(b - expect)); else cand.sort((a, b) => b - a);
  return { km:cand[0], src:'lu sur ton téléphone' };
}
function scanOdo(vid, done){
  pickImage(async file => {
    closeSheet(); await new Promise(r => setTimeout(r, 120));
    openSheet('<div class="scan"><div class="ring"></div><b style="font-size:18px">Lecture du compteur…</b><p class="hint">Cadre bien les chiffres du kilométrage total</p></div>');
    let r = { km:null }; try{ r = await readOdo(file, vById(vid)); }catch(e){}
    closeSheet(); await new Promise(res => setTimeout(res, 300)); done(r.km, r.src);
  });
}
kmForm = function(vid, preKm, src){
  vid = defVid(vid);
  openSheet(`<h2>📏 Relevé kilométrique</h2><form id="kf"><div class="fld"><span>Véhicule</span>${vPick('vid', vid)}</div>
    <button type="button" class="btn block" id="kCam" style="margin-top:12px">📷 Lire le compteur en photo</button>
    <label class="fld"><span>Compteur</span><div class="unit"><input class="inp big-inp${preKm ? ' ai' : ''}" id="kKm" inputmode="numeric" placeholder="km" value="${preKm || ''}" required><em>km</em></div><p class="hint" id="kH"></p></label>
    <label class="fld"><span>Date</span><input class="inp" type="date" id="kD" value="${today()}" max="${today()}"></label>
    <button class="btn pri block" style="margin-top:16px">✅ Enregistrer</button></form>`);
  const cur = () => vById(($('#kf [name=vid]:checked') || {}).value);
  const h = () => { const v = cur(); $('#kH').textContent = (src ? '✨ ' + src + ' : vérifie le nombre. ' : '') + (v ? 'Dernier relevé : ' + nf(curKm(v)) + ' km' : ''); };
  h(); $$('#kf [name=vid]').forEach(r => r.addEventListener('change', h));
  $('#kCam').onclick = () => { const v = cur(); scanOdo(v && v.id, (km, s) => { kmForm(v && v.id, km, s); if (!km) toast('Compteur illisible, saisis-le à la main'); }); };
  $('#kf').onsubmit = ev => { ev.preventDefault(); const v = cur(), K = pnum($('#kKm').value); if (!v || !ok(K)) return; v.kmLog.push({ d:$('#kD').value || today(), km:Math.round(K) }); save(); closeSheet(); render(); toast('📏 ' + nf(K) + ' km enregistrés'); };
};
const _fuelForm = fuelForm;
fuelForm = function(f, pre = {}){
  _fuelForm(f, pre);
  if (f || !$('#fKm')) return;
  $('#kmHint').insertAdjacentHTML('afterend', '<button type="button" class="btn sm" id="fKmCam" style="margin-top:8px">📷 Lire le compteur en photo</button>');
  $('#fKmCam').onclick = () => {
    const st = fState, keep = { vid:($('#ff [name=vid]:checked') || {}).value, eur:pnum($('#fEur').value), l:pnum($('#fL').value), pu:pnum($('#fPu').value), d:$('#fD').value, carb:$('#fCarb').value, station:$('#fSt').value, note:$('#fNote').value, full:$('#fFull').checked };
    Object.keys(keep).forEach(k => { if (typeof keep[k] === 'number' && !ok(keep[k])) delete keep[k]; });
    scanOdo(keep.vid, km => { fuelForm(null, Object.assign(keep, km ? { km } : {}, st.photo ? { photo:st.photo, ai:st.ai, src:pre.src } : {})); toast(km ? '📏 ' + nf(km) + ' km lus : vérifie' : 'Compteur illisible, saisis-le'); });
  };
};

/* ======================= Crit'Air, ZFE et véhicules de collection ======================= */
hook('vHero', v => { const c = critair(v); return c ? `<div class="row" style="margin-top:4px;gap:8px"><span class="crit" style="background:${CRIT_COL[c]};${c === 'NC' || c === '4' ? 'color:#fff' : ''}">${c === 'NC' ? '–' : c}</span><span class="hint" style="margin:0">Crit’Air ${c === 'NC' ? 'non classé' : c}${vYear(v) ? ' · ' + vYear(v) : ''}</span></div>` : ''; });
INSIGHT_HOOKS.push(vf => {
  const out = [];
  S.vehicles.filter(v => !vf || v.id === vf).forEach(v => {
    const c = critair(v), y = vYear(v), age = y ? new Date().getFullYear() - y : 0;
    if ((c === 'NC' || c === '5' || c === '4') && !v.docs.collection)
      out.push({ lv:'info', e:'🚫', v, t:'Zones à faibles émissions (ZFE)', p:'Avec la vignette Crit’Air ' + (c === 'NC' ? 'non classé' : c) + ', ce véhicule peut être interdit dans certaines grandes villes (Montpellier, Marseille, Lyon…) selon les jours et les horaires. Les règles changent souvent : vérifie la ville avant d’y aller.', act:'zfe' });
    if (age >= 30 && !v.docs.collection)
      out.push({ lv:'info', e:'🏛️', v, t:'Éligible à la carte grise « collection »', p:age + ' ans : véhicule de plus de 30 ans. Avantages : contrôle technique tous les 5 ans au lieu de 2, assurance « collection » souvent bien moins chère, circulation souvent tolérée dans les ZFE. Conditions : véhicule d’origine non modifié, attestation FFVE, usage professionnel interdit.', act:'valeur' });
  });
  return out;
});
ACTIONS['ins:valeur'] = vid => ACTIONS.valeur(null, vid);
ACTIONS['ins:zfe'] = () => window.open('https://www.certificat-air.gouv.fr/', '_blank', 'noopener');

/* ======================= Budget annuel ======================= */
const yearStart = () => today().slice(0, 4) + '-01-01';
function budgetInfo(v){
  const spent = spend(fuelsOf(v.id), yearStart()) + spend(maintOf(v.id), yearStart()), doy = Math.max(1, days(yearStart(), today()) + 1);
  const proj = doy >= 20 ? spent / doy * 365 : null;
  const sugg = Math.round(kmRate(v) * 365 * realConso(v) / 100 * (avgPrice(v.id) || 1.85) + (spend(maintOf(v.id), addDays(today(), -730)) / 2 || (typeOf(v) === 'moto' ? 250 : 400)));
  return { spent, proj, sugg, b:v.budget };
}
hook('vOverview', v => {
  const B = budgetInfo(v), pct = B.b ? Math.min(1.2, B.spent / B.b) : 0, col = pct >= 1 ? 'var(--ko)' : pct >= .8 ? 'var(--warn)' : 'var(--ok)';
  return `<h2 class="sec">🎯 Budget ${today().slice(0, 4)}<span class="spacer"></span><button data-x="budget" data-v="${v.id}">${B.b ? 'Modifier' : 'Définir'}</button></h2>
  <div class="card">${B.b ? `<div class="row"><b class="num" style="font-size:22px">${eur(B.spent, 0)}</b><span class="muted">/ ${eur(B.b, 0)}</span><span class="spacer"></span><span class="badge" style="color:${col}">${nf(pct * 100)} %</span></div>
    <div class="gauge" style="height:9px"><i style="width:${Math.min(100, pct * 100)}%;background:${col}"></i></div>
    <p class="hint">${B.proj ? 'Projection fin d’année : ≈ ' + eur(B.proj, 0) + (B.proj > B.b ? ' (dépassement de ' + eur(B.proj - B.b, 0) + ')' : ' · dans les clous 👍') : 'Projection disponible après quelques semaines de suivi.'}</p>`
    : `<p class="soft" style="font-size:14px">Fixe un budget annuel (carburant + entretien) : l’appli te prévient si tu t’en approches.</p><p class="hint">Suggestion d’après ton usage : ≈ ${eur(B.sugg, 0)} / an.</p>`}</div>`;
});
ACTIONS.budget = (b, vid) => {
  const v = vById(vid), B = budgetInfo(v);
  openSheet(`<h2>🎯 Budget annuel · ${esc(v.nom)}</h2><form id="bf"><label class="fld"><span>Budget carburant + entretien</span><div class="unit"><input class="inp big-inp" id="bV" inputmode="numeric" value="${v.budget || B.sugg}"><em>€ / an</em></div></label>
  <p class="hint">Suggestion d’après ton kilométrage, ta consommation et tes entretiens : ≈ ${eur(B.sugg, 0)}.</p>
  <div class="row" style="margin-top:16px">${v.budget ? '<button type="button" class="btn danger" id="bDel">Retirer</button>' : ''}<span class="spacer"></span><button class="btn pri">Enregistrer</button></div></form>`);
  $('#bf').onsubmit = ev => { ev.preventDefault(); const n = Math.round(pnum($('#bV').value)); if (!(n > 0)) return; v.budget = n; save(); closeSheet(); render(); toast('🎯 Budget enregistré'); };
  if ($('#bDel')) $('#bDel').onclick = () => { delete v.budget; save(); closeSheet(); render(); };
};
INSIGHT_HOOKS.push(vf => S.vehicles.filter(v => v.budget && (!vf || v.id === vf)).map(v => {
  const B = budgetInfo(v);
  if (B.spent > B.b) return { lv:'ko', e:'🎯', v, t:'Budget annuel dépassé', p:eur(B.spent, 0) + ' dépensés pour un budget de ' + eur(B.b, 0) + '.' };
  if (B.proj && B.proj > B.b * 1.05) return { lv:'warn', e:'🎯', v, t:'Budget annuel bientôt dépassé', p:'Au rythme actuel : ≈ ' + eur(B.proj, 0) + ' en fin d’année pour un budget de ' + eur(B.b, 0) + '.' };
  return null;
}).filter(Boolean));

/* ======================= Coût d'un trajet ======================= */
ACTIONS.trip = (b, vid, fromSheet) => fromSheet(() => {
  if (!S.vehicles.length) return toast('Ajoute d’abord un véhicule');
  const v0 = vById(defVid(vid)) || S.vehicles[0];
  openSheet(`<h2>🧮 Coût d’un trajet</h2><form id="tf"><div class="fld"><span>Véhicule</span>${vPick('vid', v0.id)}</div>
  <label class="fld"><span>Distance</span><div class="unit"><input class="inp big-inp" id="tD" inputmode="decimal" placeholder="ex. 320"><em>km</em></div></label>
  <label class="tog"><span>Aller-retour</span><input type="checkbox" id="tAR" checked><i class="sw"></i></label>
  <div class="grid3" style="gap:8px"><label class="fld"><span>Personnes</span><input class="inp" id="tP" inputmode="numeric" value="1"></label>
  <label class="fld"><span>Prix / L</span><div class="unit"><input class="inp" id="tPu" inputmode="decimal"><em>€</em></div></label>
  <label class="fld"><span>Péages</span><div class="unit"><input class="inp" id="tPe" inputmode="decimal" placeholder="0"><em>€</em></div></label></div>
  <div class="preview" id="tR" hidden></div></form>`);
  const setPu = () => { const v = vById(($('#tf [name=vid]:checked') || {}).value); $('#tPu').value = String(r3(lastPrice(v.id) || avgPrice() || 1.85)).replace('.', ','); };
  const calc = () => {
    const v = vById(($('#tf [name=vid]:checked') || {}).value), D = pnum($('#tD').value) * ($('#tAR').checked ? 2 : 1), P = Math.max(1, Math.round(pnum($('#tP').value) || 1)), pu = pnum($('#tPu').value) || 1.85, pe = pnum($('#tPe').value) || 0;
    if (!v || !(D > 0)){ $('#tR').hidden = true; return; }
    const c = realConso(v), L = D * c / 100, cost = L * pu + pe, autonomy = v.reservoir / c * 100;
    const others = S.vehicles.filter(x => x.id !== v.id).map(x => [x, D * realConso(x) / 100 * (lastPrice(x.id) || pu) + pe]).sort((a, b) => a[1] - b[1]);
    const cr = critair(v);
    $('#tR').hidden = false;
    $('#tR').innerHTML = `<b style="font-size:20px">${eur(cost)}</b>${P > 1 ? ` · soit <b>${eur(cost / P)}</b> par personne` : ''}<br>${kmf(D)} · ≈ ${nf(L, 1)} L à ${nf(c, 1)} L/100${avgConso(v.id) ? ' (ta vraie conso)' : ' (conso constructeur)'}${pe ? ' · péages ' + eur(pe) : ''}<br>
      ${D > autonomy * .9 ? '⛽ Prévois ' + Math.ceil(D / (autonomy * .85)) + ' plein(s) en route (autonomie ≈ ' + kmf(autonomy) + ').<br>' : ''}
      ${others.length && others[0][1] < cost - 1 ? '💡 Avec ' + esc(others[0][0].nom) + ' : ≈ ' + eur(others[0][1]) + (typeOf(others[0][0]) === 'moto' ? ' (si tu pars seul)' : '') + '.<br>' : ''}
      ${cr === 'NC' || cr === '4' || cr === '5' ? '🚫 Crit’Air ' + (cr === 'NC' ? 'non classé' : cr) + ' : attention si le trajet traverse une ZFE.' : ''}`;
  };
  setPu();
  $$('#tf [name=vid]').forEach(r => r.addEventListener('change', () => { setPu(); calc(); }));
  ['tD', 'tAR', 'tP', 'tPu', 'tPe'].forEach(id => $('#' + id).addEventListener('input', calc));
  $('#tf').onsubmit = ev => ev.preventDefault();
  setTimeout(() => $('#tD').focus(), 300);
});

/* ======================= Comparer les véhicules ======================= */
EXTRA_VIEWS.compare = function(){
  const V = S.vehicles, y = addDays(today(), -365);
  if (V.length < 2) return '<div class="card" style="margin-top:16px"><div class="empty"><div class="e">⚖️</div><b>Il faut au moins 2 véhicules</b></div></div>';
  const rows = V.map(v => {
    const c = realConso(v), pu = avgPrice(v.id) || lastPrice() || 1.85, km12 = kmRate(v) * 365, f12 = spend(fuelsOf(v.id), y), m12 = spend(maintOf(v.id), y);
    return { v, rate:kmRate(v) * 30.4, c, real:!!avgConso(v.id), pu, c100:c * pu, f12, m12, tot12:f12 + m12, perKm:(f12 + m12) > 0 && km12 > 0 ? (f12 + m12) / km12 : null, auto:v.reservoir / c * 100, cr:critair(v) };
  });
  const best = (k, min = true) => { const vals = rows.map(r => r[k]).filter(ok); return vals.length ? (min ? Math.min(...vals) : Math.max(...vals)) : null; };
  const line = (lab, k, fmt, min = true, hi = true) => { const b = hi ? best(k, min) : null; return `<tr><td>${lab}</td>${rows.map(r => `<td class="${ok(r[k]) && r[k] === b && rows.length > 1 ? 'best' : ''}">${ok(r[k]) ? fmt(r[k], r) : '–'}</td>`).join('')}</tr>`; };
  const cheapest = rows.slice().sort((a, b) => a.c100 - b.c100)[0];
  return `<div class="row" style="margin-top:16px"><button class="back" data-nav="home" style="font-weight:700;color:var(--soft)">‹ Garage</button></div>
  <h2 style="font-size:24px;font-weight:900;margin-top:4px">⚖️ Comparer mes véhicules</h2>
  <div class="card cmpw"><table class="cmp"><thead><tr><th></th>${rows.map(r => `<th style="color:${r.v.color}">${vIcon(r.v)} ${esc(shortName(r.v))}</th>`).join('')}</tr></thead><tbody>
    ${line('Carburant pour 100 km', 'c100', x => eur(x))}
    ${line('Consommation', 'c', (x, r) => nf(x, 1) + (r.real ? '' : ' ≈'))}
    ${line('Prix moyen du litre', 'pu', x => nf(x, 3) + ' €')}
    ${line('Kilomètres / mois', 'rate', x => nf(x), false, false)}
    ${line('Dépenses 12 mois', 'tot12', x => eur(x, 0))}
    ${line('dont entretien', 'm12', x => eur(x, 0))}
    ${line('Coût total / km', 'perKm', x => nf(x, 3) + ' €')}
    ${line('Autonomie', 'auto', x => kmf(x), false)}
    <tr><td>Crit’Air</td>${rows.map(r => `<td>${r.cr ? `<span class="crit" style="background:${CRIT_COL[r.cr]};${r.cr === 'NC' || r.cr === '4' ? 'color:#fff' : ''}">${r.cr === 'NC' ? '–' : r.cr}</span>` : '–'}</td>`).join('')}</tr>
  </tbody></table><p class="hint">≈ : consommation constructeur, en attendant 2 pleins complets. En vert : le meilleur.</p></div>
  <h2 class="sec">Pour un trajet de 100 km</h2>
  <div class="card">${barChart(rows.map(r => ({ lab:shortName(r.v).slice(0, 7), f:r.c100 })), [{ k:'f', n:'Carburant (€)', c:'#38bdf8' }])}</div>
  <h2 class="sec">Quel véhicule prendre ?</h2>
  <div class="ins ok"><span class="e">💡</span><div><b>Le plus économique : ${esc(cheapest.v.nom)}</b><p>≈ ${eur(cheapest.c100)} de carburant aux 100 km.${typeOf(cheapest.v) === 'moto' ? ' Idéal seul et par beau temps.' : ''}</p></div></div>
  ${rows.filter(r => typeOf(r.v) === 'van').map(r => `<div class="ins"><span class="e">📦</span><div><b>Pour charger : ${esc(r.v.nom)}</b><p>${esc(specVal(r.v, 'Volume utile') || '')} de volume utile${specVal(r.v, 'Charge utile') ? ', ' + esc(specVal(r.v, 'Charge utile')) + ' de charge' : ''}.${r.cr === 'NC' ? ' Évite les ZFE en semaine.' : ''}</p></div></div>`).join('')}
  ${rows.filter(r => /hybride/i.test(variantOf(r.v).nom)).map(r => `<div class="ins"><span class="e">🌿</span><div><b>En ville : ${esc(r.v.nom)}</b><p>L’hybride roule souvent à l’électrique en ville : c’est là qu’elle consomme le moins.</p></div></div>`).join('')}`;
};

/* ======================= Moto : sorties et hivernage ======================= */
const WINTER = [['plein', 'Réservoir plein (évite la rouille)'], ['batt', 'Batterie sur chargeur de maintien (ou débranchée)'], ['pneus', 'Pneus gonflés, béquille centrale ou sur cales'], ['chaine', 'Chaîne nettoyée et graissée'], ['lavage', 'Moto lavée et séchée, chromes protégés'], ['bache', 'Bâche respirante, à l’abri de l’humidité']];
hook('vOverview', v => {
  if (typeOf(v) !== 'moto') return '';
  const R = S.rides.filter(r => r.vid === v.id).sort((a, b) => sortD(b, a)), yr = R.filter(r => r.d >= yearStart()), W = v.winter || {};
  const lastCharge = W.charge ? days(W.charge, today()) : null;
  return `<h2 class="sec">🏍️ Sorties<span class="spacer"></span><button data-x="ride" data-v="${v.id}">＋ Sortie</button></h2>
  <div class="grid3"><div class="card"><div class="hint" style="margin:0">Cette année</div><b class="num" style="font-size:19px">${kmf(sum(yr, r => r.dist || 0))}</b></div><div class="card"><div class="hint" style="margin:0">Sorties</div><b class="num" style="font-size:19px">${yr.length}</b></div><div class="card"><div class="hint" style="margin:0">Dernière</div><b class="num" style="font-size:19px">${R[0] ? fmtDs(R[0].d) : '–'}</b></div></div>
  ${R.length ? `<div class="list" style="margin-top:10px">${R.slice(0, 5).map(r => `<button class="item" ${vstyle(v)} data-x="rideedit" data-id="${r.id}"><span class="ic">🛣️</span><div class="tx"><b>${esc(r.titre || 'Sortie')}</b><small>${fmtD(r.d)}${r.note ? ' · ' + esc(r.note) : ''}</small></div><div class="rt"><b class="num">${r.dist ? kmf(r.dist) : ''}</b><small>${'★'.repeat(r.stars || 0)}</small></div></button>`).join('')}</div>` : ''}
  <h2 class="sec">❄️ Hivernage<span class="spacer"></span><button data-x="winter" data-v="${v.id}">${W.on ? 'Terminer' : 'Commencer'}</button></h2>
  <div class="card">${W.on ? `<p class="soft" style="font-size:13.5px">Moto à l’hivernage depuis le ${fmtD(W.since)}.</p>
    ${WINTER.map(([k, n]) => `<label class="chk"><input type="checkbox" data-x="wchk" data-v="${v.id}" data-k="${k}" ${(W.checks || {})[k] ? 'checked' : ''}>${esc(n)}</label>`).join('')}
    <div class="row" style="margin-top:12px"><span class="hint" style="margin:0;flex:1">🔋 ${lastCharge == null ? 'Batterie jamais rechargée' : 'Rechargée il y a ' + lastCharge + ' j'}</span><button class="btn sm" data-x="wcharge" data-v="${v.id}">Rechargée aujourd’hui</button></div>`
    : '<p class="soft" style="font-size:13.5px">Pendant l’hiver, une liste à cocher et un rappel pour recharger la batterie chaque mois.</p>'}</div>`;
});
ACTIONS.winter = (b, vid) => { const v = vById(vid); v.winter = v.winter && v.winter.on ? { on:false } : { on:true, since:today(), checks:{} }; save(); render(); toast(v.winter.on ? '❄️ Hivernage commencé' : '🌸 Bonne reprise ! Vérifie pneus, freins et chaîne'); };
ACTIONS.wchk = b => { const v = vById(b.dataset.v); v.winter.checks = v.winter.checks || {}; v.winter.checks[b.dataset.k] = b.checked; if (b.dataset.k === 'batt' && b.checked && !v.winter.charge) v.winter.charge = today(); save(); };
ACTIONS.wcharge = (b, vid) => { const v = vById(vid); v.winter.charge = today(); save(); render(); toast('🔋 Recharge notée'); };
INSIGHT_HOOKS.push(vf => S.vehicles.filter(v => v.winter && v.winter.on && (!vf || v.id === vf)).map(v => {
  const d = v.winter.charge ? days(v.winter.charge, today()) : days(v.winter.since, today());
  return d >= 30 ? { lv:'warn', e:'🔋', v, t:'Recharge la batterie de la moto', p:(v.winter.charge ? 'Dernière recharge il y a ' + d + ' jours.' : 'Hivernage commencé il y a ' + d + ' jours.') + ' Une batterie qui se décharge l’hiver s’abîme définitivement.', act:'plan' } : null;
}).filter(Boolean));
function rideForm(r, vid){
  const motos = S.vehicles.filter(v => typeOf(v) === 'moto'); if (!motos.length) return toast('Ajoute d’abord une moto');
  const isNew = !r; r = r || { id:uid(), vid:(vById(vid) && typeOf(vById(vid)) === 'moto' ? vid : motos[0].id), d:today(), stars:4 };
  const v = vById(r.vid);
  openSheet(`<h2>🏍️ ${isNew ? 'Nouvelle sortie' : 'Modifier la sortie'}</h2>
  ${isNew ? '<div class="preview">✅ Avant de partir : pression 2,5 / 2,9 bar · chaîne tendue et graissée · freins · feux et clignotants.</div>' : ''}
  <form id="rf"><label class="fld"><span>Titre</span><input class="inp" id="rT" placeholder="ex. Tour du lac du Salagou" value="${esc(r.titre || '')}"></label>
  <div class="grid2"><label class="fld"><span>Date</span><input class="inp" type="date" id="rD" value="${r.d}" max="${today()}"></label>
  <label class="fld"><span>Distance</span><div class="unit"><input class="inp" id="rKm" inputmode="numeric" value="${r.dist || ''}" placeholder="km"><em>km</em></div></label></div>
  <label class="fld"><span>Compteur à l’arrivée (facultatif)</span><div class="unit"><input class="inp" id="rC" inputmode="numeric" placeholder="dernier : ${nf(curKm(v))}" value="${r.odo || ''}"><em>km</em></div></label>
  <div class="fld"><span>Ressenti</span><div class="stars">${[1, 2, 3, 4, 5].map(n => `<label class="${n <= (r.stars || 0) ? 'on' : ''}"><input type="radio" name="st" value="${n}" ${n === r.stars ? 'checked' : ''}>⭐</label>`).join('')}</div></div>
  <label class="fld"><span>Note</span><input class="inp" id="rN" placeholder="Météo, route, ressenti…" value="${esc(r.note || '')}"></label>
  <div class="row" style="margin-top:18px">${isNew ? '' : '<button type="button" class="btn danger" id="rDel">🗑️</button>'}<span class="spacer"></span><button type="button" class="btn" data-x="close">Annuler</button><button class="btn pri">✅ Enregistrer</button></div></form>`);
  $$('.stars input').forEach(i => i.addEventListener('change', () => $$('.stars label').forEach((l, k) => l.classList.toggle('on', k < +i.value))));
  $('#rf').onsubmit = ev => {
    ev.preventDefault();
    Object.assign(r, { titre:$('#rT').value.trim(), d:$('#rD').value || today(), dist:Math.round(pnum($('#rKm').value)) || null, odo:Math.round(pnum($('#rC').value)) || null, note:$('#rN').value.trim(), stars:+(($('#rf [name=st]:checked') || {}).value || 0) });
    if (r.odo && r.odo > curKm(v)) v.kmLog.push({ d:r.d, km:r.odo });
    if (isNew) S.rides.push(r);
    save(); closeSheet(); render(); toast('🏍️ Sortie enregistrée');
  };
  if (!isNew) $('#rDel').onclick = () => confirmSheet('Supprimer cette sortie ?', '🗑️ Supprimer', () => { S.rides = S.rides.filter(x => x.id !== r.id); save(); render(); });
}
ACTIONS.ride = (b, vid, fromSheet) => fromSheet(() => rideForm(null, vid));
ACTIONS.rideedit = b => { const r = S.rides.find(x => x.id === b.dataset.id); if (r) rideForm(r); };

/* ======================= Papiers : valeur, collection, dossier PDF ======================= */
hook('vDocs', v => {
  const val = (v.valeur || []).slice().sort(sortD), last = val[val.length - 1], y = vYear(v), q = encodeURIComponent('cote ' + v.nom + ' ' + variantOf(v).nom + (y ? ' ' + y : ''));
  return `<div class="card spec"><h3>🏛️ Année, valeur et statut</h3><dl>
    <dt>Mise en circulation</dt><dd>${y || '<span class="muted">–</span>'}</dd>
    <dt>Valeur estimée</dt><dd>${last ? eur(last.eur, 0) + ' <span class="muted">(' + fmtDs(last.d) + ')</span>' : '<span class="muted">–</span>'}</dd>
    <dt>Carte grise collection</dt><dd>${v.docs.collection ? '✅ Oui' : 'Non'}</dd></dl>
    ${val.length > 1 ? lineChart(val.map(x => ({ x:fmtDs(x.d), y:x.eur })), { color:v.color, dec:0 }) : ''}
    <div class="row" style="margin-top:12px"><button class="btn sm" data-x="valeur" data-v="${v.id}">✏️ Mettre à jour</button><a class="btn sm" href="https://www.google.com/search?q=${q}" target="_blank" rel="noopener">🔎 Chercher la cote</a></div></div>
  <div class="card"><b>📄 Dossier d’entretien</b><p class="hint">Un document propre avec l’historique, le plan d’entretien et tes factures : idéal pour un contrôle, une assurance ou une revente. Choisis « Enregistrer en PDF » à l’impression.</p>
    <div class="row" style="margin-top:10px"><button class="btn pri" data-x="pdf" data-v="${v.id}">📄 Créer le PDF</button><button class="btn" data-x="ics">📅 Échéances dans l’agenda</button></div></div>`;
});
ACTIONS.valeur = (b, vid) => {
  const v = vById(vid);
  openSheet(`<h2>🏛️ ${esc(v.nom)}</h2><form id="vlf">
  <label class="fld"><span>Année de mise en circulation</span><input class="inp" id="vY" inputmode="numeric" value="${vYear(v) || ''}" placeholder="ex. 1992"></label>
  <div class="grid2"><label class="fld"><span>Valeur estimée</span><div class="unit"><input class="inp" id="vE" inputmode="numeric" placeholder="€"><em>€</em></div></label>
  <label class="fld"><span>Source</span><input class="inp" id="vS" placeholder="La Centrale, Argus…"></label></div>
  <label class="tog"><span>Carte grise « collection »</span><input type="checkbox" id="vCol" ${v.docs.collection ? 'checked' : ''}><i class="sw"></i></label>
  <p class="hint">Avec la carte grise collection, le contrôle technique passe à tous les 5 ans : pense à corriger sa date dans les papiers.</p>
  <button class="btn pri block" style="margin-top:16px">Enregistrer</button></form>`);
  $('#vlf').onsubmit = ev => {
    ev.preventDefault(); const Y = Math.round(pnum($('#vY').value)), E = Math.round(pnum($('#vE').value));
    if (Y > 1900 && Y <= new Date().getFullYear()) v.docs.annee = Y;
    if (E > 0){ v.valeur = v.valeur || []; v.valeur.push({ d:today(), eur:E, src:$('#vS').value.trim() }); }
    v.docs.collection = $('#vCol').checked; save(); closeSheet(); render(); toast('Enregistré');
  };
};
async function printDossier(v){
  toast('📄 Préparation du dossier…');
  const M = maintOf(v.id).sort(sortD), st = maintStatus(v), photos = [];
  for (const m of M.filter(x => x.photo)){ const src = await idb.get(m.id); if (src) photos.push([m, src]); }
  const ph = PHOTOS[v.model] && PHOTOS[v.model][0].test(v.variant || '') ? `<img class="vimg" src="img/${v.model}.webp" alt="">` : '';
  const D = v.docs, opName = m => m.titre || (m.items || []).map(i => (v.plan.find(p => p.id === i) || {}).nom).filter(Boolean).join(', ');
  $('#printArea').innerHTML = `<div class="pr">
    <h1>Dossier d’entretien · ${esc(v.nom)}</h1><div class="sub">${esc(variantOf(v).nom)} · édité le ${fmtD(today())} avec Mon Garage</div>${ph}
    <h2>Véhicule</h2><div class="kv"><span>Immatriculation : <b>${esc(D.immat || '–')}</b></span><span>N° de série : <b>${esc(D.vin || '–')}</b></span>
      <span>Mise en circulation : <b>${vYear(v) || '–'}</b></span><span>Kilométrage actuel : <b>${kmf(curKm(v))}</b></span>
      <span>Prochain contrôle technique : <b>${D.ct ? fmtD(D.ct) : '–'}</b></span><span>Consommation réelle : <b>${avgConso(v.id) ? nf(avgConso(v.id), 1) + ' L/100' : '–'}</b></span>
      <span>Interventions enregistrées : <b>${M.length}</b></span><span>Total entretien : <b>${eur(sum(M, m => m.eur || 0))}</b></span></div>
    <h2>Historique des interventions</h2>${M.length ? `<table><tr><th>Date</th><th>Km</th><th>Opérations</th><th>Garage</th><th>Coût</th></tr>${M.map(m => `<tr><td>${fmtD(m.d)}</td><td>${ok(m.km) ? nf(m.km) : '–'}</td><td>${esc(opName(m))}${m.detail ? '<br><small>' + esc(m.detail).replace(/\n/g, '<br>') + '</small>' : ''}</td><td>${m.diy ? 'Moi-même' : esc(m.garage || '')}</td><td>${ok(m.eur) ? eur(m.eur) : ''}</td></tr>`).join('')}</table>` : '<p>Aucune intervention enregistrée.</p>'}
    <h2>Plan d’entretien</h2><table><tr><th>Élément</th><th>Intervalle</th><th>Dernière fois</th><th>Prochaine échéance</th></tr>${st.map(x => `<tr><td>${esc(x.nom)}</td><td>${[x.km ? nf(x.km) + ' km' : '', x.mois ? x.mois + ' mois' : ''].filter(Boolean).join(' / ')}</td><td>${x.last ? fmtD(x.last.d) + (ok(x.last.km) ? ' · ' + nf(x.last.km) + ' km' : '') : '–'}</td><td>${x.state === 'unk' ? '–' : esc(x.txt)}</td></tr>`).join('')}</table>
    ${photos.length ? '<h2>Factures</h2>' + photos.map(([m, src]) => `<img class="ph" src="${src}" alt="${esc(fmtD(m.d))}">`).join('') : ''}</div>`;
  const imgs = $$('#printArea img'); await Promise.all(imgs.map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  setTimeout(() => { window.print(); }, 200);
}
ACTIONS.pdf = (b, vid) => printDossier(vById(vid));
window.addEventListener('afterprint', () => { $('#printArea').innerHTML = ''; });

/* ======================= Versions et nouveautés ======================= */
const APP_VERSION = '2.2';
const CHANGELOG = [
  ['2.2', '2026-10-21', ['Numéro de version et liste des nouveautés dans les réglages', 'Fenêtre « Quoi de neuf ? » après chaque mise à jour']],
  ['2.1', '2026-10-21', ['Nouvelle icône : compteur néon, goutte, clé et les trois véhicules']],
  ['2.0', '2026-10-21', ['Prix des carburants autour de moi, en liste et sur une carte', 'Rappels : notifications et ajout des échéances à l’agenda', 'Lecture du compteur kilométrique en photo', 'Budget annuel par véhicule', 'Coût d’un trajet et comparaison des véhicules', 'Moto : carnet de sorties et mode hivernage', 'Crit’Air, conseils ZFE et carte grise collection', 'Dossier d’entretien en PDF', 'Garage séparé pour Béa et bouton vers Mon Programme']],
  ['1.4', '2026-10-21', ['Vraies photos de l’Auris, de l’Express et de la Z750 S']],
  ['1.3', '2026-10-21', ['L’appli a son propre projet et sa propre adresse']],
  ['1.2', '2026-10-21', ['Nouveaux dessins des véhicules et couleur de carrosserie']],
  ['1.1', '2026-10-21', ['Fiches Toyota Auris hybride et Renault Express 1.1 de 1992']],
  ['1.0', '2026-10-21', ['Première version : pleins, scan des tickets, consommation, entretien, conseils et mécano IA']]
];
const changeHTML = list => list.map(([v, d, items]) => `<div class="card" style="margin-top:10px"><div class="row"><b>Version ${v}</b>${v === APP_VERSION ? '<span class="badge ok">actuelle</span>' : ''}<span class="spacer"></span><span class="hint" style="margin:0">${fmtD(d)}</span></div><ul style="margin:8px 0 0 18px;color:var(--soft);font-size:13.5px;line-height:1.55">${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('');
hook('settings', () => `<h2 class="sec">Application</h2><button class="item" data-x="changelog" style="--vc:#818cf8"><span class="ic">✨</span><div class="tx"><b>Mon Garage · version ${APP_VERSION}</b><small>Mise à jour du ${fmtD(CHANGELOG[0][1])} · voir les nouveautés</small></div><span class="muted">›</span></button>`);
ACTIONS.changelog = () => openSheet(`<h2>✨ Nouveautés</h2><p class="hint">Version installée : <b>${APP_VERSION}</b></p>${changeHTML(CHANGELOG)}`);
hook('start', () => {
  const seen = safeGet('garage_version', null) || (S.updated ? '2.1' : null); safeSet('garage_version', APP_VERSION);
  if (!seen || seen === APP_VERSION) return;
  const news = CHANGELOG.filter(([v]) => v.localeCompare(seen, undefined, { numeric:true }) > 0);
  if (news.length) setTimeout(() => openSheet(`<h2>🎉 Quoi de neuf ?</h2><p class="hint">Mon Garage est passé de la version ${esc(seen)} à la version <b>${APP_VERSION}</b>.</p>${changeHTML(news)}<button class="btn pri block" style="margin-top:14px" data-x="close">Super !</button>`), 900);
});
