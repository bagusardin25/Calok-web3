# Progres — Colok

Catatan status project agar bisa dilanjutkan kapan saja tanpa membaca ulang percakapan.
Terakhir diperbarui: **11 November 2026**.

## Status sekarang

**Milestone M2 selesai — 55%.** Contract dan UI lengkap, alur tambah-lalu-verifikasi teruji di chain lokal, termasuk lewat daftar tanpa peta. Belum ada yang di-deploy ke jaringan publik.

Pekerjaan dijeda di sini karena langkah berikutnya menunggu repo dan wallet deployer dari pemilik project.

| Tahap | Isi | Progres | Status |
|---|---|---|---|
| M0 | PRD | 5% | Selesai |
| M1 | Smart contract + test | 25% | Selesai |
| M2 | UI/UX lengkap, alur penuh di chain lokal | 55% | Selesai |
| M3 | Deploy testnet (968) + uji wallet sungguhan di ponsel | 70% | **Berikutnya** |
| M4 | Deploy mainnet (677) + verifikasi source | 85% | Belum |
| M5 | Vercel produksi, titik awal nyata, pengumuman X, audit checklist | 100% | Belum |

## Yang sudah jadi

### Dokumen
- [PRD.md](PRD.md) — scope, fitur, alur, spesifikasi contract; status dan tabel gas sudah diisi angka terukur.
- [README.md](README.md) — cara menjalankan, deploy, setting Vercel, ubin peta, dan 19 screenshot (desktop, 768 px, 375 px) di `docs/screenshots/`.

### Smart contract (`contracts/`)
- `contracts/Colok.sol` — Solidity 0.8.24, target EVM `paris`, optimizer 200 runs, tanpa dependensi, tanpa fungsi payable. Bytecode runtime 13.290 byte.
- `test/Colok.test.js` — 65 test aturan, penolakan, waktu, dan gas.
- `test/geo-parity.test.js` — 5 test yang memuat `web/src/geo/cells.ts` langsung dan membandingkannya dengan contract (tepi sel, kutub, antimeridian, lintang/bujur negatif, 400 koordinat acak).
- `scripts/deploy.js` — deploy ke jaringan mana pun, lalu menulis alamat ke `deployments/<network>.json` dan `web/src/config/deployments.json`.
- `scripts/seed.js` — 11 titik contoh di Jakarta Pusat; hanya mau jalan di chain lokal; memajukan jam chain lokal 91 hari agar status Stale terlihat. Titik terakhir sengaja di tengah area, karena peta dibuka di titik terbaru.
- `scripts/export-abi.js` — menulis ABI ke `web/src/config/abi.ts`.
- `hardhat.config.js` — jaringan `localhost` (port **8547**), `botchainTestnet` (968), `botchain` (677).

Aturan yang ditegakkan contract:
- Koordinat bilangan bulat mikroderajat, lintang ±90°, bujur ±180°; minimal satu fasilitas (bitmask 4 bit); jenis tempat 0–7; nama 3–48 byte; catatan 0–160 byte.
- Indeks sel 0,1°: `baris × 3600 + kolom`, dihitung dari kutub selatan dan bujur −180 sehingga pembagian selalu non-negatif (lantai benar untuk koordinat negatif). Kutub utara masuk baris teratas; +180 sama dengan −180.
- Skor −3…+3. "Still here" +1, laporan −1. Penambah tidak bisa memberi suara pada titiknya sendiri. Satu wallet satu suara per titik per 30 hari (konfirmasi dan laporan berbagi masa tunggu).
- Status dihitung contract: Hidden → Closed → Reported gone (skor ≤ −2) → Stale (> 90 hari sejak konfirmasi terakhir; penambahan dihitung sebagai penampakan pertama) → Verified (skor ≥ +2) → New.
- Penambah boleh menutup titiknya; pemilik contract hanya bisa menyembunyikan/menampilkan, tidak bisa mengubah data.

Fungsi baca PRD 10.4 semuanya ada, ditambah tiga yang dibutuhkan UI: `canVote(id, wallet)` (alasan tombol tidak bisa dipakai + tanggal boleh lagi), `votedOn(wallet)` (untuk "My spots", karena `eth_getLogs` mati), dan `cellOf(lat, lng)` (untuk test paritas).

### Frontend (`web/`)
Vite + React + TypeScript + viem + MapLibre GL (dimuat belakangan).

