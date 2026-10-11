/* ocr.js: baca foto struk lewat API Anthropic langsung dari browser. */
(function () {
'use strict';
const MAX_SIDE = 1600;

const PROMPT = 'Kamu membaca foto struk belanja minimarket di Indonesia. ' +
  'Balas HANYA dengan JSON valid tanpa teks lain, bentuknya: ' +
  '{"toko":"nama toko","tanggal":"YYYY-MM-DD atau kosong","total":angka total yang dibayar,"items":[{"nama":"nama barang","qty":angka,"harga":angka harga satuan}]}. ' +
  'Aturan: hanya baris barang, abaikan subtotal, PPN, tunai, kembalian, dan poin. ' +
  'Semua angka dalam rupiah tanpa titik atau koma pemisah ribuan. ' +
  'Tulis nama barang persis seperti tercetak di struk. ' +
  'Jika struk hanya menampilkan total per baris, harga satuan = total baris dibagi qty. ' +
  'Jika ada diskon di bawah sebuah barang, kurangkan dari total baris itu sebelum menghitung harga satuan.';

async function toJpegBase64(file) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch (e) {
    bmp = await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('Foto tidak bisa dibuka. Coba foto ulang.'));
      img.src = URL.createObjectURL(file);
    });
  }
  const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
  const k = Math.min(1, MAX_SIDE / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85).split(',')[1];
}

function parse(text) {
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('Hasil bacaan tidak berbentuk daftar barang. Coba foto ulang.');
  let j;
  try { j = JSON.parse(text.slice(a, b + 1)); }
  catch (e) { throw new Error('Hasil bacaan terpotong. Coba foto ulang lebih dekat.'); }
  const items = (Array.isArray(j.items) ? j.items : []).map(i => ({
    nama: String(i.nama || '').trim(),
    qty: Math.max(1, Math.round(+i.qty || 1)),
    harga: Math.max(0, Math.round(+i.harga || 0))
  })).filter(i => i.nama);
  return {
    toko: String(j.toko || ''),
    tanggal: /^\d{4}-\d{2}-\d{2}$/.test(j.tanggal || '') ? j.tanggal : '',
    total: Math.max(0, Math.round(+j.total || 0)),
    items
  };
}

async function read(file, cfg) {
  if (!cfg.apiKey) throw new Error('Kunci API belum diisi. Isi di Pengaturan.');
  if (navigator.onLine === false) throw new Error('Tidak ada internet. Foto struk butuh koneksi.');
  const data = await toJpegBase64(file);
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: cfg.model || 'claude-haiku-5-5',
        max_tokens: 2000,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } },
          { type: 'text', text: PROMPT }
        ] }]
      })
    });
  } catch (e) { throw new Error('Tidak bisa terhubung ke internet. Coba lagi.'); }
  if (!res.ok) {
    let msg = '';
    try { msg = (await res.json()).error.message || ''; } catch (e) {}
    if (res.status === 401) throw new Error('Kunci API tidak valid. Cek lagi di Pengaturan.');
    if (res.status === 404) throw new Error('Model tidak ditemukan. Cek nama model di Pengaturan.');
    if (res.status === 429 || /credit|balance/i.test(msg)) throw new Error('Saldo API habis atau terlalu banyak permintaan. Cek akun API-mu.');
    throw new Error('Gagal membaca struk (' + res.status + '). ' + msg);
  }
  const j = await res.json();
  const text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
  return parse(text);
}

window.KS.OCR = { read, parse };
})();
