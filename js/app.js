/* app.js: tampilan dan alur aplikasi.
   Prinsip: saat mengetik, hanya state dan bagian kecil layar yang diperbarui
   (tidak menggambar ulang seluruh halaman), supaya tidak terasa macet. */
(function () {
'use strict';
const KS = window.KS;
const { $, esc, rp, uid, num, sum, norm, title, tile, isToday } = KS;
const S = () => KS.Store.data;
const ST = () => KS.Store.settings;
KS.Store.load();
if (!ST().seenVersion) { ST().seenVersion = KS.APP_VERSION; KS.Store.saveSettings(); }

const ui = { tab: 'kasir', q: '', qs: '', cart: {}, sheet: null, review: null, busy: null, error: null, photo: null, range: 'hari' };
let lastKey = '', installEvt = null, toastT;

const persist = () => { if (!KS.Store.save()) toast('Penyimpanan HP penuh. Data belum tersimpan, buat file cadangan.'); };
const prod = id => S().products.find(p => p.id === id);
const today = () => new Date().toISOString().slice(0, 10);
const needBackup = () => S().products.length > 0 && (!ST().lastBackup || Date.now() - ST().lastBackup > 7 * 864e5);

/* ---------- ikon dan tab ---------- */
const IC = {
  kasir: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M3 3h2.4l2.2 11.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 7H6"/>',
  stok: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
  struk: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  laporan: '<path d="M5 20V11"/><path d="M12 20V4"/><path d="M19 20v-6"/>',
  tools: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><path d="M16.5 13v7M13 16.5h7"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'
};
const TABS = [['kasir', 'Kasir'], ['stok', 'Stok'], ['struk', 'Struk'], ['laporan', 'Laporan'], ['tools', 'Tools']];
const TITLE = { kasir: 'Kasir', stok: 'Stok barang', struk: 'Foto struk', laporan: 'Laporan', tools: 'Tools' };
$('#tabs').innerHTML = TABS.map(t => {
  const svg = `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[t[0]]}</svg>`;
  return t[0] === 'struk'
    ? `<button class="tb mid" data-act="tab" data-t="struk"><span class="disc">${svg}</span><span>${t[1]}</span></button>`
    : `<button class="tb" data-act="tab" data-t="${t[0]}">${svg}<span>${t[1]}</span></button>`;
}).join('');

/* ---------- Kasir ---------- */
function cartLines() {
  return Object.keys(ui.cart).map(id => ({ p: prod(id), n: ui.cart[id] })).filter(l => l.p && l.n > 0);
}
function gridHTML() {
  if (!S().products.length) return '<div class="empty" style="grid-column:1/-1">Belum ada barang.<br>Isi stok lewat tab Struk, atau tambah manual di tab Stok.</div>';
  const q = norm(ui.q);
  const list = S().products.filter(p => !q || norm(p.name).includes(q) || p.alias.some(a => norm(a).includes(q)));
  if (!list.length) return '<div class="empty" style="grid-column:1/-1">Tidak ada barang bernama itu.</div>';
  return list.map(p => {
    const n = ui.cart[p.id] || 0, out = p.stok <= 0;
    return `<button class="pc${n ? ' in' : ''}${out ? ' out' : ''}" data-act="add" data-id="${p.id}"${out ? ' disabled' : ''}>` +
      `${tile(p.name)}<span class="pn">${esc(p.name)}</span><span><span class="pp">${rp(p.jual)}</span><br><span class="ps">${out ? 'Habis' : 'Stok ' + p.stok}</span></span>` +
      `${n ? `<span class="q">${n}</span>` : ''}</button>`;
  }).join('');
}
function viewKasir() {
  return `<div class="srch"><input id="q-kasir" data-f="q" placeholder="Cari barang…" value="${esc(ui.q)}" autocomplete="off"></div><div class="grid" id="grid">${gridHTML()}</div>`;
}
function dockKasir() {
  const L = cartLines();
  if (!L.length) return '';
  return `<button class="btn big dock-btn" data-act="pay"><span>${sum(L, l => l.n)} barang</span><b>${rp(sum(L, l => l.n * l.p.jual))}</b><span>Bayar</span></button>`;
}

/* ---------- Stok ---------- */
function stokListHTML() {
  const q = norm(ui.qs);
  const list = S().products.slice().sort((a, b) => a.name.localeCompare(b.name))
    .filter(p => !q || norm(p.name).includes(q) || p.alias.some(a => norm(a).includes(q)));
  if (!S().products.length) return '<div class="empty">Belum ada barang.<br>Foto struk atau tambah manual.</div>';
  if (!list.length) return '<div class="empty">Tidak ada barang bernama itu.</div>';
  return list.map(p => {
    const m = p.modal > 0 ? Math.round((p.jual - p.modal) / p.modal * 100) : 0;
    return `<button class="row" data-act="edit" data-id="${p.id}">${tile(p.name)}<div class="grow"><div class="t">${esc(p.name)}</div>` +
      `<div class="s">Modal ${rp(p.modal)} · Jual ${rp(p.jual)} · untung ${m}%</div></div>` +
      `<span class="pill${p.stok <= p.min ? ' low' : ''}">${p.stok} pcs</span></button>`;
  }).join('');
}
function viewStok() {
  const low = S().products.filter(p => p.stok <= p.min).length;
  return `<div class="sum"><div><b>${S().products.length}</b><span>jenis barang</span></div><div><b>${low}</b><span>stok menipis</span></div>` +
    `<div><b>${rp(sum(S().products, p => p.modal * p.stok)).replace('Rp', '')}</b><span>nilai modal (Rp)</span></div></div>` +
    `<div class="srch"><input id="q-stok" data-f="qs" placeholder="Cari barang…" value="${esc(ui.qs)}" autocomplete="off"><button class="btn sm" data-act="newprod">+ Barang</button></div>` +
    `<div id="stoklist">${stokListHTML()}</div>`;
}

/* ---------- Struk ---------- */
function viewStruk() {
  if (ui.busy) {
    return `<div class="read">${ui.photo ? `<img src="${ui.photo}" alt="Foto struk">` : ''}<div class="spin"></div><b>${esc(ui.busy.msg)}</b><p class="hint">Biasanya beberapa detik.</p></div>`;
  }
  if (ui.error) {
    return `<div class="errbox"><p>${esc(ui.error)}</p><div class="btnrow"><button class="btn" data-act="cam">Foto ulang</button><button class="btn ghost" data-act="gal">Dari galeri</button></div>` +
      `<div class="link"><button class="chip" data-act="manual">Isi manual saja</button></div></div>`;
  }
  if (ui.review) return viewReview();
  return `<div class="hero"><h2>Belanja stok dari struk</h2><p>Foto struk minimarket. Barang terbaca otomatis, kamu cek dulu, baru masuk stok.</p>` +
    `<button class="btn" data-act="cam">Foto struk</button>` +
    `<div class="alt"><button class="btn ghost" data-act="gal">Pilih dari galeri</button><button class="btn ghost" data-act="manual">Isi manual</button></div>` +
    `<div class="link"><button class="chip" data-act="demo">Coba struk contoh</button></div></div>`;
}
const mkItem = (raw, qty, price) => {
  const m = KS.findMatch(raw);
  return { id: uid(), raw, name: m.status === 'new' ? title(raw) : raw, qty, price, jual: '', status: m.status, matchId: m.id };
};
function demoReceipt() {
  const raw = [['IDM GRG', 20, 2850], ['AQUA 600ML', 24, 2700], ['TEH PUCUK 350', 12, 3150], ['GULA PSR 1KG', 10, 16900], ['SUNLIGHT JRK NPIS 700ML', 3, 14500], ['KECAP BANGO 275ML', 4, 9800]];
  return { store: 'Minimarket Sejahtera', date: today(), total: 411300, photo: null, demo: true, items: raw.map(r => mkItem(r[0], r[1], r[2])) };
}
function okNote(it, p) {
  return `Barang lama: <b>${esc(p.name)}</b><br>Stok ${p.stok} → <b>${p.stok + it.qty}</b> · modal ${rp(p.modal)} → <b>${rp(it.price)}</b><br>Harga jual tetap ${rp(p.jual)}`;
}
function mhText(it) {
  const jl = num(it.jual);
  return it.price > 0 && jl > 0 ? `Untung ${Math.round((jl - it.price) / it.price * 100)}%` : '';
}
function itemHTML(it) {
  const p = it.matchId ? prod(it.matchId) : null;
  const st = (it.status === 'ok' || it.status === 'check') && !p ? 'new' : it.status;
  const label = { ok: 'Cocok', check: 'Perlu dicek', new: 'Barang baru' }[st];
  let note = '';
  if (st === 'ok') note = `<div class="note ok" id="nt-${it.id}">${okNote(it, p)}</div>`;
  if (st === 'check') {
    note = `<div class="note check">Maksud kamu <b>${esc(p.name)}</b>?<div class="btns"><button class="btn sm" data-act="accept" data-id="${it.id}">Ya, itu</button><button class="btn sm ghost" data-act="asnew" data-id="${it.id}">Barang baru</button></div></div>`;
  }
  if (st === 'new') {
    note = `<div class="note new"><label for="jl-${it.id}">Barang baru. Isi harga jual</label>` +
      `<div class="jl"><span>Rp</span><input id="jl-${it.id}" data-f="jual" data-id="${it.id}" inputmode="numeric" value="${esc(it.jual)}" placeholder="0"></div>` +
      `<div class="chips">${[10, 20, 30].map(pc => `<button class="chip" data-act="margin" data-id="${it.id}" data-pct="${pc}">+${pc}%</button>`).join('')}<span class="hint" id="mh-${it.id}">${mhText(it)}</span></div></div>`;
  }
  const showRaw = it.raw && norm(it.raw) !== norm(it.name);
  return `<div class="it ${st}" id="it-${it.id}"><div class="it-h"><span class="bd ${st}">${label}</span><span class="sub" id="sub-${it.id}">${rp(it.qty * it.price)}</span>` +
    `<button class="x" data-act="rm" data-id="${it.id}" aria-label="Hapus item">×</button></div>` +
    `<input class="nm" id="nm-${it.id}" data-f="name" data-id="${it.id}" value="${esc(it.name)}" placeholder="Nama barang">` +
    (showRaw ? `<div class="raw">Tertulis di struk: ${esc(it.raw)}</div>` : '') +
    `<div class="nums"><div class="stp"><button data-act="qty" data-id="${it.id}" data-d="-1" aria-label="Kurangi">−</button>` +
    `<input id="qty-${it.id}" data-f="qty" data-id="${it.id}" inputmode="numeric" value="${it.qty || ''}" aria-label="Jumlah">` +
    `<button data-act="qty" data-id="${it.id}" data-d="1" aria-label="Tambah">+</button></div><span class="times">×</span>` +
    `<div class="pr"><span>Rp</span><input id="pr-${it.id}" data-f="price" data-id="${it.id}" inputmode="numeric" value="${it.price || ''}" placeholder="harga satuan" aria-label="Harga satuan"></div></div>` +
    `${note}</div>`;
}
function totHTML() {
  const R = ui.review, calc = sum(R.items, i => i.qty * i.price);
  if (!R.total) return `<div class="tot idle" id="totbox">Isi total di struk untuk pengecekan otomatis. Total item: ${rp(calc)}</div>`;
  if (calc === R.total) return `<div class="tot ok" id="totbox">Total cocok dengan struk: ${rp(calc)}</div>`;
  return `<div class="tot bad" id="totbox">Total item ${rp(calc)}, di struk ${rp(R.total)}. Selisih ${rp(Math.abs(calc - R.total))}. Cek lagi item di bawah.</div>`;
}
function viewReview() {
  const R = ui.review, cnt = { ok: 0, check: 0, new: 0 };
  R.items.forEach(i => { cnt[i.status] = (cnt[i.status] || 0) + 1; });
  return (R.demo ? '<div class="demo">Mode contoh: isi di bawah adalah struk contoh, bukan dari foto.</div>' : '') +
    `<div class="paper"><div class="top">${R.photo ? `<img class="thumb" src="${R.photo}" alt="Foto struk">` : ''}` +
    `<div><label for="st-store">Toko</label><input class="fld" id="st-store" data-f="store" value="${esc(R.store)}"></div>` +
    `<div><label for="st-date">Tanggal</label><input class="fld" id="st-date" type="date" data-f="date" value="${esc(R.date)}"></div></div>` +
    `<label for="st-total">Total di struk (Rp)</label><input class="fld" id="st-total" data-f="total" inputmode="numeric" value="${R.total || ''}">${totHTML()}</div>` +
    `<div class="cnt">${R.items.length} item · ${cnt.ok} cocok · ${cnt.check} perlu dicek · ${cnt.new} baru</div>` +
    R.items.map(itemHTML).join('') +
    `<button class="addrow" data-act="addrow">+ Tambah item manual</button>` +
    `<div class="link"><button class="chip" data-act="cancelreview">Ulangi dari awal</button></div>`;
}
function issues() {
  const R = ui.review;
  let pending = 0, needJual = 0, bad = 0;
  R.items.forEach(it => {
    if (it.qty <= 0 || it.price <= 0 || !it.name.trim()) bad++;
    else if (it.status === 'check') pending++;
    else if (it.status === 'new' && num(it.jual) <= 0) needJual++;
  });
  let msg = '';
  if (!R.items.length) msg = 'Belum ada item.';
  else if (bad) msg = `${bad} item belum lengkap (nama, jumlah, atau harga kosong).`;
  else if (pending) msg = `${pending} item perlu dikonfirmasi dulu.`;
  else if (needJual) msg = `Isi harga jual untuk ${needJual} barang baru.`;
  return { blocked: !!msg, msg };
}
function dockStruk() {
  if (!ui.review || ui.busy) return '';
  const is = issues();
  return (is.msg ? `<div class="issue">${is.msg}</div>` : '') +
    `<button class="btn big" data-act="savereview"${is.blocked ? ' disabled' : ''}><span>Simpan ke stok</span><span>${ui.review.items.length} item</span></button>`;
}
const reviewItem = id => ui.review.items.find(i => i.id === id);
function refreshTotals() {
  const tb = $('#totbox');
  if (tb) tb.outerHTML = totHTML();
  $('#dock').innerHTML = dockStruk();
}
function refreshItem(id) {
  const it = reviewItem(id);
  if (!it) return;
  const sub = $('#sub-' + id); if (sub) sub.textContent = rp(it.qty * it.price);
  const nt = $('#nt-' + id); if (nt && it.status === 'ok') { const p = prod(it.matchId); if (p) nt.innerHTML = okNote(it, p); }
  const mh = $('#mh-' + id); if (mh) mh.textContent = mhText(it);
  refreshTotals();
}

async function processFile(file) {
  if (ui.photo) { try { URL.revokeObjectURL(ui.photo); } catch (e) {} }
  try { ui.photo = URL.createObjectURL(file); } catch (e) { ui.photo = null; }
  ui.tab = 'struk'; ui.review = null; ui.error = null; ui.busy = { msg: 'Membaca struk…' };
  draw();
  try {
    const r = await KS.OCR.read(file, ST());
    if (!r.items.length) throw new Error('Tidak ada barang yang terbaca. Coba foto lebih dekat dan terang, pastikan struk rata.');
    ui.review = { store: r.toko, date: r.tanggal || today(), total: r.total, photo: ui.photo, demo: false, items: r.items.map(i => mkItem(i.nama, i.qty, i.harga)) };
  } catch (e) { ui.error = e.message || 'Gagal membaca struk.'; }
  ui.busy = null;
  draw();
}
function addAlias(p, raw) {
  if (raw && norm(raw) !== norm(p.name) && !p.alias.some(a => norm(a) === norm(raw))) p.alias.push(raw);
}
function saveReview() {
  if (issues().blocked) return;
  const R = ui.review, lines = [];
  R.items.forEach(it => {
    let p;
    if (it.status === 'ok' && prod(it.matchId)) {
      p = prod(it.matchId); p.stok += it.qty; p.modal = it.price; addAlias(p, it.raw);
    } else {
      p = { id: uid(), name: it.name.trim(), modal: it.price, jual: num(it.jual), stok: it.qty, min: 5, alias: [] };
      addAlias(p, it.raw); S().products.push(p);
    }
    lines.push({ id: p.id, name: p.name, qty: it.qty, price: it.price });
  });
  S().purchases.push({ id: uid(), t: Date.now(), store: R.store, date: R.date, total: sum(lines, l => l.qty * l.price), items: lines });
  persist(); ui.review = null; ui.photo = null; ui.tab = 'stok'; draw(); toast(`${lines.length} barang masuk stok`);
}

/* ---------- Laporan ---------- */
function viewLap() {
  const sales = S().sales.filter(s => ui.range === 'semua' || isToday(s.t));
  const omzet = sum(sales, s => s.total);
  const laba = sum(sales, s => sum(s.items, i => (i.jual - i.modal) * i.qty));
  const cnt = {};
  sales.forEach(s => s.items.forEach(i => { cnt[i.name] = (cnt[i.name] || 0) + i.qty; }));
  const top = Object.keys(cnt).map(k => [k, cnt[k]]).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const mx = top.length ? top[0][1] : 1;
  const time = t => new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const recent = sales.slice().reverse().slice(0, 6).map(s => `<div class="row"><div class="grow"><div class="t">${rp(s.total)}</div><div class="s">${s.items.length} jenis · ${time(s.t)}</div></div></div>`).join('');
  const buys = S().purchases.slice().reverse().slice(0, 5).map(b => `<div class="row"><div class="grow"><div class="t">${esc(b.store || 'Belanja stok')}</div><div class="s">${esc(b.date)} · ${b.items.length} barang</div></div><b>${rp(b.total)}</b></div>`).join('');
  return `<div class="seg"><button class="${ui.range === 'hari' ? 'on' : ''}" data-act="range" data-r="hari">Hari ini</button><button class="${ui.range === 'semua' ? 'on' : ''}" data-act="range" data-r="semua">Semua</button></div>` +
    `<div class="stats"><div class="stat wide"><span>Omzet</span><b>${rp(omzet)}</b></div><div class="stat"><span>Laba</span><b>${rp(laba)}</b></div><div class="stat"><span>Transaksi</span><b>${sales.length}</b></div></div>` +
    `<div class="sec"><h3>Barang terlaris</h3>${top.length ? top.map(t => `<div class="top5"><span class="n">${esc(t[0])}</span><span class="b"><i style="width:${Math.round(t[1] / mx * 100)}%"></i></span><span class="v">${t[1]}</span></div>`).join('') : '<div class="hint">Belum ada penjualan.</div>'}</div>` +
    `<div class="sec"><h3>Transaksi terakhir</h3>${recent || '<div class="hint">Belum ada transaksi.</div>'}</div>` +
    `<div class="sec"><h3>Belanja stok dari struk</h3>${buys || '<div class="hint">Belum ada struk yang disimpan.</div>'}</div>`;
}

/* ---------- Tools ---------- */
const isNew = v => KS.cmpVer(v, ST().seenVersion) > 0;
function viewTools() {
  return `<button class="ver" data-act="changelog"><div><b>Versi ${KS.APP_VERSION}</b><span>Lihat apa yang baru</span></div>${isNew(KS.APP_VERSION) ? '<i class="new-badge">Baru</i>' : ''}</button>` +
    `<div class="tools">${KS.Tools.list.map(t => `<button class="tool" data-act="tool" data-id="${t.id}">${isNew(t.since) ? '<i class="new-badge">Baru</i>' : ''}<svg viewBox="0 0 24 24" aria-hidden="true">${t.icon}</svg><b>${esc(t.name)}</b><span>${esc(t.desc)}</span></button>`).join('')}</div>`;
}
const api = {
  getData: () => S(), esc, rp, num, toast: m => toast(m)
};

/* ---------- panel bawah (sheet) ---------- */
function payInfo() {
  const L = cartLines(), total = sum(L, l => l.n * l.p.jual);
  return { L, total, cash: num(ui.sheet.cash) };
}
function chgHTML() {
  const { total, cash } = payInfo(), ch = cash - total;
  return cash ? `<div class="change${ch < 0 ? ' short' : ''}"><span>${ch < 0 ? 'Kurang' : 'Kembalian'}</span><span>${rp(Math.abs(ch))}</span></div>` : '';
}
function dmhText() {
  const d = ui.sheet.draft, m = num(d.modal), j = num(d.jual);
  return m > 0 && j > 0 ? `Untung ${Math.round((j - m) / m * 100)}% · ${rp(j - m)} per pcs` : '';
}
function fmtDate(t) { return new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); }

function sheetHTML() {
  const sh = ui.sheet;
  const head = (t) => `<div class="panel-hd"><h2>${t}</h2><button class="x" data-act="close" aria-label="Tutup">×</button></div>`;
  if (sh.type === 'pay') {
    const { L, total, cash } = payInfo();
    let opts = [total];
    [5000, 10000, 20000, 50000, 100000].forEach(r => { const v = Math.ceil(total / r) * r; if (!opts.includes(v)) opts.push(v); });
    opts = opts.slice(0, 4);
    return `<div class="panel">${head('Bayar')}<div class="panel-body">` +
      L.map(l => `<div class="line"><div class="grow"><div class="t">${esc(l.p.name)}</div><div class="hint">${rp(l.p.jual)}</div></div>` +
        `<div class="stp"><button data-act="cq" data-id="${l.p.id}" data-d="-1" aria-label="Kurangi">−</button><input value="${l.n}" readonly aria-label="Jumlah"><button data-act="cq" data-id="${l.p.id}" data-d="1" aria-label="Tambah">+</button></div>` +
        `<b style="width:78px;text-align:right">${rp(l.n * l.p.jual)}</b></div>`).join('') +
      `<div class="total"><span>Total</span><b>${rp(total)}</b></div>` +
      `<label for="cash">Uang diterima (Rp)</label><input class="fld" id="cash" data-f="cash" inputmode="numeric" value="${cash || ''}" placeholder="0">` +
      `<div class="chips">${opts.map((v, i) => `<button class="chip" data-act="cashchip" data-v="${v}">${i === 0 ? 'Uang pas' : rp(v)}</button>`).join('')}</div>` +
      `<div id="paychg">${chgHTML()}</div></div>` +
      `<div class="panel-ft"><button class="btn big" id="payfin" data-act="finish"${cash < total || !total ? ' disabled' : ''}><span>Selesai</span><span>${rp(total)}</span></button></div></div>`;
  }
  if (sh.type === 'prod') {
    const d = sh.draft;
    return `<div class="panel">${head(sh.id ? 'Ubah barang' : 'Barang baru')}<div class="panel-body">` +
      `<label for="d-name">Nama barang</label><input class="fld" id="d-name" data-f="d-name" value="${esc(d.name)}">` +
      `<label for="d-modal">Harga modal (Rp)</label><input class="fld" id="d-modal" data-f="d-modal" inputmode="numeric" value="${esc(d.modal)}">` +
      `<label for="d-jual">Harga jual (Rp)</label><input class="fld" id="d-jual" data-f="d-jual" inputmode="numeric" value="${esc(d.jual)}">` +
      `<div class="hint" id="dmh" style="margin-top:4px">${dmhText()}</div>` +
      `<label for="d-stok">Stok (pcs)</label><input class="fld" id="d-stok" data-f="d-stok" inputmode="numeric" value="${esc(d.stok)}">` +
      `<label for="d-alias">Nama lain di struk (pisahkan koma)</label><input class="fld" id="d-alias" data-f="d-alias" value="${esc(d.alias)}" placeholder="mis. IDM GRG"></div>` +
      `<div class="panel-ft" style="display:flex;gap:8px">${sh.id ? `<button class="btn danger" data-act="${sh.confirmDel ? 'delprod' : 'confirmdel'}">${sh.confirmDel ? 'Yakin hapus?' : 'Hapus'}</button>` : ''}<button class="btn" style="flex:1" data-act="saveprod">Simpan</button></div></div>`;
  }
  if (sh.type === 'tool') {
    const t = KS.Tools.list.find(x => x.id === sh.id);
    return `<div class="panel">${head(esc(t.name))}<div class="panel-body" id="toolbody"></div></div>`;
  }
  if (sh.type === 'settings') {
    const s = ST(), d = S();
    return `<div class="panel">${head('Pengaturan')}<div class="panel-body">` +
      `<label for="s-toko">Nama toko</label><input class="fld" id="s-toko" data-f="s-toko" value="${esc(s.toko)}" placeholder="mis. Warung Berkah">` +
      `<div class="set-sec"><h3>Baca struk otomatis</h3>` +
      `<label for="s-key">Kunci API Anthropic</label><div class="keyrow"><input class="fld" id="s-key" type="password" data-f="s-key" value="${esc(s.apiKey)}" placeholder="sk-ant-…" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="btn ghost sm" data-act="togglekey">Lihat</button></div>` +
      `<label for="s-model">Model</label><input class="fld" id="s-model" data-f="s-model" value="${esc(s.model)}" autocapitalize="off" spellcheck="false">` +
      `<p class="hint">Kunci hanya tersimpan di HP ini dan tidak ikut file cadangan. Tiap struk yang dibaca dikenai biaya kecil dari akun API-mu.</p></div>` +
      `<div class="set-sec"><h3>Data dan cadangan</h3>` +
      `<div class="kv"><span>Barang</span><b>${d.products.length}</b></div><div class="kv"><span>Transaksi</span><b>${d.sales.length}</b></div>` +
      `<div class="kv"><span>Cadangan terakhir</span><b>${s.lastBackup ? fmtDate(s.lastBackup) : 'Belum pernah'}</b></div>` +
      `<div class="btnrow"><button class="btn" data-act="backup">Simpan file cadangan</button><button class="btn ghost" data-act="restorepick">Pulihkan dari file</button></div>` +
      `${!d.products.length ? '<button class="btn ghost" style="width:100%;margin-top:8px" data-act="seed">Isi data contoh</button>' : ''}</div>` +
      `<div class="set-sec"><h3>Aplikasi</h3><div class="kv"><span>Versi</span><b>${KS.APP_VERSION}</b></div>` +
      `<div class="btnrow"><button class="btn ghost" data-act="changelog">Apa yang baru</button>${installEvt ? '<button class="btn" data-act="install">Pasang ke layar utama</button>' : ''}</div></div>` +
      `</div></div>`;
  }
  if (sh.type === 'restore') {
    const o = sh.obj, d = o.data;
    return `<div class="panel">${head('Pulihkan data')}<div class="panel-body">` +
      `<p>File cadangan ini berisi:</p>` +
      `<div class="kv"><span>Tanggal cadangan</span><b>${fmtDate(o.exportedAt)}</b></div>` +
      `${o.toko ? `<div class="kv"><span>Toko</span><b>${esc(o.toko)}</b></div>` : ''}` +
      `<div class="kv"><span>Barang</span><b>${d.products.length}</b></div><div class="kv"><span>Transaksi</span><b>${d.sales.length}</b></div>` +
      `<p class="hint">Data yang ada di HP ini sekarang akan diganti seluruhnya.</p></div>` +
      `<div class="panel-ft" style="display:flex;gap:8px"><button class="btn ghost" data-act="close">Batal</button><button class="btn danger" style="flex:1" data-act="dorestore">Ganti data sekarang</button></div></div>`;
  }
  if (sh.type === 'changelog') {
    return `<div class="panel">${head('Apa yang baru')}<div class="panel-body">` +
      KS.CHANGELOG.map(c => `<div class="cl"><h3>Versi ${esc(c.v)}: ${esc(c.title)}</h3><div class="d">${esc(c.date)}</div><ul>${c.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>`).join('') +
      `</div></div>`;
  }
  return '';
}
function drawSheet() {
  const el = $('#sheet'), sh = ui.sheet;
  if (!sh) { el.className = ''; el.innerHTML = ''; lastKey = ''; return; }
  const key = sh.type === 'tool' ? 'tool:' + sh.id : '';
  if (key && key === lastKey) return;
  lastKey = key;
  const was = el.classList.contains('open');
  const pb = el.querySelector('.panel-body'), st = pb ? pb.scrollTop : 0;
  el.className = 'open' + (was ? '' : ' anim');
  el.innerHTML = sheetHTML();
  const nb = el.querySelector('.panel-body');
  if (nb && was) nb.scrollTop = st;
  if (sh.type === 'tool') KS.Tools.list.find(x => x.id === sh.id).render($('#toolbody'), api);
}

/* ---------- gambar ulang ---------- */
function hdHTML() {
  const d = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });
  return `<h1>${TITLE[ui.tab]}</h1><div class="right"><span class="dt">${d}</span>` +
    `<button class="gear" data-act="settings" aria-label="Pengaturan"><svg viewBox="0 0 24 24" aria-hidden="true">${IC.gear}</svg>${needBackup() ? '<i class="dot"></i>' : ''}</button></div>`;
}
function draw() {
  const main = $('#main'), st = main.scrollTop;
  $('#hd').innerHTML = hdHTML();
  main.innerHTML = { kasir: viewKasir, stok: viewStok, struk: viewStruk, laporan: viewLap, tools: viewTools }[ui.tab]();
  main.scrollTop = st;
  $('#dock').innerHTML = ui.tab === 'kasir' ? dockKasir() : ui.tab === 'struk' ? dockStruk() : '';
  document.querySelectorAll('.tb').forEach(b => b.classList.toggle('on', b.getAttribute('data-t') === ui.tab));
  drawSheet();
}
function rerender() {
  const a = document.activeElement, id = a && a.id;
  let s = null, e = null;
  try { s = a.selectionStart; e = a.selectionEnd; } catch (_) {}
  draw();
  if (id) { const n = document.getElementById(id); if (n) { n.focus(); try { if (s != null) n.setSelectionRange(s, e); } catch (_) {} } }
}
function toast(m) {
  const t = $('#toast');
  t.textContent = m; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ---------- aksi ---------- */
function openProd(id) {
  const p = id ? prod(id) : null;
  ui.sheet = { type: 'prod', id: id || null, confirmDel: false, draft: p ? { name: p.name, modal: p.modal, jual: p.jual, stok: p.stok, alias: p.alias.join(', ') } : { name: '', modal: '', jual: '', stok: '', alias: '' } };
  draw();
}
function saveProd() {
  const sh = ui.sheet, d = sh.draft;
  if (!d.name.trim()) { toast('Nama barang belum diisi'); return; }
  if (num(d.jual) <= 0) { toast('Harga jual belum diisi'); return; }
  const alias = String(d.alias).split(',').map(s => s.trim()).filter(Boolean);
  const o = { name: d.name.trim(), modal: num(d.modal), jual: num(d.jual), stok: num(d.stok), alias };
  if (sh.id) Object.assign(prod(sh.id), o); else S().products.push(Object.assign(o, { id: uid(), min: 5 }));
  persist(); ui.sheet = null; draw(); toast('Barang disimpan');
}
function askPhoto(kind) {
  if (!ST().apiKey) {
    ui.sheet = { type: 'settings' }; draw();
    toast('Isi kunci API dulu untuk membaca struk');
    setTimeout(() => { const k = $('#s-key'); if (k) k.focus(); }, 60);
    return;
  }
  $(kind === 'cam' ? '#cam' : '#gal').click();
}

document.addEventListener('click', e => {
  if (e.target.id === 'sheet') { ui.sheet = null; draw(); return; }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.getAttribute('data-act'), id = b.getAttribute('data-id');
  switch (act) {
    case 'tab': ui.tab = b.getAttribute('data-t'); $('#main').scrollTop = 0; draw(); break;
    case 'settings': ui.sheet = { type: 'settings' }; draw(); break;
    case 'add': {
      const p = prod(id), n = ui.cart[id] || 0;
      if (n < p.stok) { ui.cart[id] = n + 1; draw(); } else toast('Stok tinggal ' + p.stok);
      break;
    }
    case 'pay': ui.sheet = { type: 'pay', cash: '' }; draw(); break;
    case 'cq': {
      const p = prod(id), c = (ui.cart[id] || 0) + (b.getAttribute('data-d') === '1' ? 1 : -1);
      if (c > p.stok) { toast('Stok tinggal ' + p.stok); break; }
      if (c <= 0) delete ui.cart[id]; else ui.cart[id] = c;
      if (!cartLines().length) ui.sheet = null;
      draw(); break;
    }
    case 'cashchip': ui.sheet.cash = b.getAttribute('data-v'); draw(); break;
    case 'finish': {
      const { L, total, cash } = payInfo();
      if (!L.length || cash < total) break;
      S().sales.push({ id: uid(), t: Date.now(), total, paid: cash, items: L.map(l => ({ id: l.p.id, name: l.p.name, qty: l.n, jual: l.p.jual, modal: l.p.modal })) });
      L.forEach(l => { l.p.stok -= l.n; });
      persist(); ui.cart = {}; ui.sheet = null; draw(); toast('Selesai. Kembalian ' + rp(cash - total));
      break;
    }
    case 'close': ui.sheet = null; draw(); break;
    case 'edit': openProd(id); break;
    case 'newprod': openProd(null); break;
    case 'saveprod': saveProd(); break;
    case 'confirmdel': ui.sheet.confirmDel = true; draw(); break;
    case 'delprod': {
      const pid = ui.sheet.id;
      S().products = S().products.filter(x => x.id !== pid); delete ui.cart[pid];
      persist(); ui.sheet = null; draw(); toast('Barang dihapus'); break;
    }
    case 'cam': askPhoto('cam'); break;
    case 'gal': askPhoto('gal'); break;
    case 'demo': ui.error = null; ui.photo = null; ui.review = demoReceipt(); draw(); break;
    case 'manual': ui.error = null; ui.photo = null; ui.review = { store: '', date: today(), total: 0, photo: null, demo: false, items: [] }; draw(); break;
    case 'accept': { reviewItem(id).status = 'ok'; rerender(); break; }
    case 'asnew': { const it = reviewItem(id); it.status = 'new'; it.matchId = null; it.name = title(it.raw || it.name); rerender(); break; }
    case 'margin': {
      const it = reviewItem(id);
      it.jual = String(Math.ceil(it.price * (1 + num(b.getAttribute('data-pct')) / 100) / 100) * 100);
      const f = $('#jl-' + id); if (f) f.value = it.jual;
      refreshItem(id); break;
    }
    case 'qty': {
      const it = reviewItem(id);
      it.qty = Math.max(0, it.qty + (b.getAttribute('data-d') === '1' ? 1 : -1));
      const f = $('#qty-' + id); if (f) f.value = it.qty || '';
      refreshItem(id); break;
    }
    case 'rm': ui.review.items = ui.review.items.filter(x => x.id !== id); rerender(); break;
    case 'addrow': {
      const nid = uid();
      ui.review.items.push({ id: nid, raw: '', name: '', qty: 1, price: 0, jual: '', status: 'new', matchId: null });
      draw();
      const f = document.getElementById('nm-' + nid);
      if (f) { f.focus(); f.scrollIntoView({ block: 'center' }); }
      break;
    }
    case 'cancelreview': ui.review = null; ui.error = null; ui.photo = null; draw(); break;
    case 'savereview': saveReview(); break;
    case 'range': ui.range = b.getAttribute('data-r'); draw(); break;
    case 'tool': ui.sheet = { type: 'tool', id }; draw(); break;
    case 'changelog':
      ST().seenVersion = KS.APP_VERSION; KS.Store.saveSettings();
      ui.sheet = { type: 'changelog' }; draw(); break;
    case 'togglekey': {
      const k = $('#s-key');
      if (k) { const show = k.type === 'password'; k.type = show ? 'text' : 'password'; b.textContent = show ? 'Sembunyi' : 'Lihat'; }
      break;
    }
    case 'backup': {
      const name = KS.Backup.download();
      ST().lastBackup = Date.now(); KS.Store.saveSettings();
      draw(); toast('File ' + name + ' disimpan. Cek folder Download.'); break;
    }
    case 'restorepick': $('#imp').click(); break;
    case 'dorestore':
      if (KS.Store.replace(ui.sheet.obj.data)) { ui.cart = {}; ui.review = null; ui.sheet = null; draw(); toast('Data berhasil dipulihkan'); }
      else toast('Gagal menyimpan. Penyimpanan HP penuh.');
      break;
    case 'seed':
      if (!S().products.length) { KS.Store.replace(KS.sampleData()); draw(); toast('Data contoh dimuat'); }
      break;
    case 'install':
      if (installEvt) { installEvt.prompt(); installEvt = null; ui.sheet = null; draw(); }
      break;
  }
});

document.addEventListener('input', e => {
  const t = e.target, f = t.getAttribute('data-f');
  if (!f) return;
  const id = t.getAttribute('data-id');
  switch (f) {
    case 'q': ui.q = t.value; $('#grid').innerHTML = gridHTML(); return;
    case 'qs': ui.qs = t.value; $('#stoklist').innerHTML = stokListHTML(); return;
    case 'cash': {
      ui.sheet.cash = t.value;
      const { total, cash } = payInfo();
      $('#paychg').innerHTML = chgHTML(); $('#payfin').disabled = !(total && cash >= total);
      return;
    }
    case 'name': reviewItem(id).name = t.value; return;
    case 'qty': case 'price': reviewItem(id)[f] = num(t.value); refreshItem(id); return;
    case 'jual': reviewItem(id).jual = t.value; refreshItem(id); return;
    case 'total': ui.review.total = num(t.value); refreshTotals(); return;
    case 'store': ui.review.store = t.value; return;
    case 'date': ui.review.date = t.value; return;
    case 'd-name': ui.sheet.draft.name = t.value; return;
    case 'd-alias': ui.sheet.draft.alias = t.value; return;
    case 'd-stok': ui.sheet.draft.stok = t.value; return;
    case 'd-modal': ui.sheet.draft.modal = t.value; $('#dmh').textContent = dmhText(); return;
    case 'd-jual': ui.sheet.draft.jual = t.value; $('#dmh').textContent = dmhText(); return;
    case 's-toko': ST().toko = t.value; KS.Store.saveSettings(); return;
    case 's-key': ST().apiKey = t.value.trim(); KS.Store.saveSettings(); return;
    case 's-model': ST().model = t.value.trim() || 'claude-haiku-5-5'; KS.Store.saveSettings(); return;
  }
});

document.addEventListener('change', e => {
  const t = e.target;
  if (t.getAttribute('data-f') === 'name') {
    const it = reviewItem(t.getAttribute('data-id'));
    it.name = t.value.trim();
    const m = KS.findMatch(it.name);
    it.status = m.status; it.matchId = m.id;
    rerender();
    return;
  }
  if (t.id === 'cam' || t.id === 'gal') {
    const file = t.files && t.files[0];
    t.value = '';
    if (file) processFile(file);
    return;
  }
  if (t.id === 'imp') {
    const file = t.files && t.files[0];
    t.value = '';
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try { ui.sheet = { type: 'restore', obj: KS.Backup.parse(String(r.result)) }; draw(); }
      catch (err) { toast(err.message); }
    };
    r.onerror = () => toast('File tidak bisa dibaca.');
    r.readAsText(file);
  }
});

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });

/* ---------- update aplikasi (service worker) ---------- */
function showUpdate(worker) {
  $('#upd').classList.add('show');
  $('#updbtn').onclick = () => worker.postMessage({ type: 'SKIP_WAITING' });
}
if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    const watch = w => w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(w); });
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => reg.installing && watch(reg.installing));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloaded) return; reloaded = true; location.reload(); });
}

draw();
})();