| Rute | Halaman | File |
|---|---|---|
| `#/` | Peta penuh layar, saringan, tombol lokasi, kunci pin | `src/pages/MapPage.tsx` |
| `#/spot/:id` | Peta + panel detail (samping di ≥ 900 px, lembar bawah di bawahnya) | `src/pages/MapPage.tsx`, `src/components/SpotPanel.tsx` |
| `#/add` | Tanda bidik di peta + form; koordinat bisa diketik | `src/pages/AddPage.tsx` |
| `#/list` | Daftar terdekat, padanan penuh peta | `src/pages/ListPage.tsx` |
| `#/mappers` | Papan kontributor + statistik langsung | `src/pages/MappersPage.tsx` |
| `#/me` | Titik yang ditambah dan suara yang diberikan | `src/pages/MePage.tsx` |
| `#/about` | Cara verifikasi, arti pin, privasi, batasan, BOT Chain, kredit peta | `src/pages/AboutPage.tsx` |
| — | Dialog wallet | `src/components/WalletDialog.tsx` |

- **Arah desain:** papan penunjuk arah. Panel hitam, kuning rambu `#FFC400` sebagai satu-satunya aksen, huruf Overpass (turunan Highway Gothic, huruf rambu jalan) + Overpass Mono untuk angka. Peta Positron dibuat abu-abu penuh (`grayscale`) agar warna hanya untuk status.
- **Pin stopkontak:** bulat dua lubang. New = garis luar putih; Verified = penuh kuning; Stale = pudar dengan garis putus-putus; Reported gone = dicoret. Status juga selalu ditulis sebagai teks.
- **BOT Chain:** bilah hitam di bawah peta yang selalu terlihat (BOT Chain, botchain.ai, scan.botchain.ai); footer di halaman lain memuat keduanya plus alamat contract.
- **Lokasi perangkat:** hanya di memori browser, tidak disimpan, tidak dikirim. Diminta sekali per kunjungan sesuai PRD 7.1; ditolak → peta dibuka di area titik terbaru dan ada pemberitahuan yang bisa ditutup.
- **Peringatan privasi** muncul sebelum konfirmasi pertama sebuah wallet.
- **Jam chain:** UI memakai waktu blok (bukan jam perangkat) untuk "3 days ago" dan tanggal masa tunggu.
- Data dibaca lewat fungsi view; panggilan dalam satu layar digabung dalam satu permintaan HTTP (batch viem).
- Jaringan aktif diatur `VITE_CHAIN`; default `local` saat `npm run dev`, `mainnet` saat `npm run build`.

### Penyedia ubin peta
**OpenFreeMap** (`https://tiles.openfreemap.org/styles/positron`). Diperiksa 11 November 2026: tanpa akun, tanpa API key, tanpa cookie, tanpa batas request di instance publik, boleh komersial. Atribusi OpenFreeMap / OpenMapTiles / OpenStreetMap ditambahkan MapLibre dari style dan dipaksa tidak dilipat (`compact: false`).

Yang perlu kamu ketahui dari ToS-nya (berlaku dengan pemakaian, tanpa klik setuju): penyedia layanan "as-is" tanpa jaminan dan bisa dihentikan kapan saja; integrator harus berusia 18+; permintaan lewat Cloudflare; hukum Hungaria.

Ubin raster `tile.openstreetmap.org` **tidak** dipakai sebagai cadangan: kebijakannya meminta kontak publik dan bisa memblokir tanpa pemberitahuan. Cadangan yang dipakai adalah daftar terdekat.

## Yang sudah diverifikasi

Semua dijalankan pada 11 November 2026, chain lokal Hardhat di port 8547, dev server di port 5175.

