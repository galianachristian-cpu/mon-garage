/* ============================================================
   MON GARAGE : pleins, entretien, scan de tickets et conseils
   ============================================================ */

/* ---------- Outils ---------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clone = o => JSON.parse(JSON.stringify(o));
const z2 = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + z2(d.getMonth() + 1) + '-' + z2(d.getDate());
const today = () => ymd(new Date());
const pd = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const days = (a, b) => Math.round((pd(b) - pd(a)) / 864e5);
const addMonths = (s, n) => { const d = pd(s); d.setMonth(d.getMonth() + n); return ymd(d); };
const addDays = (s, n) => { const d = pd(s); d.setDate(d.getDate() + n); return ymd(d); };
const nf = (n, dec = 0) => (n == null || !isFinite(n)) ? '–' : Number(n).toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const eur = (n, dec = 2) => nf(n, dec) + ' €';
const kmf = n => nf(Math.round(n)) + ' km';
const pnum = v => { if (v == null) return NaN; const s = String(v).replace(/[\s  ]/g, '').replace(',', '.'); return s === '' ? NaN : Number(s); };
const ok = n => typeof n === 'number' && isFinite(n);
const r2 = n => Math.round(n * 100) / 100, r3 = n => Math.round(n * 1000) / 1000;
const fmtD = s => s ? pd(s).toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' }) : '–';
const fmtDs = s => pd(s).toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
const fmtMo = s => { const t = pd(s).toLocaleDateString('fr-FR', { month:'long', year:'numeric' }); return t[0].toUpperCase() + t.slice(1); };
const sum = (a, f) => a.reduce((s, x) => s + (f ? f(x) : x), 0);
const sortD = (a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : (a.km || 0) - (b.km || 0));

/* ---------- Données ---------- */
const LS = 'garage_v1', KEY_AI = 'garage_ai_key', KEY_MODEL = 'garage_ai_model';
const modelOf = v => MODELS[v.model] || { marque:'', modele:v.nom, type:v.type || 'car', color:v.color, variants:{} };
const variantOf = v => modelOf(v).variants[v.variant] || { nom:'Personnalisé', annees:'', specs:[], plan:[] };
const typeOf = v => modelOf(v).type;
const vById = id => S.vehicles.find(v => v.id === id);

function newVehicle(model, variant, o = {}){
  const M = MODELS[model], V = M ? M.variants[variant] : null;
  return Object.assign({ id: o.id || uid(), model, variant, nom: o.nom || (M ? M.marque + ' ' + M.modele : 'Véhicule'), color: (M && M.color) || '#38bdf8',
    type: M ? M.type : (o.type || 'car'), kmLog: [], base: {}, docs: {}, plan: clone(V ? V.plan : (o.type === 'moto' ? PLAN_MOTO : PLAN_CAR)),
    reservoir: V ? V.reservoir : 50, conso: V ? V.conso : 6, carb: V ? V.carb : 'SP95-E10', created: today() }, o.extra || {});
}
function fresh(){ return migrate({ v:1, updated:0, setup:false, vehicles: DEFAULT_VEHICLES.map(d => newVehicle(d.model, MODELS[d.model].def, d)), fuels:[], maint:[] }); }
function safeGet(k, d){ try{ const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); }catch(e){ return d; } }
function safeSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
function migrate(s){
  if (!s || !Array.isArray(s.vehicles)) return fresh();
  s.fuels = s.fuels || []; s.maint = s.maint || [];
  s.vehicles.forEach(v => { v.kmLog = v.kmLog || []; v.base = v.base || {}; v.docs = v.docs || {}; v.plan = v.plan || []; if (!v.paint || (v.id === 'z750s' && v.paint === v.color && !v.done)) v.paint = (v.id === 'auris' || v.id === 'express') ? '#f4f6f8' : v.id === 'z750s' ? '#1f2937' : v.color; });
  // motorisations confirmées : Auris hybride et Express 1.1 essence de 1992 (si pas encore réglées à la main)
  [['auris', 'auris2-133', 'auris2-hsd'], ['express', 'express2-tce', 'express1-11']].forEach(([id, from, to]) => {
    const v = s.vehicles.find(x => x.id === id && x.variant === from && !x.done); if (!v) return;
    const V = MODELS[v.model].variants[to]; v.variant = to; v.reservoir = V.reservoir; v.conso = V.conso; v.carb = V.carb; v.plan = clone(V.plan);
  });
  return s;
}
let S = migrate(safeGet(LS, null));

