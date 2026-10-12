# Tahta Dapur

Papan peringkat masakan istri. Tahta pertama bisa direbut menu lain. Istri cuma lihat, kamu yang atur lewat HP.

## Isi repo
- `index.html` : halaman web (semua dalam satu file)
- `data.json`  : data menu, nilai, foto, riwayat tahta (yang dilihat istri)

## Pasang di GitHub Pages (sekali saja)
1. Buat repo **publik** di GitHub, misalnya `tahta-dapur`.
2. Upload `index.html`, `data.json`, dan `README.md` ke repo itu.
3. Settings, Pages, Deploy from a branch, branch `main`, folder `/ (root)`, Save.
4. Tunggu 1 sampai 2 menit. Situs jadi di `https://NAMAKAMU.github.io/tahta-dapur/`.

## Tambah menu (tanpa token)
1. Buka situsmu, ketuk **Masuk pemilik** di bagian paling bawah, masukkan PIN (bawaan `1234`).
2. Tambah menu, ubah nilai, atau ganti foto seperti biasa. Semua tersimpan dulu di HP kamu.
3. Muncul kotak **Belum diunggah ke GitHub**. Ketuk **Unduh data.json**.
4. Di GitHub, buka repomu, pilih Add file, Upload files, pilih `data.json` yang barusan diunduh, lalu Commit changes. File lama otomatis tergantikan.
5. Tunggu 1 sampai 2 menit. Istri tinggal muat ulang halaman dan hasilnya muncul.

## Kirim ke istri
Ketuk tombol **Bagikan** di kanan atas, lalu kirim ke istri. Dia cuma lihat peringkat, tanpa form dan tanpa tombol ubah.

## Ganti PIN
Buka `index.html`, cari `var PIN='1234'`, ganti angkanya, lalu upload lagi.

## Catatan penting
- Repo dan situs Pages bersifat publik. Siapa pun yang punya link bisa lihat data, termasuk foto istri. Halaman sudah diberi `noindex` supaya tidak muncul di Google, tapi itu bukan pengaman.
- PIN cuma pengaman kecil supaya form tidak muncul di HP istri. Yang benar-benar menentukan isi halaman adalah file `data.json` di repo, dan cuma kamu yang bisa mengganti itu.
- Perubahan sebelum diunggah hanya ada di browser HP kamu. Jangan hapus data browser sebelum `data.json` diunggah.