| Pemeriksaan | Hasil |
|---|---|
| `npm test` di `contracts/` | 70 lulus |
| `npm run typecheck` di `web/` | Lulus |
| `npm run build` di `web/` | Lulus |
| `npm run lint` di `web/` | 0 error, 6 peringatan |
| Wallet dev di bundle produksi | Tidak ada (`loadDevWallets` dan nama wallet dev tidak ditemukan) |
| Build produksi dibuka (`vite preview`) | Peta termuat, pemberitahuan "belum di-deploy", dialog wallet menampilkan "No wallet found" |
| Rani menambah titik No. 12 lewat tanda bidik | Berhasil, status New |
| Sari lalu Tono menekan Still here | Status berubah New → **Verified**, pin jadi kuning |
| Peringatan privasi sebelum konfirmasi pertama | Muncul untuk Sari dan Tono |
| Konfirmasi kedua oleh wallet yang sama | Tombol diganti penjelasan + tanggal boleh lagi |
| Tono lalu Rani melapor titik No. 8 | Status **Reported gone**, pin dicoret |
| **Seluruh alur tanpa peta** (ubin diblokir di browser) | Moderator menambah No. 13 dengan mengetik koordinat; Sari dan Tono mengonfirmasi dari daftar → Verified; laporan kedua No. 8 juga dikirim lewat daftar |
| Peta gagal dimuat | Pesan + tombol ke daftar; tanda bidik dan tombol lokasi disembunyikan |
| Zoom terlalu jauh | "Zoom in to load the spots…" + titik terbaru ditampilkan |
| Izin lokasi ditolak | Peta tetap jalan, pemberitahuan bisa ditutup, daftar mulai dari area peta |
| Izin lokasi diizinkan (posisi tiruan lewat `navigator.geolocation`) | Daftar urut dari posisi ("Sorted by distance from your location"); peta terpusat ke posisi, baik lewat tombol lokasi maupun saat posisi tiba sebelum peta siap |
| Peta tambah titik | Titik yang sudah ada ikut tampil (tidak bisa diklik, tersembunyi dari pembaca layar) untuk mencegah duplikat |
| Tanpa wallet menekan Still here | Dialog wallet terbuka |
| Validasi form tambah | Ringkasan error mendapat fokus; tautan error memfokuskan field tanpa merusak rute |
| Keyboard | Fokus pindah ke judul titik, cincin fokus kuning/hitam terlihat, Escape menutup panel dan menu |
| Viewport 375 px, 768 px, 1024 px | Tanpa scroll horizontal di semua rute; lembar bawah di 375/768, panel samping di desktop; atribusi tetap terlihat di atas lembar bawah |
| Screenshot README (Chromium headless, chain lokal segar) | 19 gambar dicek satu per satu; ubin peta selesai dimuat (penanda `data-idle` dari event `idle` MapLibre); semua tautan gambar di README mengarah ke file yang ada |
| Kontras warna | 16 dari 18 pasangan lulus WCAG AA; 2 sisanya garis dekoratif dan isi pin pudar yang batasnya dibawa garis tepi (4,8:1) |

### Biaya gas terukur (20 gwei)

| Aksi | Gas | BOT |
|---|---|---|
| Deploy | 2.948.363 | 0,059 |
| Tambah titik (nama 48 byte, catatan 160 byte, wallet baru) | 446.499 | 0,0089 |
| Tambah titik (nama 24 byte, catatan 47 byte, wallet baru) | 281.834 | 0,0056 |
| Tambah titik (wallet yang sudah pernah berkontribusi) | 158.477 | 0,0032 |
| Still here (wallet baru) | 178.105 | 0,0036 |
| Still here (wallet lama) | 99.419 | 0,0020 |
| Lapor (wallet baru) | 175.081 | 0,0035 |

Kueri peta penuh (48 sel, 30 titik) ± 0,67 juta gas `eth_call`.

## Yang belum dikerjakan

### M3 — Testnet
- [ ] **Kamu:** putuskan nama: **Colok** atau **Calok** (lihat bawah).
- [ ] **Kamu:** setup repo git dari folder `calok/` dan hubungkan ke Vercel (Root Directory `web`).
- [ ] **Kamu:** siapkan wallet deployer, ambil BOT testnet di `https://faucet.botchain.ai/basic`.
- [ ] **Kamu:** salin `contracts/.env.example` menjadi `.env`, isi `PRIVATE_KEY`.
- [ ] **Kamu:** jalankan `npm run deploy:testnet` di `contracts/`.
- [ ] **Saya:** uji di ponsel dengan MetaMask/BO Wallet sungguhan di testnet (`VITE_CHAIN=testnet`), termasuk izin lokasi sungguhan dan akurasi tanda bidik di lapangan.
- [ ] **Saya:** siapkan verifikasi source di explorer BOT Chain.

### M4 — Mainnet
- [ ] **Kamu:** buat group project. **Wajib sebelum deploy mainnet.**
- [ ] **Kamu:** isi BOT mainnet (± 0,07 BOT cukup untuk deploy) lalu `npm run deploy:mainnet`; commit `deployments/botchain.json` dan `web/src/config/deployments.json`.
- [ ] **Saya:** verifikasi source contract di `scan.botchain.ai`.

### M5 — Peluncuran
- [ ] **Kamu:** pilih kota/kampus peluncuran; tambahkan titik awal yang **nyata dan sudah dicek**, lalu ajak 2–3 orang memverifikasinya di tempat.
- [ ] **Kamu:** buat akun X Colok; isi URL-nya di `web/src/config/site.ts` (`xUrl`).
- [ ] **Saya:** draft minimal 5 post, termasuk "Officially launched on BOT Chain Mainnet."
- [ ] **Saya:** gambar Open Graph, audit akhir checklist eligibility.

## Hal yang diketahui dan belum ditangani

