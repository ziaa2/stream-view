/* tools.js: versi aplikasi, catatan update, dan daftar tool.
   Tool baru ditambahkan di sini lewat update aplikasi, bukan dari dalam panel.
   Setiap update: naikkan APP_VERSION (dan VERSION di sw.js), tambah entri di CHANGELOG,
   dan beri tool baru "since" sama dengan versi itu supaya muncul penanda "Baru". */
(function () {
'use strict';
const KS = window.KS;

KS.APP_VERSION = '1.0.0';

KS.CHANGELOG = [
  { v: '1.0.0', date: '2026-10-11', title: 'Versi pertama', notes: [
    'Kasir, stok, dan laporan harian.',
    'Foto struk jadi stok otomatis, dengan layar cek sebelum disimpan.',
    'Cadangan data berupa file.',
    'Tools: hitung harga jual dan stok menipis.'
  ] }
];

KS.Tools = { list: [], register(t) { this.list.push(t); } };

KS.Tools.register({
  id: 'harga', since: '1.0.0', name: 'Hitung harga jual', desc: 'Modal + target untung',
  icon: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2"/><circle cx="17" cy="17" r="2"/>',
  render(el, a) {
    el.innerHTML = '<label for="t-modal">Harga modal (Rp)</label><input class="fld" id="t-modal" inputmode="numeric" placeholder="mis. 2850">' +
      '<label for="t-pct">Target untung (%)</label><input class="fld" id="t-pct" inputmode="numeric" value="20">' +
      '<div class="chips">' + [10, 15, 20, 30].map(p => '<button class="chip" data-p="' + p + '">' + p + '%</button>').join('') + '</div>' +
      '<div class="out" id="t-out"><span class="hint">Isi harga modal dulu.</span></div>';
    const $ = s => el.querySelector(s);
    const calc = () => {
      const m = a.num($('#t-modal').value), p = a.num($('#t-pct').value), o = $('#t-out');
      if (!m) { o.innerHTML = '<span class="hint">Isi harga modal dulu.</span>'; return; }
      const j = Math.ceil(m * (1 + p / 100) / 100) * 100;
      o.innerHTML = '<span class="hint">Harga jual disarankan</span><br><b>' + a.rp(j) + '</b><br><span class="hint">Untung ' + a.rp(j - m) + ' per pcs</span>';
    };
    el.addEventListener('input', calc);
    el.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => { $('#t-pct').value = b.getAttribute('data-p'); calc(); }));
  }
});

KS.Tools.register({
  id: 'menipis', since: '1.0.0', name: 'Stok menipis', desc: 'Daftar belanja otomatis',
  icon: '<path d="M12 3l10 18H2z"/><path d="M12 10v4"/><path d="M12 17.5h.01"/>',
  render(el, a) {
    const low = a.getData().products.filter(p => p.stok <= p.min);
    if (!low.length) { el.innerHTML = '<div class="empty">Semua stok aman.</div>'; return; }
    const txt = 'Daftar belanja:\n' + low.map(p => '- ' + p.name + ' (sisa ' + p.stok + ')').join('\n');
    el.innerHTML = low.map(p => '<div class="row"><div class="grow"><div class="t">' + a.esc(p.name) + '</div></div><span class="pill low">sisa ' + p.stok + '</span></div>').join('') +
      '<button class="btn" id="cp" style="width:100%;margin-top:6px">Salin daftar belanja</button>';
    el.querySelector('#cp').addEventListener('click', () => {
      try { navigator.clipboard.writeText(txt).then(() => a.toast('Daftar disalin'), () => a.toast('Gagal menyalin')); }
      catch (e) { a.toast('Gagal menyalin'); }
    });
  }
});
})();
