/* core.js: fungsi umum, penyimpanan, cadangan file, pencocokan nama barang.
   Semua lewat namespace global KS. */
(function () {
'use strict';
const KS = window.KS = {};

KS.$ = s => document.querySelector(s);
KS.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
KS.rp = n => 'Rp' + Math.round(n || 0).toLocaleString('id-ID');
KS.uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
KS.num = v => parseInt(String(v == null ? '' : v).replace(/[^\d]/g, ''), 10) || 0;
KS.sum = (a, f) => a.reduce((x, y) => x + f(y), 0);
KS.norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
KS.title = s => s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
KS.isToday = t => new Date(t).toDateString() === new Date().toDateString();
KS.cmpVer = (a, b) => {
  const x = String(a || '0').split('.').map(Number), y = String(b || '0').split('.').map(Number);
  for (let i = 0; i < 3; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0 ? 1 : -1; }
  return 0;
};
KS.tile = name => {
  const w = KS.norm(name).split(' ');
  const ini = ((w[0] || '').charAt(0) + (w[1] ? w[1].charAt(0) : '')).toUpperCase() || '?';
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `<span class="th" style="background:hsl(${h} 42% 20%);color:hsl(${h} 85% 72%)">${KS.esc(ini)}</span>`;
};

/* ---------- penyimpanan ----------
   Semua akses data lewat KS.Store. Kalau nanti pindah ke IndexedDB atau
   server, cukup ganti bagian ini. */
const SCHEMA = 1;
const KEY_D = 'kasirstruk:data', KEY_S = 'kasirstruk:settings';
const read = k => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };

function migrate(d) {
  d = d && typeof d === 'object' ? d : {};
  d.schema = SCHEMA;
  ['products', 'sales', 'purchases'].forEach(k => { if (!Array.isArray(d[k])) d[k] = []; });
  d.products.forEach(p => { p.alias = Array.isArray(p.alias) ? p.alias : []; if (p.min == null) p.min = 5; });
  return d;
}

KS.Store = {
  data: null,
  settings: null,
  load() {
    this.data = migrate(read(KEY_D));
    this.settings = Object.assign({ toko: '', apiKey: '', model: 'claude-haiku-5-5', seenVersion: '', lastBackup: 0 }, read(KEY_S) || {});
  },
  save() { return write(KEY_D, this.data); },
  saveSettings() { return write(KEY_S, this.settings); },
  replace(d) { this.data = migrate(d); return this.save(); }
};

/* ---------- cadangan berupa file ---------- */
KS.Backup = {
  make() {
    return { app: 'kasir-struk', schema: SCHEMA, exportedAt: new Date().toISOString(), toko: KS.Store.settings.toko, data: KS.Store.data };
  },
  download() {
    const name = 'kasir-struk-' + new Date().toISOString().slice(0, 10) + '.json';
    const blob = new Blob([JSON.stringify(this.make(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    return name;
  },
  parse(text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { throw new Error('File ini bukan file cadangan yang valid.'); }
    if (!o || o.app !== 'kasir-struk' || !o.data || !Array.isArray(o.data.products) || !Array.isArray(o.data.sales)) {
      throw new Error('File ini bukan cadangan Kasir Struk.');
    }
    if (o.schema > SCHEMA) throw new Error('Cadangan ini dari versi aplikasi yang lebih baru. Perbarui aplikasi dulu.');
    return o;
  }
};

/* ---------- pencocokan nama barang di struk dengan stok ---------- */
function tokMatch(a, b) {
  if (a === b) return true;
  const s = a.length <= b.length ? a : b, l = a.length <= b.length ? b : a;
  if (s.length < 3) return false;
  if (l.indexOf(s) === 0) return true;
  if (s.charAt(0) !== l.charAt(0)) return false;
  let i = 0;
  for (let k = 0; k < l.length && i < s.length; k++) { if (l.charAt(k) === s.charAt(i)) i++; }
  return i === s.length;
}
function score(a, b) {
  const ta = KS.norm(a).split(' '), tb = KS.norm(b).split(' '), used = {};
  let m = 0;
  ta.forEach(x => {
    for (let j = 0; j < tb.length; j++) { if (!used[j] && tokMatch(x, tb[j])) { used[j] = 1; m++; break; } }
  });
  return m / Math.max(ta.length, tb.length);
}
KS.findMatch = name => {
  const n = KS.norm(name);
  if (!n) return { status: 'new', id: null };
  const P = KS.Store.data.products;
  for (const p of P) {
    if (KS.norm(p.name) === n || p.alias.some(a => KS.norm(a) === n)) return { status: 'ok', id: p.id };
  }
  let best = null, bs = 0;
  P.forEach(p => { const s = score(n, p.name); if (s > bs) { bs = s; best = p; } });
  return bs >= 0.6 ? { status: 'check', id: best.id } : { status: 'new', id: null };
};

/* ---------- data contoh (opsional, dari Pengaturan) ---------- */
KS.sampleData = () => {
  const P = [
    { name: 'Indomie Goreng', modal: 2800, jual: 3500, stok: 24, alias: ['IDM GRG'] },
    { name: 'Aqua 600ml', modal: 2700, jual: 4000, stok: 36, alias: [] },
    { name: 'Teh Pucuk Harum 350ml', modal: 3100, jual: 4500, stok: 12, alias: [] },
    { name: 'Gula Pasir 1kg', modal: 16500, jual: 18000, stok: 8, alias: [] },
    { name: 'Minyak Goreng 1L', modal: 16000, jual: 18500, stok: 10, alias: [] },
    { name: 'Telur Ayam 1kg', modal: 27000, jual: 30000, stok: 3, alias: [] },
    { name: 'Kopi Kapal Api Sachet', modal: 1200, jual: 1500, stok: 40, alias: [] },
    { name: 'Susu Ultra Coklat 200ml', modal: 4800, jual: 6000, stok: 18, alias: [] }
  ].map(p => Object.assign(p, { id: KS.uid(), min: 5 }));
  const by = n => P.find(p => p.name.indexOf(n) === 0);
  const now = Date.now();
  const mk = (ago, lines) => {
    const items = lines.map(l => { const p = by(l[0]); return { id: p.id, name: p.name, qty: l[1], jual: p.jual, modal: p.modal }; });
    const total = KS.sum(items, i => i.qty * i.jual);
    return { id: KS.uid(), t: now - ago * 60000, items, total, paid: total };
  };
  return { products: P, purchases: [], sales: [mk(120, [['Indomie', 3], ['Aqua', 2]]), mk(60, [['Gula', 1], ['Minyak', 1]]), mk(15, [['Kopi', 6], ['Teh', 2]])] };
};
})();