- **Wallet sungguhan dan ponsel sungguhan belum diuji.** Semua transaksi lewat akun node Hardhat; viewport ponsel diemulasikan di browser desktop.
- **Izin lokasi sungguhan belum diuji:** browser uji menolak otomatis; jalur "diizinkan" diuji dengan posisi tiruan.
- **Animasi peta belum dilihat langsung di akhir sesi:** pane browser uji tersembunyi sehingga `requestAnimationFrame` berhenti; perpindahan kamera diverifikasi dalam mode reduced-motion (lompat). Animasi sendiri sudah terlihat bekerja di awal sesi (membuka titik dari pin).
- **Duplikat hanya dicegah secara visual** (pin yang ada tampil di peta tambah); contract tidak menolak titik berdekatan.
- **Lint menyisakan 6 peringatan**, tanpa error (`set-state-in-effect`, `only-export-components`).
- **Bundle:** kerangka 619 kB (186 kB gzip, sebagian besar viem); chunk peta 1,08 MB (294 kB gzip) + worker 520 kB, dimuat hanya saat peta dibuka.
- **Tanpa klaster.** Saat zoom jauh aplikasi meminta perbesar dan menampilkan 20 titik terbaru (sesuai PRD; klaster ada di v2).
- **Sel padat:** satu sel menampilkan 30 titik terbaru; bila lebih, muncul pemberitahuan "zoom in".
- **Statistik "Ever verified"** menghitung titik yang pernah mencapai skor +2, bukan yang Verified saat ini (status Verified bergantung waktu sehingga tidak bisa dihitung murah di contract).
- **HMR dev:** mengubah `lib/wallet.tsx` atau `lib/devWallet.ts` saat dev server berjalan membuat halaman kosong sampai di-reload. Tidak berpengaruh ke produksi.
- **Kriteria ketujuh program** belum tercantum di materi.

## Keputusan yang sudah diambil

| Keputusan | Alasan |
|---|---|
| Nama produk di UI "Colok", folder tetap `calok/` | Sesuai PRD; nama final menunggu keputusanmu |
| OpenFreeMap Positron + filter abu-abu | Tanpa akun/kunci; peta redup sesuai PRD §9 |
| Tanpa cadangan ubin raster OSM | Kebijakan OSM meminta kontak publik; daftar terdekat sudah jadi cadangan penuh |
| Status Closed dan Hidden ikut di enum status | Aplikasi lain yang membaca contract mendapat jawaban lengkap |
| Konfirmasi dan laporan berbagi masa tunggu 30 hari | "Menggerakkan skor sekali per 30 hari" di PRD 5.1 |
| Penambahan titik dihitung penampakan pertama | Titik yang tak pernah dikonfirmasi tetap bisa menjadi Stale |
| `getSpotsInCells` melewati titik ditutup/disembunyikan | Kuota per sel tidak terbuang |
| Peta dianggap siap saat style termuat, bukan saat semua ubin selesai | Pin muncul lebih cepat dan batas waktu 15 detik tidak terpicu di koneksi lambat |
| Satuan id `uint32`, struct view terpisah untuk pin | Gas baca lebih kecil; daftar dan peta tidak perlu catatan |
| Jam UI mengikuti waktu blok | Konsisten dengan contract, dan dengan chain lokal yang dimajukan |
| Lokasi perangkat hanya di memori | PRD §12: tidak pernah ditulis ke chain atau disimpan |
| Project contract JavaScript, hash routing, tanpa WalletConnect, font di-host sendiri | Sama dengan Sambung, pola yang sudah teruji |
| Deploy dijalankan pemilik project | Private key tidak pernah keluar dari mesin pemilik |

## Cara melanjutkan

Chain lokal tidak menyimpan data: setiap kali node dihentikan, deploy dan seed harus diulang.

```bash
cd contracts
npx hardhat node --port 8547
```

```bash
cd contracts
npm run deploy:local
npm run seed:local
```

```bash
cd web
npm run dev
```

Buka `http://localhost:5175`, klik **Connect**, pilih salah satu "Dev wallet". Moderator = akun 0 (pemilik contract); Rani, Sari, Tono = akun 7–9 yang tidak disentuh seed.

Kalau contract diubah, jalankan `npm run export-abi` di `contracts/` supaya frontend memakai ABI terbaru.

## Informasi jaringan

| | Mainnet | Testnet |
|---|---|---|
| Chain ID | 677 | 968 |
| RPC | `https://rpc.botchain.ai` | `https://rpc.bohr.life` |
| Explorer | `https://scan.botchain.ai` | `https://scan.bohr.life` |

Alamat contract: belum ada di testnet maupun mainnet.