/* ---------- Sauvegarde : appareil + Firebase (même projet que Mon Programme) ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyAcqFFFbRlKgnL7LQLY6YFoGV8oYSqBSWA",
  authDomain: "mon-app-sport-2cba3.firebaseapp.com",
  projectId: "mon-app-sport-2cba3",
  storageBucket: "mon-app-sport-2cba3.firebasestorage.app",
  messagingSenderId: "841648877986",
  appId: "1:841648877986:web:9a70279ba4edafca8c2fb",
  measurementId: "G-EVPMSD8YBW"
};
let db = null, pushTimer = null, remoteOk = false;
try { if (window.firebase){ firebase.initializeApp(firebaseConfig); db = firebase.firestore(); try{ db.enablePersistence({ synchronizeTabs:true }).catch(() => {}); }catch(e){} } } catch(e){ db = null; }
const DOCG = () => db.collection('users').doc('garage');

function setStatus(cls, txt){ $('#syncDot').className = 'dot ' + cls; $('#syncTxt').textContent = txt; }
function save(){
  S.updated = Date.now(); safeSet(LS, S);
  if (!db){ setStatus('local', 'Sur l’appareil'); return; }
  setStatus('saving', 'Envoi…');
  clearTimeout(pushTimer); pushTimer = setTimeout(push, 600);
}
async function push(){
  try{ await DOCG().set({ json: JSON.stringify(S), updated: S.updated, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() }); setStatus('saved', 'Synchronisé'); }
  catch(e){ setStatus('error', 'Hors ligne'); }
}
function startSync(){
  if (!db){ setStatus('local', 'Sur l’appareil'); return; }
  setStatus('saving', 'Connexion…');
  DOCG().onSnapshot(doc => {
    remoteOk = true;
    if (!doc.exists){ if (S.updated) push(); else setStatus('saved', 'Synchronisé'); return; }
    const r = doc.data(); let rem = null; try{ rem = JSON.parse(r.json); }catch(e){}
    if (!rem){ setStatus('error', 'Erreur'); return; }
    if ((rem.updated || 0) > (S.updated || 0)){ S = migrate(rem); safeSet(LS, S); render(); setStatus('saved', 'Synchronisé'); }
    else if ((S.updated || 0) > (rem.updated || 0)) push();
    else setStatus('saved', 'Synchronisé');
  }, () => setStatus('error', 'Hors ligne'));
}

/* Photos des tickets et factures : gardées sur l'appareil (IndexedDB) */
const idb = (() => {
  let p;
  const open = () => p || (p = new Promise((res, rej) => { const r = indexedDB.open('garage-photos', 1); r.onupgradeneeded = () => r.result.createObjectStore('p'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const tx = (mode, fn) => open().then(d => new Promise((res, rej) => { const t = d.transaction('p', mode), rq = fn(t.objectStore('p')); t.oncomplete = () => res(rq && rq.result); t.onerror = () => rej(t.error); }));
  return { put:(k, v) => tx('readwrite', s => s.put(v, k)).catch(() => {}), get:k => tx('readonly', s => s.get(k)).catch(() => null), del:k => tx('readwrite', s => s.delete(k)).catch(() => {}) };
})();
function loadThumbs(){ $$('[data-photo]').forEach(async el => { const src = await idb.get(el.dataset.photo); if (src){ el.src = src; el.hidden = false; } }); }

/* ---------- Calculs ---------- */
function kmRecords(v){
  const r = [];
  S.fuels.forEach(f => { if (f.vid === v.id && ok(f.km)) r.push({ d:f.d, km:f.km }); });
  S.maint.forEach(m => { if (m.vid === v.id && ok(m.km)) r.push({ d:m.d, km:m.km }); });
  v.kmLog.forEach(k => r.push(k));
  return r.sort(sortD);
}
function curKm(v){ const r = kmRecords(v); let m = r.length ? Math.max(...r.map(x => x.km)) : 0; Object.values(v.base).forEach(b => { if (ok(b.km) && b.km > m) m = b.km; }); return m; }
const DEF_RATE = { car:35, van:40, moto:14 };
function kmRate(v){
  const r = kmRecords(v); if (r.length >= 2){ const a = r[0], b = r[r.length - 1], dd = days(a.d, b.d); if (dd >= 10 && b.km > a.km) return (b.km - a.km) / dd; }
  return DEF_RATE[typeOf(v)] || 30;
}
function fuelsOf(vid){ return S.fuels.filter(f => vid === 'all' || f.vid === vid); }
function maintOf(vid){ return S.maint.filter(m => vid === 'all' || m.vid === vid); }
/* Consommation par la méthode « plein à plein » */
function consoSeries(vid){
  const F = S.fuels.filter(f => f.vid === vid && ok(f.km) && ok(f.l)).sort((a, b) => a.km - b.km || (a.d < b.d ? -1 : 1));
  const out = []; let lastKm = null, acc = 0;
  F.forEach(f => {
    if (lastKm == null){ if (f.full) { lastKm = f.km; acc = 0; } return; }
    acc += f.l;
    if (f.full){ const dist = f.km - lastKm; if (dist > 20){ const c = acc / dist * 100; if (c > 1 && c < 40) out.push({ id:f.id, d:f.d, km:f.km, c, dist, l:acc }); } lastKm = f.km; acc = 0; }
  });
  return out;
}
function avgConso(vid, ser){ ser = ser || consoSeries(vid); const L = sum(ser, s => s.l), D = sum(ser, s => s.dist); return D > 0 ? L / D * 100 : null; }
const consoMap = () => { const m = {}; S.vehicles.forEach(v => consoSeries(v.id).forEach(s => { m[s.id] = s; })); return m; };
function trackedKm(vid){ const F = S.fuels.filter(f => f.vid === vid && ok(f.km)); if (F.length < 2) return 0; return Math.max(...F.map(f => f.km)) - Math.min(...F.map(f => f.km)); }
function spend(list, from, to){ return sum(list.filter(x => (!from || x.d >= from) && (!to || x.d <= to)), x => x.eur || 0); }
const monthStart = (off = 0) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + off); return ymd(d); };

/* État de chaque élément du plan d'entretien */
function lastDone(v, id){
  let best = null;
  S.maint.forEach(m => { if (m.vid === v.id && (m.items || []).includes(id) && (!best || m.d > best.d)) best = { d:m.d, km:m.km, mid:m.id }; });
  const b = v.base[id]; if (b && b.d && (!best || b.d > best.d)) best = { d:b.d, km:b.km };
  return best;
}
function maintStatus(v){
  const ck = curKm(v), rate = kmRate(v), t = today();
  return v.plan.filter(p => p.km || p.mois).map(p => {
    const last = lastDone(v, p.id), r = Object.assign({}, p, { last, v });
    if (!last){ r.state = 'unk'; r.pct = 0; r.txt = 'Dernière intervention inconnue : touche pour la renseigner'; return r; }
    let pK = 0, pT = 0, leftKm = null, leftD = null, dueD = null;
    if (p.km && ok(last.km)){ leftKm = last.km + p.km - ck; pK = (ck - last.km) / p.km; }
    if (p.mois){ dueD = addMonths(last.d, p.mois); leftD = days(t, dueD); pT = days(last.d, t) / Math.max(1, days(last.d, dueD)); }
    let pred = dueD;
    if (leftKm != null && leftKm > 0 && rate > 0){ const k = addDays(t, Math.round(leftKm / rate)); if (!pred || k < pred) pred = k; }
    r.pct = Math.max(pK, pT); r.leftKm = leftKm; r.leftD = leftD; r.dueD = dueD; r.pred = pred;
    const soonKm = leftKm != null && leftKm <= Math.min(1000, p.km * .1), soonD = leftD != null && leftD <= 30;
    r.state = r.pct >= 1 ? 'ko' : (r.pct >= .85 || soonKm || soonD) ? 'warn' : 'ok';
    const parts = [];
    if (leftKm != null) parts.push(leftKm >= 0 ? 'dans ' + kmf(leftKm) : 'dépassé de ' + kmf(-leftKm));
    if (leftD != null) parts.push(leftD >= 0 ? 'avant le ' + fmtD(dueD) : 'échu depuis le ' + fmtD(dueD));
    r.txt = parts.length ? parts.join(' · ') : 'Fait le ' + fmtD(last.d) + ' (ajoute le kilométrage pour suivre)';
    return r;
  });
}
const ORDER = { ko:0, warn:1, unk:2, ok:3, info:2 };

/* ---------- Intelligence : conseils automatiques ---------- */
function insights(vfilter){
  const out = [], t = today(), mo = new Date().getMonth();
  S.vehicles.filter(v => !vfilter || v.id === vfilter).forEach(v => {
    const ty = typeOf(v), st = maintStatus(v);
    st.filter(x => x.state === 'ko').forEach(x => out.push({ lv:'ko', e:x.ic, v, t:x.nom + ' : à faire', p:x.txt + '. Touche pour enregistrer l’intervention.', act:'item', item:x.id }));
    st.filter(x => x.state === 'warn').forEach(x => out.push({ lv:'warn', e:x.ic, v, t:x.nom + ' bientôt', p:x.txt + (x.pred ? ' · prévu vers ' + fmtD(x.pred) + ' à ton rythme' : '') + '.', act:'item', item:x.id }));
    const unk = st.filter(x => x.state === 'unk');
    if (unk.length) out.push({ lv:'info', e:'🧭', v, t:unk.length + ' entretien' + (unk.length > 1 ? 's' : '') + ' sans historique', p:'Indique quand ' + (unk.length > 1 ? 'ils ont été faits' : 'il a été fait') + ' la dernière fois (' + unk.slice(0, 3).map(x => x.nom.toLowerCase()).join(', ') + (unk.length > 3 ? '…' : '') + ') pour activer les prévisions.', act:'plan' });
    // documents
    [['ct', 'Contrôle technique', '📋'], ['assu', 'Assurance', '🛡️']].forEach(([k, n, e]) => {
      const d = v.docs[k]; if (!d) return; const left = days(t, d);
      if (left < 0) out.push({ lv:'ko', e, v, t:n + ' expiré', p:'Échéance dépassée depuis le ' + fmtD(d) + '.', act:'edit' });
      else if (left <= 45) out.push({ lv:'warn', e, v, t:n + ' dans ' + left + ' jour' + (left > 1 ? 's' : ''), p:'Échéance le ' + fmtD(d) + '. Pense à prendre rendez-vous.', act:'edit' });
    });
    if (!v.docs.ct) out.push({ lv:'info', e:'📋', v, t:'Date du contrôle technique', p: ty === 'moto' ? 'Les motos passent le contrôle technique depuis 2024 (tous les 3 ans). Ajoute la date pour être prévenu.' : 'Ajoute la date du prochain contrôle technique pour recevoir un rappel 45 jours avant.', act:'edit' });
    // consommation
    const ser = consoSeries(v.id);
    if (ser.length >= 3){
      const last = ser[ser.length - 1], prev = avgConso(v.id, ser.slice(0, -1)), dev = (last.c - prev) / prev;
      if (dev > .12){
        const why = ty === 'moto' ? 'tension et graissage de chaîne, pression des pneus (2,5 / 2,9 bar), filtre à air, conduite plus sportive' : 'pression des pneus, chargement ou galerie, trajets courts à froid, filtre à air, clim';
        out.push({ lv:'warn', e:'📈', v, t:'Consommation en hausse de ' + nf(dev * 100) + ' %', p:'Dernier plein : ' + nf(last.c, 1) + ' L/100 contre ' + nf(prev, 1) + ' en moyenne. Pistes : ' + why + '.' });
      } else if (dev < -.08) out.push({ lv:'ok', e:'🌿', v, t:'Belle économie de carburant', p:'Dernier plein à ' + nf(last.c, 1) + ' L/100, ' + nf(-dev * 100) + ' % sous ta moyenne. Continue comme ça !' });
      const avg = avgConso(v.id, ser);
      if (v.conso && avg > v.conso * 1.25) out.push({ lv:'info', e:'🔎', v, t:'Au-dessus de la valeur constructeur', p:'Ta moyenne (' + nf(avg, 1) + ' L/100) dépasse de ' + nf((avg / v.conso - 1) * 100) + ' % la valeur annoncée (' + nf(v.conso, 1) + '). C’est courant en ville, mais un contrôle des pneus et du filtre à air peut aider.' });
    }
    // moto : saisons
    const lastRec = kmRecords(v).pop();
    if (ty === 'moto' && (mo >= 10 || mo <= 1) && (!lastRec || days(lastRec.d, t) > 21))
      out.push({ lv:'info', e:'🥶', v, t:'Hivernage de la moto', p:'Batterie sur un chargeur de maintien, réservoir plein (évite la rouille), pneus gonflés, chaîne graissée et bâche respirante.' });
    if (ty === 'moto' && (mo === 2 || mo === 3))
      out.push({ lv:'info', e:'🌸', v, t:'Remise en route de printemps', p:'Contrôle pression des pneus, niveau d’huile, freins, tension de chaîne et charge de batterie avant la première sortie.' });
    if (ty !== 'moto' && (mo === 9 || mo === 10))
      out.push({ lv:'info', e:'🏔️', v, t:'Loi Montagne (1er novembre → 31 mars)', p:'Dans les zones de montagne, pneus hiver / 4 saisons « 3PMSF » ou chaînes à bord obligatoires. Pense aussi à l’antigel et au lave-glace hiver.' });
    if (!fuelsOf(v.id).length) out.push({ lv:'info', e:'⛽', v, t:'Premier plein à saisir', p:'Fais un plein complet et note le kilométrage : dès le 2e plein complet, l’appli calcule ta vraie consommation.', act:'fuel' });
  });
  // prix du carburant : station la moins chère
  {
    const recent = S.fuels.filter(f => f.station && ok(f.pu) && days(f.d, t) <= 120 && (!vfilter || f.vid === vfilter));
    const by = {}; recent.forEach(f => { (by[f.station] = by[f.station] || []).push(f.pu); });
    const st = Object.entries(by).map(([s, a]) => [s, sum(a) / a.length, a.length]).sort((a, b) => a[1] - b[1]);
    if (st.length >= 2 && st[st.length - 1][1] - st[0][1] >= .03){
      const most = Object.entries(by).sort((a, b) => b[1].length - a[1].length)[0][0], cheap = st[0];
      if (most !== cheap[0]){ const mAvg = st.find(x => x[0] === most)[1]; out.push({ lv:'ok', e:'💶', t:'Station la moins chère : ' + cheap[0], p:'En moyenne ' + nf(cheap[1], 3) + ' €/L contre ' + nf(mAvg, 3) + ' €/L chez ' + most + ', soit ≈ ' + eur((mAvg - cheap[1]) * 45) + ' d’économie sur un plein de 45 L.' }); }
    }
    const pf = S.fuels.filter(f => ok(f.pu) && (!vfilter || f.vid === vfilter)).sort(sortD);
    if (pf.length >= 4){
      const last = pf[pf.length - 1], old = pf.filter(f => days(f.d, last.d) >= 60).pop();
      if (old){ const dv = (last.pu - old.pu) / old.pu; if (Math.abs(dv) >= .04) out.push({ lv: dv > 0 ? 'warn' : 'ok', e: dv > 0 ? '📊' : '📉', t:'Prix du litre ' + (dv > 0 ? 'en hausse' : 'en baisse') + ' de ' + nf(Math.abs(dv) * 100) + ' %', p:nf(last.pu, 3) + ' €/L au dernier plein contre ' + nf(old.pu, 3) + ' €/L le ' + fmtD(old.d) + '.' }); }
    }
  }
  // budget du mois
  if (!vfilter){
    const m0 = monthStart(0), cur = spend(S.fuels, m0) + spend(S.maint, m0);
    const prev = [1, 2, 3].map(i => spend(S.fuels, monthStart(-i), addDays(monthStart(-i + 1), -1)) + spend(S.maint, monthStart(-i), addDays(monthStart(-i + 1), -1)));
    const avg = sum(prev) / 3, dayN = new Date().getDate(), dim = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    if (avg > 0 && dayN >= 5){ const proj = cur / dayN * dim; if (proj > avg * 1.3) out.push({ lv:'warn', e:'💸', t:'Mois plus coûteux que d’habitude', p:'Projection : ≈ ' + eur(proj, 0) + ' ce mois-ci contre ' + eur(avg, 0) + ' en moyenne sur les 3 derniers mois.' }); }
  }
  return out.sort((a, b) => ORDER[a.lv] - ORDER[b.lv]);
}

/* ---------- Silhouettes ---------- */
/* Silhouettes de profil, dessinées d'après chaque modèle ; `paint` = couleur de carrosserie */
// photos de profil (img/<modèle>.webp) : motorisation concernée et couleur de carrosserie de la photo
const PHOTOS = { auris:[/^auris2/, '#f4f6f8'], express:[/^express1/, '#f4f6f8'], z750s:[/^z750s/, '#1f2937'] };
function sil(v){
  const ph = PHOTOS[v.model];
  if (ph && ph[0].test(v.variant || '') && (!v.paint || v.paint === ph[1])) return `<img class="sil photo-sil${ph[1] === '#1f2937' ? ' dark' : ''}" src="img/${v.model}.webp" alt="${esc(v.nom)}">`;
  const ty = typeOf(v), paint = v.paint || v.color;
  const shape = ty === 'moto' ? 'moto' : v.model === 'express' && /^express1/.test(v.variant) ? 'express1' : ty === 'van' ? 'van' : 'hatch';
  const k = Math.random().toString(36).slice(2, 7), sh = 'sh' + k, gl = 'gl' + k;
  const defs = `<defs><linearGradient id="${sh}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></linearGradient>
    <linearGradient id="${gl}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#334155"/><stop offset="1" stop-color="#0b1220"/></linearGradient></defs>`;
  const body = d => `<path d="${d}" fill="${paint}"/><path d="${d}" fill="url(#${sh})" stroke="#000" stroke-opacity=".35" stroke-width=".8"/>`;
  const wheel = (x, y, r, spokes = 5) => {
    let s = `<circle cx="${x}" cy="${y}" r="${r}" fill="#0d1117"/><circle cx="${x}" cy="${y}" r="${r * .66}" fill="#9aa4b2"/><circle cx="${x}" cy="${y}" r="${r * .56}" fill="#1f2733"/>`;
    for (let i = 0; i < spokes; i++){ const a = i * 2 * Math.PI / spokes - Math.PI / 2; s += `<line x1="${x}" y1="${y}" x2="${(x + Math.cos(a) * r * .58).toFixed(1)}" y2="${(y + Math.sin(a) * r * .58).toFixed(1)}" stroke="#c4ccd6" stroke-width="${(r * .16).toFixed(1)}" stroke-linecap="round"/>`; }
    return s + `<circle cx="${x}" cy="${y}" r="${r * .14}" fill="#e5e7eb"/>`;
  };
  const shadow = `<ellipse cx="100" cy="72" rx="92" ry="4" fill="#000" opacity=".45"/>`;
  if (shape === 'hatch') return `<svg class="sil" viewBox="0 0 200 80" fill="none">${defs}${shadow}
    ${body('M14 54 C12 48 14 44 21 42 L64 33.5 C78 23 92 16.5 110 15 L128 15 C142 15.5 154 19 163 24.5 L168 26.5 L167 30.5 C171 37 174 44 175 51 L176 58 C176 62 174 64 170 64 L162 64 A15 15 0 0 0 132 64 L66 64 A15 15 0 0 0 36 64 L18 64 C14 64 13 60 14 54 Z')}
    <path d="M70 34.5 C82 25.5 95 19 110 18 L127 18 C139 18.6 150 22 158.5 27.5 L157.5 31 C130 31.6 100 33.2 70 34.5 Z" fill="url(#${gl})"/>
    <path d="M110.5 18 L109 33.4 M137 19 L141.5 31.4" stroke="${paint}" stroke-width="3.2"/>
    <path d="M24 47 C70 44.5 125 41.5 172 39" stroke="#000" stroke-opacity=".18" stroke-width="1"/>
    <path d="M26 44.5 C70 42 124 39 170 36.5" stroke="#fff" stroke-opacity=".5" stroke-width=".8"/>
    <path d="M109 35 L108 62 M68 37.5 L67 58" stroke="#000" stroke-opacity=".22" stroke-width=".7"/>
    <rect x="94" y="40" width="7" height="1.6" rx=".8" fill="#000" opacity=".35"/><rect x="130" y="38.3" width="7" height="1.6" rx=".8" fill="#000" opacity=".35"/>
    <path d="M74 34 L81 32.5 L81 37 L75 37.5 Z" fill="${paint}" stroke="#000" stroke-opacity=".3" stroke-width=".6"/>
    <path d="M18 43 L40 38.5 L36 44.5 L19 47 Z" fill="#dbeafe"/><path d="M20 44 L35 41" stroke="#60a5fa" stroke-width="1"/>
    <path d="M15 52.5 L34 51.5 L31 57.5 L17 58 Z" fill="#111827"/>
    <path d="M167 31 L173.5 35 L174.5 44 L165 41.5 Z" fill="#dc2626"/><path d="M158 25 L168 27" stroke="#111827" stroke-width="1.6"/>
    <path d="M18 62 L35 62 M66 63 L132 63" stroke="#111827" stroke-width="2"/>
    ${wheel(51, 64, 12.5)}${wheel(147, 64, 12.5)}</svg>`;
  if (shape === 'express1') return `<svg class="sil" viewBox="0 0 200 80" fill="none">${defs}${shadow}
    ${body('M10 56 C8 50 9 46 14 45 L44 41 C52 32 58 27 68 25 L80 24 C92 23.5 95 14.5 112 13.5 L184 13.5 C188 13.5 190 15 190 19 L190 58 C190 62 188 65 185 65 L165 65 A14 14 0 0 0 137 65 L55 65 A14 14 0 0 0 27 65 L14 65 C10 65 9 61 10 56 Z')}
    <path d="M51 40.5 C57 33 62 29 69 28 L89.5 27 L89.5 40 Z" fill="url(#${gl})"/>
    <path d="M70 28 L67 40" stroke="${paint}" stroke-width="1.6"/>
    <path d="M91 21 L91 64" stroke="#000" stroke-opacity=".3" stroke-width=".9"/>
    <path d="M112 16.5 L188 16.5" stroke="#000" stroke-opacity=".2" stroke-width=".7"/>
    <path d="M186.5 17 L186.5 62" stroke="#000" stroke-opacity=".25" stroke-width=".7"/>
    <path d="M112 18.5 L184 18.5" stroke="#fff" stroke-opacity=".55" stroke-width=".8"/>
    <path d="M27 51 L188 51" stroke="#1f2937" stroke-width="3"/>
    <rect x="82" y="43" width="6" height="1.6" rx=".8" fill="#000" opacity=".4"/>
    <path d="M56 41 L62 39.5 L62 43.5 L57 44 Z" fill="#1f2937"/>
    <rect x="11" y="45.5" width="11" height="4.5" rx="1" fill="#e0f2fe"/><rect x="12.5" y="46.5" width="3.5" height="2.5" fill="#fbbf24" opacity=".7"/>
    <rect x="7" y="53.5" width="20" height="7" rx="2" fill="#1f2937"/><rect x="176" y="58" width="16" height="6" rx="2" fill="#1f2937"/>
    <rect x="187.5" y="40" width="3" height="11" rx="1" fill="#dc2626"/>
    ${wheel(41, 65, 11.5, 4)}${wheel(151, 65, 11.5, 4)}</svg>`;
  if (shape === 'van') return `<svg class="sil" viewBox="0 0 200 80" fill="none">${defs}${shadow}
    ${body('M9 56 L9 44 Q9 38 16 37 L40 33 Q54 15 70 13 L184 12 Q190 12 190 18 L190 59 Q190 64 185 64 L166 64 A15 15 0 0 0 136 64 L65 64 A15 15 0 0 0 35 64 L14 64 Q9 64 9 56 Z')}
    <path d="M47 33 Q58 18 71 16 L84 16 L84 33 Z" fill="url(#${gl})"/>
    <path d="M88 15 L88 62 M150 15 L150 40" stroke="#000" stroke-opacity=".2" stroke-width=".7"/>
    <rect x="10" y="40" width="14" height="4" rx="2" fill="#dbeafe"/><rect x="186" y="26" width="3.5" height="12" rx="1" fill="#dc2626"/>
    <path d="M9 52 L30 52 L30 58 L10 58 Z" fill="#111827"/>
    ${wheel(50, 64, 12.5)}${wheel(151, 64, 12.5)}</svg>`;
  const pz = d => `<path d="${d}" fill="${paint}"/><path d="${d}" fill="url(#${sh})"/>`;
  return `<svg class="sil" viewBox="0 0 200 80" fill="none">${defs}${shadow}
    <path d="M120 45 L150 54" stroke="#4b5563" stroke-width="5" stroke-linecap="round"/>
    <path d="M128 25 L140 44" stroke="#f59e0b" stroke-width="2.4"/>
    ${wheel(48, 54, 20, 6)}${wheel(150, 54, 20, 6)}
    <circle cx="48" cy="54" r="11" stroke="#cbd5e1" stroke-width="1.6" opacity=".8"/><circle cx="150" cy="54" r="9" stroke="#cbd5e1" stroke-width="1.6" opacity=".8"/>
    <path d="M48 54 L70 17 M51 54 L73 18" stroke="#d1d5db" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M32 40 Q46 30 62 36" stroke="${paint}" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M80 28 L118 28 L116 49 L88 52 Z" fill="#4b5563"/><path d="M84 33 L114 33 M84 38 L113 38 M85 43 L112 43" stroke="#6b7280"/>
    <rect x="76" y="25" width="5" height="19" rx="1.5" fill="#111827"/>
    <path d="M86 48 Q90 60 108 59 L132 55" stroke="#9ca3af" stroke-width="3" stroke-linecap="round"/>
    <path d="M126 50 L152 45 L154 51 L129 57 Z" fill="#cbd5e1"/><path d="M128 53 L152 48" stroke="#94a3b8"/>
    ${pz('M80 23 Q88 11 108 12 L121 17 L119 28 L83 30 Z')}
    <path d="M90 16 Q100 13 110 14" stroke="#fff" stroke-opacity=".55" stroke-width="1"/>
    <path d="M119 19 L150 15.5 L158 18 L151 22.5 L121 26 Z" fill="#111827"/>
    ${pz('M148 15.5 L174 9 L172 14 L157 21.5 Z')}
    <path d="M171 14 L176 19" stroke="#111827" stroke-width="1.5"/><rect x="172" y="18" width="6" height="5" rx="1" fill="#e5e7eb" transform="rotate(20 175 20)"/>
    <path d="M73 11 L84 9" stroke="#e5e7eb" stroke-width="2.4" stroke-linecap="round"/>
    ${pz('M60 12 L75 8 L79 21 L70 31 Q59 29 57 20 Z')}
    <path d="M63 11.5 L73 9 L75 13 L64 15.5 Z" fill="#94a3b8" opacity=".6"/>
    <path d="M60 18 L67 16.5 L68 24 L61 25 Z" fill="#fef3c7"/></svg>`;
}

/* ---------- Graphiques SVG ---------- */
function lineChart(pts, o = {}){
  if (pts.length < 2) return '<p class="hint">Il faut au moins 2 valeurs pour tracer la courbe.</p>';
  const W = 340, H = 140, pl = 30, pr = 8, pt = 10, pb = 20, c = o.color || 'var(--a1)';
  const ys = pts.map(p => p.y).concat(o.ref ? [o.ref] : []); let mn = Math.min(...ys), mx = Math.max(...ys); if (mx - mn < 1e-6){ mn -= 1; mx += 1; } const pad = (mx - mn) * .15; mn -= pad; mx += pad;
  const X = i => pl + i * (W - pl - pr) / (pts.length - 1), Y = y => pt + (1 - (y - mn) / (mx - mn)) * (H - pt - pb);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' ');
  const area = d + ` L${X(pts.length - 1).toFixed(1)} ${H - pb} L${pl} ${H - pb} Z`, gid = 'lc' + Math.random().toString(36).slice(2, 7);
  const ticks = [mn + pad, (mn + mx) / 2, mx - pad].map(v => `<text x="${pl - 4}" y="${Y(v) + 3}" text-anchor="end">${nf(v, o.dec ?? 1)}</text><line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="#ffffff" stroke-opacity=".06"/>`).join('');
  const step = Math.max(1, Math.ceil(pts.length / 5));
  const labs = pts.map((p, i) => (i % step === 0 || i === pts.length - 1) ? `<text x="${X(i)}" y="${H - 5}" text-anchor="middle">${esc(p.x)}</text>` : '').join('');
  const ref = o.ref ? `<line x1="${pl}" x2="${W - pr}" y1="${Y(o.ref)}" y2="${Y(o.ref)}" stroke="#fbbf24" stroke-dasharray="4 4" stroke-opacity=".7"/>` : '';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".35"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs>${ticks}${ref}<path d="${area}" fill="url(#${gid})"/><path d="${d}" stroke="${c}" stroke-width="2.4" fill="none" stroke-linejoin="round" stroke-linecap="round"/>${pts.map((p, i) => `<circle cx="${X(i)}" cy="${Y(p.y)}" r="3" fill="${c}"/>`).join('')}${labs}</svg>`;
}
function barChart(rows, series){
  const W = 340, H = 150, pl = 34, pb = 20, pt = 12, mx = Math.max(1, ...rows.map(r => sum(series, s => r[s.k] || 0)));
  const bw = (W - pl - 6) / rows.length;
  const Y = v => pt + (1 - v / mx) * (H - pt - pb);
  let g = [mx, mx / 2].map(v => `<text x="${pl - 4}" y="${Y(v) + 3}" text-anchor="end">${nf(v, 0)}</text><line x1="${pl}" x2="${W}" y1="${Y(v)}" y2="${Y(v)}" stroke="#fff" stroke-opacity=".06"/>`).join('');
  rows.forEach((r, i) => {
    let base = 0; const x = pl + i * bw + bw * .18, w = bw * .64;
    series.forEach(s => { const v = r[s.k] || 0; if (v > 0){ g += `<rect x="${x.toFixed(1)}" y="${Y(base + v).toFixed(1)}" width="${w.toFixed(1)}" height="${(Y(base) - Y(base + v)).toFixed(1)}" rx="3" fill="${s.c}"/>`; base += v; } });
    g += `<text x="${(x + w / 2).toFixed(1)}" y="${H - 5}" text-anchor="middle">${esc(r.lab)}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${g}</svg><div class="legend">${series.map(s => `<span><i style="background:${s.c}"></i>${s.n}</span>`).join('')}</div>`;
}
function monthsRows(vid, n = 12){
  const rows = [];
  for (let i = n - 1; i >= 0; i--){
    const a = monthStart(-i), b = addDays(monthStart(-i + 1), -1);
    rows.push({ lab: pd(a).toLocaleDateString('fr-FR', { month:'short' }).replace('.', '').slice(0, 4), f: spend(fuelsOf(vid), a, b), m: spend(maintOf(vid), a, b) });
  }
  return rows;
}

/* ---------- Navigation ---------- */
let view = 'home', sel = 'all', vcur = null, vtab = 'apercu';
function go(v, opts = {}){ view = v; if (opts.vid) vcur = opts.vid; if (opts.tab) vtab = opts.tab; render(); window.scrollTo({ top:0, behavior:'instant' }); if (v === 'vehicle') history.pushState({ v:'vehicle' }, ''); }
let ignorePop = false;
window.addEventListener('popstate', () => { if (ignorePop){ ignorePop = false; return; } if ($('#sheet').classList.contains('on')){ closeSheet(true); return; } if (view === 'vehicle' || view === 'settings'){ view = 'home'; render(); } });

function render(){
  $$('.nav [data-nav]').forEach(b => b.classList.toggle('on', b.dataset.nav === view || (view === 'vehicle' && b.dataset.nav === 'home')));
  const V = { home:viewHome, fuel:viewFuel, maint:viewMaint, ai:viewAI, vehicle:viewVehicle, settings:viewSettings }[view] || viewHome;
  $('#app').innerHTML = `<div class="fade">${V()}</div>`;
  loadThumbs();
}
const vstyle = v => `style="--vc:${v.color}"`;
function chipsHTML(){
  return `<div class="chips"><button class="chip ${sel === 'all' ? 'on' : ''}" data-x="sel" data-v="all">🚘 Tous</button>${S.vehicles.map(v => `<button class="chip ${sel === v.id ? 'on' : ''}" ${vstyle(v)} data-x="sel" data-v="${v.id}"><i></i>${esc(v.nom)}</button>`).join('')}</div>`;
}

/* ---------- Écran Garage ---------- */
function viewHome(){
  const m0 = monthStart(0), y0 = today().slice(0, 4) + '-01-01';
  const fm = spend(S.fuels, m0), mm = spend(S.maint, m0), lm = sum(S.fuels.filter(f => f.d >= m0), f => f.l || 0);
  const prevA = monthStart(-1), prevB = addDays(m0, -1), prev = spend(S.fuels, prevA, prevB) + spend(S.maint, prevA, prevB);
  const tot = fm + mm, dv = prev > 0 ? (tot - prev) / prev : null;
  const year = spend(S.fuels, y0) + spend(S.maint, y0);
  const ins = insights().slice(0, 3);
  const setup = !S.setup ? `<div class="card" style="margin-top:14px;border-color:#3b4a7a;background:linear-gradient(135deg,rgba(56,189,248,.12),rgba(129,140,248,.12))">
      <b style="font-size:16px">👋 Bienvenue dans ton garage</b>
      <p class="soft" style="font-size:13.5px;margin:6px 0 10px;line-height:1.45">Tes 3 véhicules sont prêts avec leur fiche technique et leur plan d'entretien. Vérifie pour chacun la <b>motorisation exacte</b> et le <b>kilométrage actuel</b>.</p>
      <div class="row">${S.vehicles.map(v => `<button class="btn sm" ${vstyle(v)} data-x="vedit" data-v="${v.id}">${v.done ? '✅' : '⚙️'} ${esc(v.nom.split(' ').slice(-2).join(' '))}</button>`).join('')}<span class="spacer"></span><button class="btn sm" data-x="setupdone">C’est bon</button></div></div>` : '';
  return `${setup}
  <section class="hero">
    <div class="lbl">Dépenses · ${fmtMo(today()).split(' ')[0].toLowerCase()}</div>
    <div class="big num">${nf(tot, 2)}<small> €</small></div>
    <div class="sub">${dv == null ? 'Tous véhicules confondus' : `<span class="delta ${dv > 0 ? 'warn' : 'ok'}">${dv > 0 ? '▲' : '▼'} ${nf(Math.abs(dv) * 100)} %</span> vs mois dernier`}</div>
    <div class="kpis">
      <div class="kpi"><b class="num">${eur(fm, 0)}</b><span>⛽ Carburant</span></div>
      <div class="kpi"><b class="num">${eur(mm, 0)}</b><span>🔧 Entretien</span></div>
      <div class="kpi"><b class="num">${nf(lm, 0)} L</b><span>Litres ce mois</span></div>
    </div>
    <div class="hint" style="margin-top:10px">Depuis le 1er janvier : <b class="soft">${eur(year, 0)}</b></div>
  </section>
  <h2 class="sec">Mes véhicules<span class="spacer"></span><button data-x="vnew">＋ Ajouter</button></h2>
  <div class="vlist">${S.vehicles.map(vehicleCard).join('')}</div>
  ${ins.length ? `<h2 class="sec">✨ Conseils du moment<span class="spacer"></span><button data-nav="ai">Tout voir</button></h2>${ins.map(insHTML).join('')}` : ''}
  ${recentHTML()}`;
}
function vehicleCard(v){
  const st = maintStatus(v), ko = st.filter(x => x.state === 'ko').length, wa = st.filter(x => x.state === 'warn').length;
  const next = st.filter(x => x.state !== 'unk').sort((a, b) => (a.pred || '9') < (b.pred || '9') ? -1 : 1)[0];
  const avg = avgConso(v.id), ck = curKm(v), y = spend(fuelsOf(v.id), addDays(today(), -365)) + spend(maintOf(v.id), addDays(today(), -365));
  const badge = ko ? `<span class="badge ko">⛔ ${ko} en retard</span>` : wa ? `<span class="badge warn">⚠️ ${wa} bientôt</span>` : `<span class="badge ok">✓ À jour</span>`;
  return `<button class="vcard" ${vstyle(v)} data-x="vopen" data-v="${v.id}">
    <div class="vh"><div class="vt"><b>${esc(v.nom)}</b><small>${esc(variantOf(v).nom)}${v.docs.immat ? ' · ' + esc(v.docs.immat) : ''}</small><div style="margin-top:8px">${badge}</div></div>${sil(v)}</div>
    <div class="vs"><div><b class="num">${ck ? nf(ck) : '–'}</b><span>km</span></div><div><b class="num">${avg ? nf(avg, 1) : '–'}</b><span>L/100</span></div><div><b class="num">${eur(y, 0)}</b><span>sur 12 mois</span></div></div>
    ${next ? `<div class="vn">${next.ic} <span>Prochain : <b>${esc(next.nom)}</b> ${next.state === 'ko' ? '· <b class="ko">en retard</b>' : next.pred ? '· vers ' + fmtDs(next.pred) : ''}</span></div>` : ''}
  </button>`;
}
function insHTML(i){
  return `<button class="ins ${i.lv}" style="width:100%;text-align:left;${i.v ? '--vc:' + i.v.color : ''}" ${i.act ? `data-x="insact" data-a="${i.act}" data-v="${i.v ? i.v.id : ''}" data-i="${i.item || ''}"` : ''}><span class="e">${i.e}</span><div>${i.v ? `<span class="vtag">${esc(i.v.nom)}</span>` : ''}<b>${esc(i.t)}</b><p>${esc(i.p)}</p></div></button>`;
}
function recentHTML(){
  const L = [...S.fuels.map(f => Object.assign({ k:'f' }, f)), ...S.maint.map(m => Object.assign({ k:'m' }, m))].sort((a, b) => sortD(b, a)).slice(0, 5);
  if (!L.length) return `<div class="card" style="margin-top:22px"><div class="empty"><div class="e">📷</div><b>Scanne ton premier ticket</b><p>Touche le bouton <b>＋</b> puis « Scanner un ticket » : montant, litres et prix se remplissent tout seuls.</p></div></div>`;
  const cm = consoMap();
  return `<h2 class="sec">Activité récente</h2><div class="list">${L.map(x => x.k === 'f' ? fuelItem(x, cm) : maintItem(x)).join('')}</div>`;
}
function fuelItem(f, cm){
  const v = vById(f.vid) || { color:'#64748b', nom:'?' }, c = cm[f.id];
  return `<button class="item" ${vstyle(v)} data-x="fedit" data-id="${f.id}"><span class="ic">⛽</span><div class="tx"><b>${nf(f.l, 2)} L · ${esc(f.carb || '')}</b><small>${esc(v.nom)} · ${fmtDs(f.d)}${ok(f.km) ? ' · ' + nf(f.km) + ' km' : ''}${f.station ? ' · ' + esc(f.station) : ''}${f.full ? '' : ' · partiel'}</small></div>${f.photo ? `<img class="thumb" data-photo="${f.id}" hidden alt="">` : ''}<div class="rt"><b class="num">${eur(f.eur)}</b><small>${ok(f.pu) ? nf(f.pu, 3) + ' €/L' : ''}${c ? ' · ' + nf(c.c, 1) + ' L/100' : ''}</small></div></button>`;
}
function maintItem(m){
  const v = vById(m.vid) || { color:'#64748b', nom:'?', plan:[] };
  const names = (m.items || []).map(id => (v.plan.find(p => p.id === id) || {}).nom).filter(Boolean);
  const ic = ((v.plan.find(p => p.id === (m.items || [])[0]) || {}).ic) || '🔧';
  return `<button class="item" ${vstyle(v)} data-x="medit" data-id="${m.id}"><span class="ic">${ic}</span><div class="tx"><b>${esc(m.titre || names[0] || 'Entretien')}</b><small>${esc(v.nom)} · ${fmtDs(m.d)}${ok(m.km) ? ' · ' + nf(m.km) + ' km' : ''}${m.garage ? ' · ' + esc(m.garage) : ''}${names.length > 1 ? ' · ' + names.length + ' opérations' : ''}</small></div>${m.photo ? `<img class="thumb" data-photo="${m.id}" hidden alt="">` : ''}<div class="rt"><b class="num">${ok(m.eur) ? eur(m.eur) : '–'}</b><small>${m.diy ? 'Fait maison' : ''}</small></div></button>`;
}
function groupMonths(list, fn, tot){
  let out = '', cur = '';
  list.forEach(x => { const k = x.d.slice(0, 7); if (k !== cur){ cur = k; const t = sum(list.filter(y => y.d.slice(0, 7) === k), y => y.eur || 0); out += `<div class="month"><span>${fmtMo(x.d)}</span><span class="num">${eur(t)}</span></div>`; } out += fn(x); });
  return out;
}

/* ---------- Écran Pleins ---------- */
function viewFuel(){
  const F = fuelsOf(sel).sort((a, b) => sortD(b, a)), cm = consoMap();
  const y = addDays(today(), -365), F12 = F.filter(f => f.d >= y);
  const L = sum(F12, f => f.l || 0), E = sum(F12, f => f.eur || 0);
  const avg = sel !== 'all' ? avgConso(sel) : null;
  const pu = L > 0 ? E / L : null, v = vById(sel);
  const cpk = sel !== 'all' && avg && pu ? avg / 100 * pu : null;
  let charts = '';
  if (sel !== 'all'){
    const ser = consoSeries(sel).slice(-15);
    charts = `<div class="card" style="margin-top:12px"><b>Consommation par plein</b><span class="hint"> · ligne jaune : constructeur</span>${lineChart(ser.map(s => ({ x:fmtDs(s.d), y:s.c })), { color:v.color, ref:v.conso })}</div>`;
  }
  const pts = F.filter(f => ok(f.pu)).slice(0, 15).reverse();
  if (pts.length >= 2) charts += `<div class="card"><b>Prix du litre</b>${lineChart(pts.map(f => ({ x:fmtDs(f.d), y:f.pu })), { color:'#38bdf8', dec:3 })}</div>`;
  return `${chipsHTML()}
  <div class="grid2" style="margin-top:8px">
    <div class="card"><div class="muted" style="font-size:12px;font-weight:700">CARBURANT · 12 MOIS</div><div style="font-size:26px;font-weight:900" class="num">${eur(E, 0)}</div><div class="hint">${nf(L, 0)} L · ${F12.length} plein${F12.length > 1 ? 's' : ''}</div></div>
    <div class="card"><div class="muted" style="font-size:12px;font-weight:700">${sel === 'all' ? 'PRIX MOYEN' : 'CONSO MOYENNE'}</div><div style="font-size:26px;font-weight:900" class="num">${sel === 'all' ? (pu ? nf(pu, 3) + ' €' : '–') : (avg ? nf(avg, 1) : '–')}</div><div class="hint">${sel === 'all' ? 'par litre' : 'L/100 km' + (cpk ? ' · ' + nf(cpk, 3) + ' €/km' : '')}</div></div>
  </div>
  ${charts}
  <div class="row" style="margin-top:14px"><button class="btn pri" style="flex:1" data-x="scan" data-k="fuel">📷 Scanner un ticket</button><button class="btn" style="flex:1" data-x="fuel">✍️ Saisir un plein</button></div>
  <h2 class="sec">Historique des pleins</h2>
  ${F.length ? `<div class="list">${groupMonths(F, f => fuelItem(f, cm))}</div>` : `<div class="card"><div class="empty"><div class="e">⛽</div><b>Aucun plein pour l’instant</b><p>Astuce : fais toujours le plein complet et note le compteur, l’appli calcule alors ta consommation réelle.</p></div></div>`}`;
}

/* ---------- Écran Entretien ---------- */
function viewMaint(){
  const vs = S.vehicles.filter(v => sel === 'all' || v.id === sel);
  const todo = [].concat(...vs.map(maintStatus)).filter(x => x.state !== 'ok').sort((a, b) => ORDER[a.state] - ORDER[b.state] || (a.pred || '9').localeCompare(b.pred || '9'));
  const soon = [].concat(...vs.map(maintStatus)).filter(x => x.state === 'ok').sort((a, b) => (a.pred || '9').localeCompare(b.pred || '9')).slice(0, 4);
  const M = maintOf(sel).sort((a, b) => sortD(b, a)), y = addDays(today(), -365);
  const ty = sum(M.filter(m => m.d >= y), m => m.eur || 0);
  return `${chipsHTML()}
  <div class="grid2" style="margin-top:8px">
    <div class="card"><div class="muted" style="font-size:12px;font-weight:700">ENTRETIEN · 12 MOIS</div><div style="font-size:26px;font-weight:900" class="num">${eur(ty, 0)}</div><div class="hint">${M.length} intervention${M.length > 1 ? 's' : ''} au total</div></div>
    <div class="card"><div class="muted" style="font-size:12px;font-weight:700">À SURVEILLER</div><div style="font-size:26px;font-weight:900" class="num">${todo.filter(x => x.state !== 'unk').length}</div><div class="hint">${todo.filter(x => x.state === 'ko').length} en retard · ${todo.filter(x => x.state === 'unk').length} à renseigner</div></div>
  </div>
  <div class="row" style="margin-top:14px"><button class="btn pri" style="flex:1" data-x="maint">🔧 Ajouter un entretien</button><button class="btn" style="flex:1" data-x="scan" data-k="maint">📷 Scanner une facture</button></div>
  <h2 class="sec">À prévoir</h2>
  ${todo.length ? todo.slice(0, 14).map(mtHTML).join('') : '<div class="card"><div class="empty"><div class="e">✅</div><b>Tout est à jour</b></div></div>'}
  ${soon.length ? `<h2 class="sec">Prochaines échéances</h2>${soon.map(mtHTML).join('')}` : ''}
  <h2 class="sec">Carnet d’entretien</h2>
  ${M.length ? `<div class="list">${groupMonths(M, maintItem)}</div>` : '<div class="card"><div class="empty"><div class="e">📒</div><b>Carnet vide</b><p>Ajoute tes interventions passées (même approximatives) pour que les prévisions soient justes.</p></div></div>'}`;
}
function mtHTML(x){
  const pct = Math.min(1, Math.max(.03, x.pct || 0));
  return `<button class="mt ${x.state}" ${vstyle(x.v)} data-x="item" data-v="${x.v.id}" data-i="${x.id}">
    <div class="h"><span class="e">${x.ic}</span><b>${esc(x.nom)}</b>${sel === 'all' || view !== 'maint' ? `<span class="badge" style="color:${x.v.color}">${esc(x.v.nom.split(' ').pop())}</span>` : ''}</div>
    <div class="bar"><i style="width:${(pct * 100).toFixed(0)}%"></i></div>
    <div class="d"><span>${esc(x.txt)}</span>${x.pred && x.state !== 'unk' ? `<span>📅 ~ ${fmtD(x.pred)}</span>` : ''}</div></button>`;
}

/* ---------- Écran véhicule ---------- */
function viewVehicle(){
  const v = vById(vcur); if (!v){ view = 'home'; return viewHome(); }
  const tabs = [['apercu', 'Aperçu'], ['plan', 'Entretien'], ['fiche', 'Fiche technique'], ['docs', 'Papiers']];
  let body = '';
  if (vtab === 'apercu') body = vOverview(v);
  if (vtab === 'plan') body = `<div class="row" style="margin-top:14px"><button class="btn pri" style="flex:1" data-x="maint" data-v="${v.id}">🔧 Ajouter</button><button class="btn" style="flex:1" data-x="planadd" data-v="${v.id}">＋ Élément du plan</button></div><h2 class="sec">Plan d’entretien</h2>${maintStatus(v).sort((a, b) => ORDER[a.state] - ORDER[b.state]).map(mtHTML).join('')}<h2 class="sec">Historique</h2>${maintOf(v.id).length ? `<div class="list">${groupMonths(maintOf(v.id).sort((a, b) => sortD(b, a)), maintItem)}</div>` : '<p class="hint">Aucune intervention enregistrée.</p>'}`;
  if (vtab === 'fiche'){
    const V = variantOf(v);
    body = `<div class="card" style="margin-top:14px"><b>${esc(V.nom)}</b><div class="hint">${esc(V.annees || '')} · valeurs « ≈ » à confirmer dans ton carnet</div></div>` + V.specs.map(([t, rows]) => `<div class="card spec"><h3>${esc(t)}</h3><dl>${rows.map(([k, val]) => `<dt>${esc(k)}</dt><dd>${esc(val)}</dd>`).join('')}</dl></div>`).join('') + `<div class="card spec"><h3>Mes réglages</h3><dl><dt>Réservoir</dt><dd>${nf(v.reservoir)} L</dd><dt>Conso constructeur</dt><dd>${nf(v.conso, 1)} L/100</dd><dt>Autonomie théorique</dt><dd>≈ ${kmf(v.reservoir / v.conso * 100)}</dd><dt>Carburant habituel</dt><dd>${esc(v.carb)}</dd></dl></div>${v.docs.notes ? `<div class="card"><b>Notes</b><p class="soft" style="white-space:pre-wrap;margin-top:6px">${esc(v.docs.notes)}</p></div>` : ''}`;
  }
  if (vtab === 'docs'){
    const D = v.docs, row = (k, n, val) => `<dt>${n}</dt><dd>${val ? esc(val) : '<span class="muted">–</span>'}</dd>`;
    body = `<div class="card spec" style="margin-top:14px"><h3>Papiers du véhicule</h3><dl>${row('immat', 'Immatriculation', D.immat)}${row('vin', 'N° de série (VIN)', D.vin)}${row('ct', 'Prochain contrôle technique', D.ct && fmtD(D.ct))}${row('assu', 'Échéance assurance', D.assu && fmtD(D.assu))}${row('assureur', 'Assureur', D.assureur)}${row('achat', 'Date d’achat', D.achat && fmtD(D.achat))}</dl><button class="btn block" style="margin-top:14px" data-x="vedit" data-v="${v.id}">✏️ Modifier</button></div>`;
  }
  return `<section class="vhero" ${vstyle(v)}>
    <button class="back" data-nav="home">‹ Garage</button>
    <div class="row"><div style="flex:1;min-width:0"><h2>${esc(v.nom)}</h2><div class="muted" style="font-size:13px">${esc(variantOf(v).nom)}</div></div><button class="btn sm" data-x="vedit" data-v="${v.id}">✏️</button></div>
    ${sil(v)}
    <div class="kpis"><div class="kpi"><b class="num">${nf(curKm(v))}</b><span>km au compteur</span></div><div class="kpi"><b class="num">${nf(kmRate(v) * 30.4, 0)}</b><span>km / mois</span></div><div class="kpi"><b class="num">${avgConso(v.id) ? nf(avgConso(v.id), 1) : '–'}</b><span>L/100 réel</span></div></div>
    <div class="row" style="margin-top:12px"><button class="btn sm" data-x="fuel" data-v="${v.id}">⛽ Plein</button><button class="btn sm" data-x="scan" data-k="fuel" data-v="${v.id}">📷 Ticket</button><button class="btn sm" data-x="kmlog" data-v="${v.id}">📏 Relevé km</button><button class="btn sm" data-x="ask" data-v="${v.id}">🤖 Mécano IA</button></div>
  </section>
  <div class="tabs">${tabs.map(([k, n]) => `<button class="${vtab === k ? 'on' : ''}" data-x="vtab" data-t="${k}">${n}</button>`).join('')}</div>${body}`;
}
function vOverview(v){
  const F = fuelsOf(v.id), M = maintOf(v.id), y = addDays(today(), -365);
  const ser = consoSeries(v.id), avg = avgConso(v.id, ser), tk = trackedKm(v.id);
  const fE = sum(F, f => f.eur || 0), mE = sum(M, m => m.eur || 0), L = sum(F, f => f.l || 0);
  const pu = L ? sum(F.filter(f => ok(f.pu)), f => f.eur || 0) / sum(F.filter(f => ok(f.pu)), f => f.l || 0) : null;
  const fk = tk > 0 && avg && pu ? avg / 100 * pu : null;
  const allk = tk > 0 ? (spend(F) + spend(M.filter(m => F.length && m.d >= F.slice().sort(sortD)[0].d))) / tk : null;
  const auto = avg ? v.reservoir / avg * 100 : v.reservoir / v.conso * 100;
  const proj = kmRate(v) * 365 * (avg || v.conso) / 100 * (pu || 1.8);
  const ins = insights(v.id).slice(0, 4);
  return `<div class="grid3" style="margin-top:14px">
    <div class="card"><div class="hint" style="margin:0">Carburant / km</div><b class="num" style="font-size:19px">${fk ? nf(fk, 3) + ' €' : '–'}</b></div>
    <div class="card"><div class="hint" style="margin:0">Coût total / km</div><b class="num" style="font-size:19px">${allk ? nf(allk, 3) + ' €' : '–'}</b></div>
    <div class="card"><div class="hint" style="margin:0">Autonomie</div><b class="num" style="font-size:19px">≈ ${nf(auto, 0)} km</b></div>
    <div class="card"><div class="hint" style="margin:0">Dépensé 12 mois</div><b class="num" style="font-size:19px">${eur(spend(F, y) + spend(M, y), 0)}</b></div>
    <div class="card"><div class="hint" style="margin:0">Budget carburant / an</div><b class="num" style="font-size:19px">≈ ${eur(proj, 0)}</b></div>
    <div class="card"><div class="hint" style="margin:0">Dernière conso</div><b class="num" style="font-size:19px">${ser.length ? nf(ser[ser.length - 1].c, 1) : '–'}</b></div>
  </div>
  ${ins.length ? `<h2 class="sec">✨ Conseils</h2>${ins.map(insHTML).join('')}` : ''}
  <h2 class="sec">Graphiques</h2>
  <div class="card"><b>Dépenses par mois</b>${barChart(monthsRows(v.id), [{ k:'f', n:'Carburant', c:v.color }, { k:'m', n:'Entretien', c:'#818cf8' }])}</div>
  <div class="card"><b>Consommation (L/100 km)</b><span class="hint"> · ligne jaune : ${nf(v.conso, 1)} constructeur</span>${lineChart(ser.slice(-15).map(s => ({ x:fmtDs(s.d), y:s.c })), { color:v.color, ref:v.conso })}</div>
  <h2 class="sec">Total depuis le début</h2>
  <div class="card spec"><dl><dt>Carburant</dt><dd>${eur(fE)} · ${nf(L, 1)} L</dd><dt>Entretien</dt><dd>${eur(mE)}</dd><dt>Prix moyen du litre</dt><dd>${pu ? nf(pu, 3) + ' €' : '–'}</dd><dt>Distance suivie</dt><dd>${kmf(tk)}</dd><dt>Nombre de pleins</dt><dd>${F.length}</dd></dl></div>`;
}

/* ---------- Écran Conseils ---------- */
function viewAI(){
  const ins = insights(sel === 'all' ? null : sel);
  const key = safeGet(KEY_AI, '');
  return `${chipsHTML()}
  <div class="card" style="margin-top:8px;background:linear-gradient(135deg,rgba(129,140,248,.18),rgba(56,189,248,.1));border-color:#3b4a7a">
    <div class="row"><span style="font-size:30px">🤖</span><div style="flex:1;min-width:200px"><b style="font-size:16px">Mécano IA</b><p class="soft" style="font-size:13px;margin-top:2px">Pose une question sur ${sel === 'all' ? 'tes véhicules' : esc(vById(sel).nom)} : il connaît ta fiche technique, ton historique et tes consommations.</p></div></div>
    ${key ? `<div class="pick" style="margin-top:10px">${['Quel entretien prévoir avant l’été ?', 'Ma consommation est-elle normale ?', 'Quelle huile acheter et combien ?', 'Bruit au freinage, que vérifier ?'].map(q => `<button class="badge ai" data-x="ask" data-v="${sel === 'all' ? '' : sel}" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    <button class="btn pri block" style="margin-top:12px" data-x="ask" data-v="${sel === 'all' ? '' : sel}">Poser ma question</button>` : `<p class="hint" style="margin-top:8px">Ajoute une clé API Claude dans les réglages pour activer le mécano IA et la lecture parfaite des tickets.</p><button class="btn block" style="margin-top:10px" data-nav="settings">⚙️ Réglages</button>`}
  </div>
  <h2 class="sec">Analyse automatique</h2>
  ${ins.length ? ins.map(insHTML).join('') : '<div class="card"><div class="empty"><div class="e">🎉</div><b>Rien à signaler</b><p>Tes véhicules sont à jour.</p></div></div>'}`;
}

/* ---------- Réglages ---------- */
function viewSettings(){
  const key = safeGet(KEY_AI, ''), model = safeGet(KEY_MODEL, 'claude-opus-5-5');
  return `<h2 class="sec">Sauvegarde</h2>
  <div class="card"><div class="row"><span style="font-size:26px">☁️</span><div style="flex:1"><b>${db ? (remoteOk ? 'Synchronisée en ligne' : 'Connexion en cours…') : 'Sur cet appareil uniquement'}</b><p class="hint" style="margin:2px 0 0">Même base Firebase que l’appli Mon Programme : tes données suivent sur téléphone et ordinateur. Les photos des tickets restent sur l’appareil.</p></div></div>
  <div class="row" style="margin-top:12px"><button class="btn sm" data-x="export">⬇️ Sauvegarde (.json)</button><button class="btn sm" data-x="csv">📊 Export tableur (.csv)</button><button class="btn sm" data-x="import">⬆️ Restaurer</button></div></div>
  <h2 class="sec">Intelligence artificielle (optionnel)</h2>
  <div class="card"><p class="soft" style="font-size:13.5px;line-height:1.45">Sans clé, les tickets sont lus directement sur ton téléphone (gratuit, un peu moins précis). Avec une clé API Claude, la lecture est quasi parfaite et le mécano IA répond à tes questions. La clé reste sur cet appareil.</p>
  <label class="fld"><span>Clé API Claude</span><input class="inp" id="aiKey" type="password" placeholder="sk-ant-…" value="${esc(key)}" autocomplete="off"></label>
  <label class="fld"><span>Modèle</span><select class="inp" id="aiModel"><option value="claude-opus-5-5" ${model === 'claude-opus-5-5' ? 'selected' : ''}>Claude Opus 5.5 (le plus précis)</option><option value="claude-sonnet-5-5" ${model === 'claude-sonnet-5-5' ? 'selected' : ''}>Claude Sonnet 5.5 (équilibré)</option><option value="claude-haiku-5-5" ${model === 'claude-haiku-5-5' ? 'selected' : ''}>Claude Haiku 5.5 (le moins cher)</option></select></label>
  <p class="hint">Clé à créer sur console.anthropic.com · un ticket coûte moins d’un centime.</p>
  <button class="btn pri block" style="margin-top:12px" data-x="savekey">💾 Enregistrer</button></div>
  <h2 class="sec">Véhicules</h2>
  <div class="list">${S.vehicles.map(v => `<button class="item" ${vstyle(v)} data-x="vedit" data-v="${v.id}"><span class="ic">${typeOf(v) === 'moto' ? '🏍️' : typeOf(v) === 'van' ? '🚐' : '🚗'}</span><div class="tx"><b>${esc(v.nom)}</b><small>${esc(variantOf(v).nom)}</small></div><span class="muted">›</span></button>`).join('')}</div>
  <button class="btn block" style="margin-top:10px" data-x="vnew">＋ Ajouter un véhicule</button>
  <h2 class="sec">Zone sensible</h2>
  <button class="btn danger block" data-x="reset">🗑️ Tout effacer</button>
  <p class="hint" style="text-align:center;margin:18px 0">Mon Garage · données : ${S.fuels.length} pleins, ${S.maint.length} entretiens</p>`;
}

/* ---------- Panneau du bas ---------- */
function openSheet(html){ $('#sheet').innerHTML = '<div class="grab"></div>' + html; $('#sheet').classList.add('on'); $('#ov').classList.add('on'); $('#sheet').scrollTop = 0; history.pushState({ sheet:1 }, ''); }
function closeSheet(fromPop){ if (!$('#sheet').classList.contains('on')) return; $('#sheet').classList.remove('on'); $('#ov').classList.remove('on'); if (!fromPop){ ignorePop = true; history.back(); } }
$('#ov').onclick = () => closeSheet();
let toastT; function toast(t){ const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 2600); }
function confirmSheet(msg, okTxt, fn){ openSheet(`<h2>${msg}</h2><div class="row" style="margin-top:16px"><button class="btn" style="flex:1" data-x="close">Annuler</button><button class="btn pri" style="flex:1" id="cfOk">${okTxt}</button></div>`); $('#cfOk').onclick = () => { closeSheet(); setTimeout(fn, 50); }; }
const vPick = (name, cur) => `<div class="pick">${S.vehicles.map(v => `<label ${vstyle(v)}><input type="radio" name="${name}" value="${v.id}" ${cur === v.id ? 'checked' : ''}><span>${typeOf(v) === 'moto' ? '🏍️' : typeOf(v) === 'van' ? '🚐' : '🚗'} ${esc(v.nom)}</span></label>`).join('')}</div>`;
const defVid = vid => vid || (sel !== 'all' ? sel : view === 'vehicle' ? vcur : S.vehicles[0] && S.vehicles[0].id);

function addMenu(){
  openSheet(`<h2>Ajouter</h2><div class="actions">
    <button class="action" data-x="scan" data-k="fuel"><span class="e">📷</span><div><b>Scanner un ticket d’essence</b><small>Montant, litres et prix remplis automatiquement</small></div></button>
    <button class="action" data-x="fuel"><span class="e">⛽</span><div><b>Saisir un plein</b><small>Litres, montant et kilométrage</small></div></button>
    <button class="action" data-x="maint"><span class="e">🔧</span><div><b>Entretien / réparation</b><small>Vidange, pneus, freins, chaîne…</small></div></button>
    <button class="action" data-x="scan" data-k="maint"><span class="e">🧾</span><div><b>Scanner une facture de garage</b><small>Montant, date et travaux détectés</small></div></button>
    <button class="action" data-x="kmlog"><span class="e">📏</span><div><b>Relevé kilométrique</b><small>Mettre à jour le compteur pour des prévisions justes</small></div></button>
  </div>`);
}

/* ---------- Formulaire : plein ---------- */
let fState = null;
function fuelForm(f, pre = {}){
  const isNew = !f, { photo:_p, ai:_a, src:_s, ...data } = pre; f = f || Object.assign({ id:uid(), d:today(), full:true }, data, { vid:defVid(pre.vid) });
  const v = vById(f.vid) || S.vehicles[0];
  fState = { f, isNew, order:[], photo:pre.photo || null, ai:pre.ai || {} };
  const stations = [...new Set(S.fuels.map(x => x.station).filter(Boolean).concat(STATIONS))];
  const aiC = k => fState.ai[k] ? ' ai' : '';
  openSheet(`<h2>${isNew ? (pre.photo ? '🧾 Ticket lu' : '⛽ Nouveau plein') : '⛽ Modifier le plein'}</h2>
  ${pre.photo ? `<div class="preview">✨ ${esc(pre.src || 'Lecture du ticket')} : vérifie les champs en violet et ajoute le <b>kilométrage</b>.</div><img class="photo" src="${pre.photo}" alt="ticket">` : (!isNew && f.photo ? `<img class="photo" data-photo="${f.id}" hidden alt="ticket">` : '')}
  <form id="ff">
    <div class="fld"><span>Véhicule</span>${vPick('vid', v.id)}</div>
    <label class="fld"><span>Kilométrage au compteur</span><div class="unit"><input class="inp big-inp" id="fKm" inputmode="numeric" placeholder="ex. 84 250" value="${ok(f.km) ? f.km : ''}"><em>km</em></div><p class="hint" id="kmHint"></p></label>
    <div class="grid3" style="gap:8px">
      <label class="fld"><span>Montant</span><div class="unit"><input class="inp${aiC('eur')}" id="fEur" inputmode="decimal" placeholder="0,00" value="${ok(f.eur) ? String(f.eur).replace('.', ',') : ''}"><em>€</em></div></label>
      <label class="fld"><span>Litres</span><div class="unit"><input class="inp${aiC('l')}" id="fL" inputmode="decimal" placeholder="0,00" value="${ok(f.l) ? String(f.l).replace('.', ',') : ''}"><em>L</em></div></label>
      <label class="fld"><span>Prix / L</span><div class="unit"><input class="inp${aiC('pu')}" id="fPu" inputmode="decimal" placeholder="0,000" value="${ok(f.pu) ? String(f.pu).replace('.', ',') : ''}"><em>€</em></div></label>
    </div>
    <p class="hint">Remplis deux valeurs, la troisième se calcule seule.</p>
    <div class="preview" id="fPrev" hidden></div>
    <label class="tog"><span>Plein complet <small class="muted">(nécessaire pour la conso)</small></span><input type="checkbox" id="fFull" ${f.full ? 'checked' : ''}><i class="sw"></i></label>
    <div class="grid2"><label class="fld"><span>Date</span><input class="inp${aiC('d')}" type="date" id="fD" value="${f.d}" max="${today()}"></label>
    <label class="fld"><span>Carburant</span><select class="inp${aiC('carb')}" id="fCarb">${FUELS.map(c => `<option ${c === (f.carb || v.carb) ? 'selected' : ''}>${c}</option>`).join('')}</select></label></div>
    <label class="fld"><span>Station</span><input class="inp${aiC('station')}" id="fSt" list="stl" placeholder="ex. E.Leclerc" value="${esc(f.station || '')}"><datalist id="stl">${stations.map(s => `<option value="${esc(s)}">`).join('')}</datalist></label>
    <label class="fld"><span>Note</span><input class="inp" id="fNote" placeholder="Autoroute, vacances, chargé…" value="${esc(f.note || '')}"></label>
    <div class="row" style="margin-top:18px">${isNew ? '' : '<button type="button" class="btn danger" id="fDel">🗑️</button>'}<span class="spacer"></span><button type="button" class="btn" data-x="close">Annuler</button><button class="btn pri" type="submit">✅ Enregistrer</button></div>
  </form>`);
  loadThumbs();
  const upd = () => fuelPreview();
  ['fEur', 'fL', 'fPu'].forEach(id => $('#' + id).addEventListener('input', () => { const o = fState.order.filter(x => x !== id); o.unshift(id); fState.order = o; autoCalc(id); upd(); }));
  ['fKm', 'fFull', 'fD'].forEach(id => $('#' + id).addEventListener('input', upd));
  $$('#ff [name=vid]').forEach(r => r.addEventListener('change', () => { const nv = vById(r.value); if (nv && !fState.ai.carb) $('#fCarb').value = nv.carb; upd(); }));
  $('#ff').onsubmit = ev => { ev.preventDefault(); saveFuel(); };
  if (!isNew) $('#fDel').onclick = () => confirmSheet('Supprimer ce plein ?', '🗑️ Supprimer', () => { S.fuels = S.fuels.filter(x => x.id !== f.id); idb.del(f.id); save(); render(); toast('Plein supprimé'); });
  upd();
  if (pre.photo) setTimeout(() => $('#fKm').focus(), 350);
}
function autoCalc(changed){
  const E = pnum($('#fEur').value), L = pnum($('#fL').value), P = pnum($('#fPu').value);
  const filled = { fEur:ok(E), fL:ok(L), fPu:ok(P) };
  const keep = fState.order.filter(k => filled[k]).slice(0, 2); if (keep.length < 2) return;
  const target = ['fEur', 'fL', 'fPu'].find(k => !keep.includes(k)), set = (id, v) => { $('#' + id).value = String(v).replace('.', ','); };
  if (target === 'fEur') set('fEur', r2(L * P).toFixed(2));
  if (target === 'fL' && P > 0) set('fL', r2(E / P).toFixed(2));
  if (target === 'fPu' && L > 0) set('fPu', r3(E / L).toFixed(3));
}
function fuelPreview(){
  const vid = ($('#ff [name=vid]:checked') || {}).value, v = vById(vid); if (!v) return;
  const K = pnum($('#fKm').value), L = pnum($('#fL').value), P = pnum($('#fPu').value), full = $('#fFull').checked;
  const others = S.fuels.filter(x => x.vid === vid && x.id !== fState.f.id && ok(x.km));
  const lastKm = curKm(v), prevF = others.filter(x => !ok(K) || x.km < K).sort((a, b) => b.km - a.km)[0];
  const hint = $('#kmHint'); hint.className = 'hint';
  if (ok(K) && fState.isNew && K < lastKm - 1){ hint.className = 'hint warn'; hint.textContent = '⚠️ Plus petit que le dernier relevé (' + nf(lastKm) + ' km). Vérifie le compteur.'; }
  else if (lastKm) hint.textContent = 'Dernier relevé : ' + nf(lastKm) + ' km' + (ok(K) && K > lastKm ? ' · +' + nf(K - lastKm) + ' km parcourus' : '');
  else hint.textContent = 'Premier relevé de ce véhicule.';
  const msgs = [];
  if (ok(L) && L > v.reservoir + 2) msgs.push('⚠️ ' + nf(L, 1) + ' L dépasse le réservoir (' + v.reservoir + ' L) : vérifie les litres.');
  if (ok(P) && (P < 1 || P > 3)) msgs.push('⚠️ Prix au litre inhabituel (' + nf(P, 3) + ' €).');
  if (ok(K) && ok(L) && full && prevF && prevF.full && K > prevF.km){
    const between = others.filter(x => x.km > prevF.km && x.km < K), Lt = L + sum(between, x => x.l || 0), c = Lt / (K - prevF.km) * 100, avg = avgConso(vid);
    msgs.push('📊 ≈ <b>' + nf(c, 1) + ' L/100 km</b> sur ' + kmf(K - prevF.km) + (avg ? ' (moyenne ' + nf(avg, 1) + ')' : '') + (ok(P) ? ' · ' + nf(c / 100 * P, 3) + ' €/km' : ''));
  } else if (ok(L) && full) msgs.push('💡 Autonomie théorique avec ce plein : ≈ ' + kmf(L / (avgConso(vid) || v.conso) * 100) + '.');
  const p = $('#fPrev'); p.hidden = !msgs.length; p.innerHTML = msgs.join('<br>');
}
function saveFuel(){
  const f = fState.f, vid = ($('#ff [name=vid]:checked') || {}).value;
  const K = pnum($('#fKm').value), E = pnum($('#fEur').value), L = pnum($('#fL').value); let P = pnum($('#fPu').value);
  if (!vid) return toast('Choisis un véhicule');
  if (!ok(E) || !ok(L) || L <= 0) return toast('Indique au moins le montant et les litres');
  if (!ok(P)) P = r3(E / L);
  Object.assign(f, { vid, km: ok(K) ? Math.round(K) : null, eur:r2(E), l:r2(L), pu:r3(P), full:$('#fFull').checked, d:$('#fD').value || today(), carb:$('#fCarb').value, station:$('#fSt').value.trim(), note:$('#fNote').value.trim() });
  if (fState.photo){ f.photo = true; idb.put(f.id, fState.photo); }
  if (fState.isNew) S.fuels.push(f);
  const cs = consoSeries(vid).find(s => s.id === f.id);
  save(); closeSheet(); render();
  toast(cs ? '⛽ Enregistré · ' + nf(cs.c, 1) + ' L/100 km' : '⛽ Plein enregistré');
}

/* ---------- Formulaire : entretien ---------- */
let mState = null;
function maintForm(m, pre = {}){
  const isNew = !m, { photo:_p, ai:_a, src:_s, ...data } = pre; m = m || Object.assign({ id:uid(), d:today(), items:[] }, data, { vid:defVid(pre.vid) });
  mState = { m, isNew, photo:pre.photo || null, ai:pre.ai || {} };
  const aiC = k => mState.ai[k] ? ' ai' : '';
  openSheet(`<h2>${isNew ? (pre.photo ? '🧾 Facture lue' : '🔧 Nouvel entretien') : '🔧 Modifier l’entretien'}</h2>
  ${pre.photo ? `<div class="preview">✨ ${esc(pre.src || 'Lecture de la facture')} : vérifie et complète.</div><img class="photo" src="${pre.photo}" alt="facture">` : (!isNew && m.photo ? `<img class="photo" data-photo="${m.id}" hidden alt="facture">` : '')}
  <form id="mf">
    <div class="fld"><span>Véhicule</span>${vPick('vid', m.vid)}</div>
    <div class="fld"><span>Opérations réalisées</span><div class="pick" id="mItems"></div></div>
    <label class="fld"><span>Intitulé</span><input class="inp${aiC('titre')}" id="mT" placeholder="ex. Révision des 60 000 km" value="${esc(m.titre || '')}"></label>
    <div class="grid2"><label class="fld"><span>Kilométrage</span><div class="unit"><input class="inp${aiC('km')}" id="mKm" inputmode="numeric" placeholder="km" value="${ok(m.km) ? m.km : ''}"><em>km</em></div></label>
    <label class="fld"><span>Coût total</span><div class="unit"><input class="inp${aiC('eur')}" id="mE" inputmode="decimal" placeholder="0,00" value="${ok(m.eur) ? String(m.eur).replace('.', ',') : ''}"><em>€</em></div></label></div>
    <div class="grid2"><label class="fld"><span>Date</span><input class="inp${aiC('d')}" type="date" id="mD" value="${m.d}" max="${today()}"></label>
    <label class="fld"><span>Garage</span><input class="inp${aiC('garage')}" id="mG" placeholder="ex. Norauto" value="${esc(m.garage || '')}"></label></div>
    <label class="tog"><span>Fait moi-même 🧰</span><input type="checkbox" id="mDiy" ${m.diy ? 'checked' : ''}><i class="sw"></i></label>
    <label class="fld"><span>Détail (pièces, références, quantités)</span><textarea class="inp${aiC('detail')}" id="mDet" placeholder="Huile 5W-30 4,5 L, filtre Purflux LS…">${esc(m.detail || '')}</textarea></label>
    <div class="row" style="margin-top:18px">${isNew ? '' : '<button type="button" class="btn danger" id="mDel">🗑️</button>'}<span class="spacer"></span><button type="button" class="btn" data-x="close">Annuler</button><button class="btn pri" type="submit">✅ Enregistrer</button></div>
  </form>`);
  loadThumbs();
  const fillItems = () => { const v = vById(($('#mf [name=vid]:checked') || {}).value) || S.vehicles[0]; $('#mItems').style.setProperty('--vc', v.color);
    $('#mItems').innerHTML = v.plan.map(p => `<label><input type="checkbox" value="${p.id}" ${(m.items || []).includes(p.id) ? 'checked' : ''}><span>${p.ic} ${esc(p.nom)}</span></label>`).join('');
    if (!ok(m.km) && isNew && !$('#mKm').value && curKm(v)) $('#mKm').placeholder = 'dernier : ' + nf(curKm(v)); };
  fillItems();
  $$('#mf [name=vid]').forEach(r => r.addEventListener('change', fillItems));
  $('#mf').onsubmit = ev => { ev.preventDefault(); saveMaint(); };
  if (!isNew) $('#mDel').onclick = () => confirmSheet('Supprimer cet entretien ?', '🗑️ Supprimer', () => { S.maint = S.maint.filter(x => x.id !== m.id); idb.del(m.id); save(); render(); toast('Entretien supprimé'); });
}
function saveMaint(){
  const m = mState.m, vid = ($('#mf [name=vid]:checked') || {}).value, K = pnum($('#mKm').value), E = pnum($('#mE').value);
  const items = $$('#mItems input:checked').map(i => i.value), titre = $('#mT').value.trim();
  if (!vid) return toast('Choisis un véhicule');
  if (!items.length && !titre) return toast('Coche une opération ou donne un intitulé');
  Object.assign(m, { vid, items, titre, km: ok(K) ? Math.round(K) : null, eur: ok(E) ? r2(E) : null, d:$('#mD').value || today(), garage:$('#mG').value.trim(), diy:$('#mDiy').checked, detail:$('#mDet').value.trim() });
  if (mState.photo){ m.photo = true; idb.put(m.id, mState.photo); }
  if (mState.isNew) S.maint.push(m);
  save(); closeSheet(); render(); toast('🔧 Entretien enregistré');
}

/* ---------- Relevé kilométrique ---------- */
function kmForm(vid){
  vid = defVid(vid);
  openSheet(`<h2>📏 Relevé kilométrique</h2><form id="kf"><div class="fld"><span>Véhicule</span>${vPick('vid', vid)}</div>
    <label class="fld"><span>Compteur</span><div class="unit"><input class="inp big-inp" id="kKm" inputmode="numeric" placeholder="km" required><em>km</em></div><p class="hint" id="kH"></p></label>
    <label class="fld"><span>Date</span><input class="inp" type="date" id="kD" value="${today()}" max="${today()}"></label>
    <button class="btn pri block" style="margin-top:16px">✅ Enregistrer</button></form>`);
  const h = () => { const v = vById(($('#kf [name=vid]:checked') || {}).value); $('#kH').textContent = v ? 'Dernier relevé : ' + nf(curKm(v)) + ' km' : ''; };
  h(); $$('#kf [name=vid]').forEach(r => r.addEventListener('change', h));
  $('#kf').onsubmit = ev => { ev.preventDefault(); const v = vById(($('#kf [name=vid]:checked') || {}).value), K = pnum($('#kKm').value); if (!v || !ok(K)) return; v.kmLog.push({ d:$('#kD').value || today(), km:Math.round(K) }); save(); closeSheet(); render(); toast('📏 ' + nf(K) + ' km enregistrés'); };
}

/* ---------- Élément du plan ---------- */
function itemSheet(vid, id){
  const v = vById(vid), p = v.plan.find(x => x.id === id); if (!p) return;
  const st = maintStatus(v).find(x => x.id === id), hist = S.maint.filter(m => m.vid === vid && (m.items || []).includes(id)).sort((a, b) => sortD(b, a)), b = v.base[id] || {};
  openSheet(`<h2>${p.ic} ${esc(p.nom)}</h2>
  ${st ? `<div class="mt ${st.state}" ${vstyle(v)} style="pointer-events:none"><div class="bar"><i style="width:${Math.min(100, Math.max(3, (st.pct || 0) * 100)).toFixed(0)}%"></i></div><div class="d"><span>${esc(st.txt)}</span>${st.pred && st.state !== 'unk' ? `<span>📅 ~ ${fmtD(st.pred)}</span>` : ''}</div></div>` : ''}
  ${p.info ? `<p class="hint">${esc(p.info)}</p>` : ''}
  <button class="btn pri block" style="margin-top:14px" id="iDone">✅ Je viens de le faire</button>
  <form id="if">
    <h2 class="sec">Intervalle</h2>
    <div class="grid2"><label class="fld" style="margin-top:0"><span>Tous les</span><div class="unit"><input class="inp" id="iKm" inputmode="numeric" value="${p.km || ''}" placeholder="—"><em>km</em></div></label>
    <label class="fld" style="margin-top:0"><span>ou tous les</span><div class="unit"><input class="inp" id="iMo" inputmode="numeric" value="${p.mois || ''}" placeholder="—"><em>mois</em></div></label></div>
    <h2 class="sec">Dernière fois (si pas dans le carnet)</h2>
    <div class="grid2"><label class="fld" style="margin-top:0"><span>Date</span><input class="inp" type="date" id="iD" value="${b.d || ''}" max="${today()}"></label>
    <label class="fld" style="margin-top:0"><span>Kilométrage</span><div class="unit"><input class="inp" id="iBk" inputmode="numeric" value="${ok(b.km) ? b.km : ''}" placeholder="km"><em>km</em></div></label></div>
    <p class="hint">Une date approximative suffit : les prévisions démarrent de là.</p>
    <div class="row" style="margin-top:16px"><button type="button" class="btn danger" id="iDel">Retirer du plan</button><span class="spacer"></span><button class="btn pri">Enregistrer</button></div>
  </form>
  ${hist.length ? `<h2 class="sec">Historique</h2><div class="list">${hist.map(maintItem).join('')}</div>` : ''}`);
  $('#iDone').onclick = () => { closeSheet(); setTimeout(() => maintForm(null, { vid, items:[id], titre:p.nom, km: curKm(v) || null }), 60); };
  $('#if').onsubmit = ev => { ev.preventDefault(); p.km = Math.max(0, Math.round(pnum($('#iKm').value) || 0)); p.mois = Math.max(0, Math.round(pnum($('#iMo').value) || 0));
    const d = $('#iD').value, k = pnum($('#iBk').value); if (d) v.base[id] = { d, km: ok(k) ? Math.round(k) : null }; else delete v.base[id];
    save(); closeSheet(); render(); toast('Plan mis à jour'); };
  $('#iDel').onclick = () => confirmSheet('Retirer « ' + esc(p.nom) + ' » du plan ?', 'Retirer', () => { v.plan = v.plan.filter(x => x.id !== id); save(); render(); });
}
function planAdd(vid){
  const v = vById(vid);
  openSheet(`<h2>＋ Élément du plan</h2><form id="pa"><label class="fld"><span>Nom</span><input class="inp" id="pN" placeholder="ex. Courroie d’accessoires" required></label>
  <label class="fld"><span>Icône</span><input class="inp" id="pI" value="🔧" maxlength="4"></label>
  <div class="grid2"><label class="fld"><span>Tous les</span><div class="unit"><input class="inp" id="pK" inputmode="numeric" placeholder="—"><em>km</em></div></label><label class="fld"><span>ou tous les</span><div class="unit"><input class="inp" id="pM" inputmode="numeric" placeholder="—"><em>mois</em></div></label></div>
  <button class="btn pri block" style="margin-top:16px">Ajouter</button></form>`);
  $('#pa').onsubmit = ev => { ev.preventDefault(); const km = Math.round(pnum($('#pK').value) || 0), mois = Math.round(pnum($('#pM').value) || 0); if (!km && !mois) return toast('Indique un intervalle');
    v.plan.push({ id:'c' + uid(), ic:$('#pI').value || '🔧', nom:$('#pN').value.trim(), km, mois }); save(); closeSheet(); render(); };
}

/* ---------- Véhicule : modifier / ajouter ---------- */
const PAINTS = [['#f4f6f8', 'Blanc'], ['#c7ccd3', 'Gris argent'], ['#6b7280', 'Gris foncé'], ['#1f2937', 'Noir'], ['#b91c1c', 'Rouge'], ['#1d4ed8', 'Bleu'], ['#0f766e', 'Vert foncé'], ['#84cc16', 'Vert Kawasaki'], ['#ea580c', 'Orange'], ['#facc15', 'Jaune'], ['#e7dcc4', 'Beige']];
const COLORS = ['#ef4444', '#f97316', '#facc15', '#84cc16', '#22c55e', '#14b8a6', '#38bdf8', '#6366f1', '#a855f7', '#ec4899', '#e2e8f0', '#94a3b8'];
function vehicleForm(vid){
  const v = vid ? vById(vid) : null, isNew = !v;
  const opts = Object.entries(MODELS).map(([mk, M]) => `<optgroup label="${esc(M.marque + ' ' + M.modele)}">${Object.entries(M.variants).map(([vk, V]) => `<option value="${mk}|${vk}" ${v && v.model === mk && v.variant === vk ? 'selected' : ''}>${esc(V.nom)} (${esc(V.annees)})</option>`).join('')}</optgroup>`).join('')
    + `<optgroup label="Autre véhicule"><option value="custom|car" ${v && v.model === 'custom' && v.type !== 'moto' ? 'selected' : ''}>Autre voiture</option><option value="custom|moto" ${v && v.model === 'custom' && v.type === 'moto' ? 'selected' : ''}>Autre moto</option></optgroup>`;
  const D = v ? v.docs : {};
  openSheet(`<h2>${isNew ? '＋ Nouveau véhicule' : '✏️ ' + esc(v.nom)}</h2><form id="vf">
    <label class="fld"><span>Nom affiché</span><input class="inp" id="vN" value="${esc(v ? v.nom : '')}" placeholder="ex. Toyota Auris" required></label>
    <label class="fld"><span>Motorisation exacte</span><select class="inp" id="vV">${opts}</select><p class="hint">Regarde la case D.2 / P.1 de ta carte grise si tu as un doute.</p></label>
    <label class="fld"><span>Kilométrage actuel</span><div class="unit"><input class="inp big-inp" id="vKm" inputmode="numeric" placeholder="km" value="${v && curKm(v) ? curKm(v) : ''}"><em>km</em></div></label>
    <div class="grid3" style="gap:8px"><label class="fld"><span>Réservoir</span><div class="unit"><input class="inp" id="vR" inputmode="decimal" value="${v ? v.reservoir : ''}"><em>L</em></div></label>
    <label class="fld"><span>Conso réf.</span><div class="unit"><input class="inp" id="vC" inputmode="decimal" value="${v ? String(v.conso).replace('.', ',') : ''}"><em>L</em></div></label>
    <label class="fld"><span>Carburant</span><select class="inp" id="vCarb">${FUELS.map(c => `<option ${v && v.carb === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label></div>
    <div class="fld"><span>Couleur de la carrosserie</span><div class="pick">${PAINTS.map(([c, n]) => `<label title="${n}"><input type="radio" name="vpaint" value="${c}" ${(v ? v.paint : PAINTS[0][0]) === c ? 'checked' : ''}><span style="--vc:#38bdf8;width:34px;height:34px;padding:0;border-radius:50%;background:${c};box-shadow:inset 0 0 0 1px rgba(0,0,0,.4)"></span></label>`).join('')}</div></div>
    <div class="fld"><span>Couleur dans l’appli</span><div class="pick">${COLORS.map(c => `<label><input type="radio" name="vcol" value="${c}" ${(v ? v.color : COLORS[6]) === c ? 'checked' : ''}><span style="--vc:${c};width:34px;height:34px;padding:0;border-radius:50%;background:${c}"></span></label>`).join('')}</div></div>
    <h2 class="sec">Papiers</h2>
    <div class="grid2"><label class="fld" style="margin-top:0"><span>Immatriculation</span><input class="inp" id="dI" value="${esc(D.immat || '')}" placeholder="AB-123-CD" style="text-transform:uppercase"></label>
    <label class="fld" style="margin-top:0"><span>Date d’achat</span><input class="inp" type="date" id="dA" value="${D.achat || ''}"></label>
    <label class="fld"><span>Prochain CT</span><input class="inp" type="date" id="dC" value="${D.ct || ''}"></label>
    <label class="fld"><span>Échéance assurance</span><input class="inp" type="date" id="dS" value="${D.assu || ''}"></label></div>
    <label class="fld"><span>Assureur</span><input class="inp" id="dAs" value="${esc(D.assureur || '')}"></label>
    <label class="fld"><span>N° de série (VIN)</span><input class="inp" id="dV" value="${esc(D.vin || '')}" style="text-transform:uppercase"></label>
    <label class="fld"><span>Notes</span><textarea class="inp" id="dN" placeholder="Code autoradio, taille des balais, références…">${esc(D.notes || '')}</textarea></label>
    <div class="row" style="margin-top:18px">${isNew ? '' : '<button type="button" class="btn danger" id="vDel">🗑️</button>'}<span class="spacer"></span><button type="button" class="btn" data-x="close">Annuler</button><button class="btn pri">✅ Enregistrer</button></div>
  </form>`);
  $('#vV').onchange = () => { const [mk, vk] = $('#vV').value.split('|'), V = MODELS[mk] && MODELS[mk].variants[vk]; if (V){ $('#vR').value = V.reservoir; $('#vC').value = String(V.conso).replace('.', ','); $('#vCarb').value = V.carb; if (!$('#vN').value) $('#vN').value = MODELS[mk].marque + ' ' + MODELS[mk].modele; } };
  if (isNew) $('#vV').onchange();
  $('#vf').onsubmit = ev => {
    ev.preventDefault(); const [mk, vk] = $('#vV').value.split('|');
    let t = v;
    if (isNew){ t = mk === 'custom' ? newVehicle('custom', null, { type:vk }) : newVehicle(mk, vk); S.vehicles.push(t); }
    else if (t.model !== mk || t.variant !== vk){
      t.model = mk; t.variant = mk === 'custom' ? null : vk; if (mk === 'custom') t.type = vk;
      const V = MODELS[mk] && MODELS[mk].variants[vk], tpl = V ? V.plan : (vk === 'moto' ? PLAN_MOTO : PLAN_CAR);
      const keep = t.plan.filter(p => p.id.startsWith('c')); t.plan = clone(tpl).concat(keep);
    }
    t.nom = $('#vN').value.trim() || t.nom; t.reservoir = pnum($('#vR').value) || t.reservoir; t.conso = pnum($('#vC').value) || t.conso; t.carb = $('#vCarb').value;
    t.color = ($('#vf [name=vcol]:checked') || {}).value || t.color; t.paint = ($('#vf [name=vpaint]:checked') || {}).value || t.paint; t.done = true;
    t.docs = Object.assign(t.docs || {}, { immat:$('#dI').value.trim().toUpperCase(), achat:$('#dA').value, ct:$('#dC').value, assu:$('#dS').value, assureur:$('#dAs').value.trim(), vin:$('#dV').value.trim().toUpperCase(), notes:$('#dN').value.trim() });
    const K = pnum($('#vKm').value); if (ok(K) && Math.round(K) !== curKm(t)) t.kmLog.push({ d:today(), km:Math.round(K) });
    if (S.vehicles.every(x => x.done)) S.setup = true;
    save(); closeSheet(); render(); toast('🚘 ' + t.nom + ' enregistré');
  };
  if (!isNew) $('#vDel').onclick = () => confirmSheet('Supprimer ' + esc(v.nom) + ' et tout son historique ?', '🗑️ Supprimer', () => { S.vehicles = S.vehicles.filter(x => x.id !== v.id); S.fuels = S.fuels.filter(x => x.vid !== v.id); S.maint = S.maint.filter(x => x.vid !== v.id); if (sel === v.id) sel = 'all'; view = 'home'; save(); render(); });
}

/* ---------- Scan des tickets ---------- */
function pickImage(cb){
  openSheet(`<h2>📷 Photo du ticket</h2><p class="hint" style="margin-bottom:14px">Pose le ticket à plat, bien éclairé, et cadre-le en entier.</p><div class="actions">
    <button class="action" id="pCam"><span class="e">📸</span><div><b>Prendre une photo</b><small>Avec l’appareil photo</small></div></button>
    <button class="action" id="pGal"><span class="e">🖼️</span><div><b>Choisir une image</b><small>Depuis la galerie ou les fichiers</small></div></button></div>`);
  const go = cam => { const inp = $('#fileIn'); if (cam) inp.setAttribute('capture', 'environment'); else inp.removeAttribute('capture'); inp.value = ''; inp.onchange = () => { const f = inp.files[0]; if (f) cb(f); }; inp.click(); };
  $('#pCam').onclick = () => go(true); $('#pGal').onclick = () => go(false);
}
function loadImg(file){ return new Promise((res, rej) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = u; }); }
function toCanvas(im, max, gray){
  const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
  const x = c.getContext('2d'); x.drawImage(im, 0, 0, c.width, c.height);
  if (gray){ const d = x.getImageData(0, 0, c.width, c.height), a = d.data; let mn = 255, mx = 0; for (let i = 0; i < a.length; i += 4){ const g = a[i] * .3 + a[i + 1] * .59 + a[i + 2] * .11; a[i] = g; if (g < mn) mn = g; if (g > mx) mx = g; }
    const s = 255 / Math.max(1, mx - mn); for (let i = 0; i < a.length; i += 4){ const g = Math.max(0, Math.min(255, (a[i] - mn) * s * 1.1 - 10)); a[i] = a[i + 1] = a[i + 2] = g; } x.putImageData(d, 0, 0); }
  return c;
}
function loadScript(src){ return new Promise((res, rej) => { if ($$('script').some(s => s.src === src)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
async function scanFlow(kind, vid){
  pickImage(async file => {
    closeSheet();
    await new Promise(r => setTimeout(r, 120));
    openSheet(`<div class="scan"><div class="ring"></div><b style="font-size:18px" id="scT">Lecture du ${kind === 'fuel' ? 'ticket' : 'document'}…</b><p class="hint" id="scH">Analyse de l’image</p><div class="prog"><i id="scP" style="width:5%"></i></div></div>`);
    const prog = (p, t) => { const e = $('#scP'); if (e) e.style.width = Math.round(p * 100) + '%'; if (t && $('#scH')) $('#scH').textContent = t; };
    let im; try{ im = await loadImg(file); }catch(e){ closeSheet(); return toast('Image illisible'); }
    const photo = toCanvas(im, 1100).toDataURL('image/jpeg', .72);
    let res = null, src = '';
    const key = safeGet(KEY_AI, '');
    if (key){
      try{ prog(.3, 'Lecture par l’IA…'); res = await aiRead(kind, toCanvas(im, 1600).toDataURL('image/jpeg', .85).split(',')[1]); src = 'Lu par l’IA'; }
      catch(e){ prog(.2, 'IA indisponible, lecture locale…'); }
    }
    if (!res){
      try{
        prog(.1, 'Chargement du lecteur de texte (1re fois ≈ 5 Mo)…');
        await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js');
        const w = await Tesseract.createWorker('fra', 1, { logger: m => { if (m.status === 'recognizing text') prog(.3 + m.progress * .65, 'Lecture du texte… ' + Math.round(m.progress * 100) + ' %'); } });
        const { data } = await w.recognize(toCanvas(im, 2000, true)); await w.terminate();
        res = kind === 'fuel' ? parseFuel(data.text) : parseInvoice(data.text, vById(defVid(vid))); src = 'Lu sur ton téléphone';
      }catch(e){ res = {}; src = 'Lecture impossible'; }
    }
    prog(1);
    closeSheet(); await new Promise(r => setTimeout(r, 300));
    const ai = {}; Object.keys(res).forEach(k => { if (res[k] != null && res[k] !== '' && !(Array.isArray(res[k]) && !res[k].length)) ai[k] = 1; });
    const found = Object.keys(ai).length;
    if (kind === 'fuel') fuelForm(null, Object.assign({ vid:defVid(vid) }, clean(res), { photo, ai, src: found ? src : 'Rien de lisible, saisis à la main' }));
    else { const v = vById(defVid(vid)); const r = clean(res); if (r.items && v) r.items = r.items.filter(i => v.plan.some(p => p.id === i)); maintForm(null, Object.assign({ vid:defVid(vid) }, r, { photo, ai, src: found ? src : 'Rien de lisible, saisis à la main' })); }
  });
}
function clean(o){ const r = {}; Object.entries(o).forEach(([k, v]) => { if (v != null && v !== '' && !(typeof v === 'number' && !isFinite(v))) r[k] = v; }); return r; }

/* Lecture locale : analyse du texte reconnu */
const NUM = s => Number(String(s).replace(/\s/g, '').replace(',', '.'));
function findDate(T){
  const re = /(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/g; let m;
  while ((m = re.exec(T))){
    let y = +m[3], mo = m[2], dd = +m[1]; if (y < 100) y += 2000;
    if (+mo > 12 && /^1[6890]$/.test(mo)) mo = '10'; // 0 souvent lu 6, 8 ou 9
    if (+mo < 1 || +mo > 12 || dd < 1 || dd > 31 || y < 2000) continue;
    const d = ymd(new Date(y, +mo - 1, dd)); if (d <= today()) return d;
  }
  return null;
}
function findTotal(lines){
  const amt = /(\d{1,4}[.,]\d{2})(?!\d)/g; let best = null;
  lines.forEach(l => { if (/total|montant|ttc|a payer|à payer|net|carte|cb|r[eè]gl/i.test(l) && !/tva|ht\b/i.test(l)){ let m; while ((m = amt.exec(l))){ const v = NUM(m[1]); if (v >= 1 && v <= 5000 && (!best || v > best)) best = v; } } });
  if (!best){ lines.forEach(l => { let m; const re = /(\d{1,4}[.,]\d{2})\s*(€|eur)/gi; while ((m = re.exec(l))){ const v = NUM(m[1]); if (v >= 1 && v <= 5000 && (!best || v > best)) best = v; } }); }
  return best;
}
function parseFuel(text){
  const T = text.replace(/\r/g, ''), lines = T.split('\n').map(s => s.trim()).filter(Boolean), r = {};
  let m;
  const lit = []; const lre = /(\d{1,3}[.,]\d{2,3})\s*(?:l\b|litres?|ltr?s?\b)/gi; while ((m = lre.exec(T))) lit.push(NUM(m[1]));
  lines.forEach(l => { if (/volume|quantit|qt[eé]|litre/i.test(l)){ const n = l.match(/(\d{1,3}[.,]\d{2,3})/); if (n) lit.push(NUM(n[1])); } });
  r.l = lit.find(x => x >= 1 && x <= 150) || null;
  const pus = []; const pre = /(\d[.,]\d{3})\s*(?:€|eur)?\s*\/\s*l/gi; while ((m = pre.exec(T))) pus.push(NUM(m[1]));
  lines.forEach(l => { if (/prix|p\.?\s?u|€\s*\/\s*l|eur\s*\/\s*l|unit/i.test(l)){ const n = l.match(/(\d[.,]\d{3})(?!\d)/); if (n) pus.push(NUM(n[1])); } });
  if (!pus.length){ const any = T.match(/\b([12][.,]\d{3})\b/); if (any) pus.push(NUM(any[1])); }
  r.pu = pus.find(x => x >= .8 && x <= 3.5) || null;
  r.eur = findTotal(lines);
  if (r.l && r.pu && !r.eur) r.eur = r2(r.l * r.pu);
  if (r.eur && r.pu && !r.l) r.l = r2(r.eur / r.pu);
  if (r.eur && r.l && !r.pu) r.pu = r3(r.eur / r.l);
  if (r.eur && r.l && r.pu && Math.abs(r.l * r.pu - r.eur) > 1){ const l2 = r2(r.eur / r.pu); if (l2 > 1 && l2 < 150) r.l = l2; }
  r.d = findDate(T);
  r.carb = /sp\s?95.{0,3}e\s?10|\be10\b/i.test(T) ? 'SP95-E10' : /sp\s?98|sans plomb 98|sp 98/i.test(T) ? 'SP98' : /sp\s?95|sans plomb 95/i.test(T) ? 'SP95' : /gazole|diesel|gasoil|\bb7\b/i.test(T) ? 'Gazole' : /e\s?85|superethanol|bio[ée]thanol/i.test(T) ? 'E85' : /gpl/i.test(T) ? 'GPL' : null;
  const U = T.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  r.station = /TOTAL ?(ENERGIES|ACCESS)/.test(U) ? 'TotalEnergies' : (STATIONS.find(s => s !== 'TotalEnergies' && U.includes(s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace('E.', ''))) || null);
  return r;
}
function parseInvoice(text, v){
  const T = text.replace(/\r/g, ''), lines = T.split('\n').map(s => s.trim()).filter(Boolean), r = {};
  r.eur = findTotal(lines); r.d = findDate(T);
  const k = T.match(/(\d{1,3}[ . ]?\d{3})\s*km/i) || T.match(/kilom[eé]t[^\d]{0,20}(\d{1,3}[ .]?\d{3})/i); if (k) r.km = NUM(k[1].replace(/[ . ]/g, ''));
  r.garage = lines.find(l => /[a-z]{3,}/i.test(l) && l.length < 40) || null;
  r.items = PLAN_KEYWORDS.filter(([id, re]) => re.test(T)).map(([id]) => id);
  if (r.items.length && v){ const n = r.items.map(id => (v.plan.find(p => p.id === id) || {}).nom).filter(Boolean); if (n.length) r.titre = n.length > 2 ? 'Révision' : n.join(' + '); }
  r.detail = lines.filter(l => PLAN_KEYWORDS.some(([, re]) => re.test(l))).slice(0, 8).join('\n') || null;
  return r;
}

/* ---------- Claude (clé de l'utilisateur, appel direct depuis le navigateur) ---------- */
async function claude(body){
  const key = safeGet(KEY_AI, ''); if (!key) throw new Error('Pas de clé');
  const model = safeGet(KEY_MODEL, 'claude-opus-5-5');
  const call = async withFallback => {
    const headers = { 'content-type':'application/json', 'x-api-key':key, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' };
    const b = Object.assign({ model }, body);
    if (withFallback){ headers['anthropic-beta'] = 'server-side-fallback-2026-07-01'; b.fallbacks = 'default'; }
    const r = await fetch('https://api.anthropic.com/v1/messages', { method:'POST', headers, body:JSON.stringify(b) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok){ const e = new Error((j.error && j.error.message) || ('Erreur ' + r.status)); e.status = r.status; throw e; }
    return j;
  };
  let j;
  try{ j = await call(model !== 'claude-haiku-5-5'); }
  catch(e){ if (e.status === 400 && /fallback|beta/i.test(e.message)) j = await call(false); else throw e; }
  if (j.stop_reason === 'refusal') throw new Error('Demande refusée par l’IA');
  return (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
}
const SCHEMA_FUEL = { type:'object', additionalProperties:false, required:['date', 'litres', 'montant', 'prix_litre', 'carburant', 'station'], properties:{
  date:{ type:'string', description:'Date du ticket au format AAAA-MM-JJ, chaîne vide si absente' }, litres:{ type:'number', description:'Volume de carburant en litres, 0 si absent' },
  montant:{ type:'number', description:'Montant total payé en euros, 0 si absent' }, prix_litre:{ type:'number', description:'Prix au litre en euros, 0 si absent' },
  carburant:{ type:'string', enum:FUELS.concat(['']) }, station:{ type:'string', description:'Enseigne de la station, chaîne vide si absente' } } };
const SCHEMA_INV = { type:'object', additionalProperties:false, required:['date', 'km', 'montant', 'garage', 'titre', 'operations', 'detail'], properties:{
  date:{ type:'string', description:'AAAA-MM-JJ ou chaîne vide' }, km:{ type:'number', description:'Kilométrage du véhicule indiqué, 0 si absent' }, montant:{ type:'number', description:'Total TTC en euros, 0 si absent' },
  garage:{ type:'string' }, titre:{ type:'string', description:'Intitulé court de l’intervention' },
  operations:{ type:'array', items:{ type:'string' }, description:'Identifiants des opérations du plan réalisées' }, detail:{ type:'string', description:'Pièces et main-d’œuvre, une ligne par élément' } } };
async function aiRead(kind, b64){
  const v = vById(defVid());
  const prompt = kind === 'fuel'
    ? 'Voici la photo d’un ticket de caisse de station-service en France. Extrais les informations du plein de carburant. Ignore les autres achats (boutique, lavage). Mets 0 ou une chaîne vide quand une valeur est illisible.'
    : 'Voici la photo d’une facture d’entretien ou de réparation de véhicule en France. Extrais les informations. Pour « operations », choisis uniquement parmi ces identifiants : ' + (v ? v.plan.map(p => p.id + ' (' + p.nom + ')').join(', ') : '') + '. Mets 0 ou une chaîne vide quand une valeur est absente.';
  const txt = await claude({ max_tokens:2000, output_config:{ effort:'low', format:{ type:'json_schema', schema: kind === 'fuel' ? SCHEMA_FUEL : SCHEMA_INV } },
    messages:[{ role:'user', content:[{ type:'image', source:{ type:'base64', media_type:'image/jpeg', data:b64 } }, { type:'text', text:prompt }] }] });
  const j = JSON.parse(txt), nz = x => (ok(x) && x > 0) ? x : null, dt = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && s <= today() ? s : null;
  if (kind === 'fuel'){
    const r = { d:dt(j.date), l:nz(j.litres), eur:nz(j.montant), pu:nz(j.prix_litre), carb:j.carburant || null, station:j.station || null };
    if (r.eur && r.l && !r.pu) r.pu = r3(r.eur / r.l); if (r.eur && r.pu && !r.l) r.l = r2(r.eur / r.pu);
    return r;
  }
  return { d:dt(j.date), km:nz(j.km), eur:nz(j.montant), garage:j.garage || null, titre:j.titre || null, items:(j.operations || []), detail:j.detail || null };
}
function vehicleContext(v){
  const st = maintStatus(v), ser = consoSeries(v.id), V = variantOf(v);
  return `## ${v.nom} — ${V.nom} (${V.annees || ''})
Kilométrage : ${curKm(v)} km · rythme ≈ ${Math.round(kmRate(v) * 30.4)} km/mois · conso réelle moyenne : ${avgConso(v.id) ? nf(avgConso(v.id), 1) : 'inconnue'} L/100 (constructeur ${v.conso}) · carburant ${v.carb}
Fiche : ${V.specs.map(([t, rows]) => t + ' : ' + rows.map(r => r[0] + ' ' + r[1]).join(', ')).join(' | ')}
Plan d'entretien : ${st.map(x => x.nom + ' [' + ({ ok:'OK', warn:'bientôt', ko:'EN RETARD', unk:'historique inconnu' })[x.state] + (x.txt && x.state !== 'unk' ? ', ' + x.txt : '') + ']').join(' ; ')}
Derniers entretiens : ${maintOf(v.id).sort((a, b) => sortD(b, a)).slice(0, 8).map(m => m.d + ' ' + (m.km || '?') + ' km : ' + (m.titre || (m.items || []).join(', ')) + (m.eur ? ' ' + m.eur + ' €' : '')).join(' ; ') || 'aucun'}
Consommations récentes : ${ser.slice(-6).map(s => s.d + ' ' + nf(s.c, 1)).join(', ') || 'aucune'}
Papiers : CT ${v.docs.ct || '?'} · assurance ${v.docs.assu || '?'}`;
}
function askForm(vid, q){
  if (!safeGet(KEY_AI, '')){ toast('Ajoute ta clé API dans les réglages'); go('settings'); return; }
  const v = vid ? vById(vid) : null;
  openSheet(`<h2>🤖 Mécano IA${v ? ' · ' + esc(v.nom) : ''}</h2><form id="af"><textarea class="inp" id="aQ" placeholder="ex. Quelle huile mettre et combien ? Mon frein avant grince, que faire ?" required>${esc(q || '')}</textarea><button class="btn pri block" style="margin-top:12px" id="aGo">Demander</button></form><div id="aR" style="margin-top:16px"></div>`);
  $('#af').onsubmit = async ev => {
    ev.preventDefault(); const qq = $('#aQ').value.trim(); if (!qq) return;
    $('#aGo').disabled = true; $('#aR').innerHTML = '<div class="scan"><div class="ring"></div><p class="hint">Le mécano réfléchit…</p></div>';
    try{
      const ctx = (v ? [v] : S.vehicles).map(vehicleContext).join('\n\n');
      const txt = await claude({ max_tokens:4000, output_config:{ effort:'medium' },
        system:'Tu es un mécanicien automobile et moto expérimenté en France. Tu réponds en français simple et chaleureux, de façon concrète et courte (moins de 200 mots), avec des listes quand c’est utile, en t’appuyant sur les données du garage de l’utilisateur ci-dessous. Signale clairement quand une valeur est à vérifier dans le carnet constructeur et quand il faut aller au garage pour une question de sécurité (freins, pneus, direction).\n\n' + ctx + '\nDate du jour : ' + today(),
        messages:[{ role:'user', content:qq }] });
      $('#aR').innerHTML = `<div class="card"><div class="ai-ans">${esc(txt).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^#{1,3} ?(.+)$/gm, '<b>$1</b>')}</div></div>`;
    }catch(e){ $('#aR').innerHTML = `<p class="hint ko">❌ ${esc(e.message)}</p>`; }
    $('#aGo').disabled = false;
  };
}

/* ---------- Export / import ---------- */
function download(name, text, type){ const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
function exportCSV(){
  const q = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"', cm = consoMap();
  const rows = [['Type', 'Véhicule', 'Date', 'Km', 'Montant €', 'Litres', 'Prix/L', 'Conso L/100', 'Carburant/Opérations', 'Station/Garage', 'Note']];
  S.fuels.slice().sort(sortD).forEach(f => rows.push(['Plein', (vById(f.vid) || {}).nom, f.d, f.km, f.eur, f.l, f.pu, cm[f.id] ? r2(cm[f.id].c) : '', f.carb, f.station, f.note]));
  S.maint.slice().sort(sortD).forEach(m => { const v = vById(m.vid) || { plan:[] }; rows.push(['Entretien', v.nom, m.d, m.km, m.eur, '', '', '', m.titre || (m.items || []).map(i => (v.plan.find(p => p.id === i) || {}).nom).join(' + '), m.garage, m.detail]); });
  download('mon-garage-' + today() + '.csv', '﻿' + rows.map(r => r.map(x => typeof x === 'number' ? String(x).replace('.', ',') : q(x)).join(';')).join('\n'), 'text/csv');
}
function importJSON(){
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
  inp.onchange = () => { const f = inp.files[0]; if (!f) return; f.text().then(t => { let d; try{ d = JSON.parse(t); }catch(e){ return toast('Fichier invalide'); } if (!d.vehicles) return toast('Ce n’est pas une sauvegarde Mon Garage');
    confirmSheet('Remplacer toutes les données par cette sauvegarde ?', 'Restaurer', () => { S = migrate(d); save(); render(); toast('✅ Sauvegarde restaurée'); }); }); };
  inp.click();
}

/* ---------- Actions ---------- */
document.addEventListener('click', e => {
  const n = e.target.closest('[data-nav]'); if (n){ e.preventDefault(); if ($('#sheet').classList.contains('on')) closeSheet(); go(n.dataset.nav); return; }
  const b = e.target.closest('[data-x]'); if (!b) return;
  const x = b.dataset.x, vid = b.dataset.v, inSheet = !!b.closest('#sheet');
  const fromSheet = fn => { if (inSheet && $('#sheet').classList.contains('on')){ closeSheet(); setTimeout(fn, 80); } else fn(); };
  switch (x){
    case 'add': addMenu(); break;
    case 'close': closeSheet(); break;
    case 'sel': sel = vid; render(); break;
    case 'vopen': vcur = vid; vtab = 'apercu'; go('vehicle'); break;
    case 'vtab': vtab = b.dataset.t; render(); break;
    case 'fuel': fromSheet(() => fuelForm(null, { vid })); break;
    case 'maint': fromSheet(() => maintForm(null, { vid })); break;
    case 'kmlog': fromSheet(() => kmForm(vid)); break;
    case 'scan': fromSheet(() => scanFlow(b.dataset.k, vid)); break;
    case 'fedit': { const f = S.fuels.find(y => y.id === b.dataset.id); if (f) fromSheet(() => fuelForm(f)); break; }
    case 'medit': { const m = S.maint.find(y => y.id === b.dataset.id); if (m) fromSheet(() => maintForm(m)); break; }
    case 'item': itemSheet(vid, b.dataset.i); break;
    case 'planadd': planAdd(vid); break;
    case 'vedit': fromSheet(() => vehicleForm(vid)); break;
    case 'vnew': vehicleForm(null); break;
    case 'setupdone': S.setup = true; save(); render(); break;
    case 'ask': fromSheet(() => askForm(vid, b.dataset.q)); break;
    case 'insact': { const a = b.dataset.a; if (a === 'item') itemSheet(vid, b.dataset.i); else if (a === 'plan'){ vcur = vid; vtab = 'plan'; go('vehicle'); } else if (a === 'edit') vehicleForm(vid); else if (a === 'fuel') fuelForm(null, { vid }); break; }
    case 'savekey': safeSet(KEY_AI, $('#aiKey').value.trim()); safeSet(KEY_MODEL, $('#aiModel').value); toast($('#aiKey').value.trim() ? '🤖 IA activée' : 'Clé retirée'); render(); break;
    case 'export': download('mon-garage-' + today() + '.json', JSON.stringify(S, null, 1), 'application/json'); break;
    case 'csv': exportCSV(); break;
    case 'import': importJSON(); break;
    case 'reset': confirmSheet('Effacer tous les véhicules, pleins et entretiens ?', '🗑️ Tout effacer', () => { S = fresh(); save(); view = 'home'; render(); }); break;
  }
});

/* ---------- Démarrage ---------- */
document.querySelector('.top .pill').addEventListener('click', () => go('settings'));
render(); startSync();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
