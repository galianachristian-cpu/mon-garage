/* ============================================================
   MON GARAGE : animations (fond, cascade, compteurs, onde,
   écran d'ouverture, célébration, santé de l'entretien)
   ============================================================ */
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* fond lumineux */
document.body.insertAdjacentHTML('afterbegin', '<div class="aurora" aria-hidden="true"><i></i><i></i><i></i></div><div class="grain" aria-hidden="true"></div>');

/* écran d'ouverture, une fois par session */
(() => {
  let seen = false; try{ seen = sessionStorage.getItem('mg_splash') === '1'; sessionStorage.setItem('mg_splash', '1'); }catch(e){}
  if (seen || RM) return;
  document.body.insertAdjacentHTML('beforeend', '<div class="splash" id="splash"><div class="in"><img src="icon-192.png?v=3" alt=""><b>Mon Garage</b><span>Pleins · entretien · conseils</span><div class="bar"></div></div></div>');
  setTimeout(() => { const s = $('#splash'); if (s){ s.classList.add('out'); setTimeout(() => s.remove(), 600); } }, 1300);
})();

/* chiffres qui défilent jusqu'à leur valeur */
function countUp(el){
  const t = el.firstChild; if (!t || t.nodeType !== 3) return;
  const m = t.textContent.match(/^(\d(?:[\d   ]*\d)?)(?:,(\d+))?([\s\S]*)$/); if (!m) return;
  const dec = m[2] ? m[2].length : 0, target = Number(m[1].replace(/\D/g, '') + (dec ? '.' + m[2] : '')), suf = m[3];
  if (!(target > 0)) return;
  const t0 = performance.now(), D = 900 + Math.min(600, target / 50);
  const step = now => { const p = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - p, 3);
    t.textContent = (target * e).toLocaleString('fr-FR', { minimumFractionDigits:dec, maximumFractionDigits:dec }) + suf; if (p < 1) requestAnimationFrame(step); };
  t.textContent = (0).toLocaleString('fr-FR', { minimumFractionDigits:dec, maximumFractionDigits:dec }) + suf;
  requestAnimationFrame(step);
}
const nextFrame = fn => requestAnimationFrame(() => requestAnimationFrame(fn));

/* entrée d'un écran : cascade, jauges, graphiques, compteurs (seulement quand on change d'écran) */
let fxKey = '';
hook('afterRender', () => {
  const app = $('#app'), key = [view, vcur, vtab, sel].join('|');
  if (key === fxKey || RM){ fxKey = key; return; }
  fxKey = key;
  app.classList.remove('enter'); void app.offsetWidth; app.classList.add('enter');
  let i = 0;
  const mark = el => { el.classList.add('rise'); el.style.setProperty('--i', Math.min(i++, 14)); };
  [...(app.firstElementChild || app).children].forEach(el => {
    if (el.matches('.vlist,.list,.grid2,.grid3,.tools,.kpis')) [...el.children].forEach(mark); else mark(el);
  });
  $$('#app .vlist > .vcard').forEach((c, k) => c.style.setProperty('--i', k));
  $$('#app .gauge i, #app .mt .bar i').forEach(g => { const w = g.style.width; g.style.width = '0'; nextFrame(() => { g.style.width = w; }); });
  $$('#app .chart').forEach(svg => {
    svg.querySelectorAll('path[fill="none"]').forEach(p => { try{ p.style.setProperty('--len', Math.ceil(p.getTotalLength()) + 'px'); }catch(e){} });
    svg.querySelectorAll('rect').forEach((r, k) => r.style.setProperty('--i', k));
    svg.querySelectorAll('circle').forEach((c, k) => c.style.setProperty('--i', k));
  });
  $$('#app .health .val').forEach(c => { const off = c.dataset.off; c.style.strokeDashoffset = c.dataset.c; nextFrame(() => { c.style.strokeDashoffset = off; }); });
  $$('#app .hero .big, #app .kpi b, #app .vcard .vs b, #app .grid3 .card b.num, #app .health b').forEach(countUp);
});

/* anneau « santé de l'entretien » sur la fiche du véhicule */
hook('vHero', v => {
  const st = maintStatus(v).filter(x => x.state !== 'unk'); if (!st.length) return '';
  const score = Math.round(sum(st, x => x.state === 'ok' ? 1 : x.state === 'warn' ? .5 : 0) / st.length * 100);
  const col = score >= 80 ? '#34d399' : score >= 50 ? '#fbbf24' : '#f87171', C = 2 * Math.PI * 22, off = C * (1 - score / 100), bad = st.filter(x => x.state !== 'ok').length;
  return `<div class="health"><svg viewBox="0 0 54 54"><circle class="trk" cx="27" cy="27" r="22"/><circle class="val" cx="27" cy="27" r="22" stroke="${col}" stroke-dasharray="${C.toFixed(1)}" style="stroke-dashoffset:${off.toFixed(1)}" data-c="${C.toFixed(1)}" data-off="${off.toFixed(1)}"/></svg>
    <div><b style="color:${col}">${score} %</b><span>Santé de l’entretien${bad ? ' · ' + bad + ' point' + (bad > 1 ? 's' : '') + ' à surveiller' : ' · tout est à jour'}</span></div></div>`;
});

/* onde sous le doigt et petite vibration sur les actions principales */
document.addEventListener('pointerdown', e => {
  const t = e.target.closest('.btn,.item,.tool,.chip,.vcard,.action,.mt,.ins,.tabs button'); if (!t) return;
  if (t.matches('.btn.pri,.tool,.vcard,.action') && navigator.vibrate) try{ navigator.vibrate(8); }catch(err){}
  if (RM) return;
  const r = t.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2.2, sp = document.createElement('span');
  sp.className = 'ripple'; sp.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
  t.appendChild(sp); setTimeout(() => sp.remove(), 650);
}, { passive:true });

/* panneau ouvert : le bouton ＋ change d'état */
const _openSheetFx = openSheet, _closeSheetFx = closeSheet;
openSheet = function(h){ _openSheetFx(h); document.body.classList.add('sheet-open'); };
closeSheet = function(p){ _closeSheetFx(p); document.body.classList.toggle('sheet-open', $('#sheet').classList.contains('on')); };

/* célébration quand un plein ou un entretien est enregistré */
function celebrate(){
  if (RM) return;
  const cols = ['#38bdf8', '#818cf8', '#f472b6', '#34d399', '#fbbf24'], d = document.createElement('div'); d.className = 'yay';
  let h = '<div class="ok"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>';
  for (let k = 0; k < 30; k++){ const a = Math.random() * Math.PI * 2, r = 110 + Math.random() * 170;
    h += `<i style="background:${cols[k % 5]};--x:${(Math.cos(a) * r).toFixed(0)}px;--y:${(Math.sin(a) * r - 70).toFixed(0)}px;--r:${(Math.random() * 720 - 360).toFixed(0)}deg;animation-delay:${(Math.random() * .12).toFixed(2)}s"></i>`; }
  d.innerHTML = h; document.body.appendChild(d); setTimeout(() => d.remove(), 1700);
}
['saveFuel', 'saveMaint'].forEach(n => {
  const f = window[n];
  window[n] = function(){ const was = $('#sheet').classList.contains('on'); f.apply(this, arguments); if (was && !$('#sheet').classList.contains('on')) celebrate(); };
});
