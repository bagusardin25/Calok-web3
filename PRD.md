# PRD — Colok

**Peta colokan, Wi-Fi, dan isi ulang air di tempat umum, yang dijaga tetap benar oleh orang-orang yang lewat.**
Versi 1.0 · 11 November 2026 · Project 3 dari 5 (BOT Chain Ecosystem Support Program)

**Status: M2 (UI/UX lengkap, alur tambah-lalu-verifikasi berjalan di chain lokal) — 55%.** Contract + 70 test lulus; frontend lengkap; belum di-deploy ke jaringan publik. Rincian di [PROGRESS.md](PROGRESS.md).

> **Catatan nama.** PRD ini memakai nama **Colok** (dari *colokan*, stopkontak). Folder yang sudah kamu buat bernama `calok/`, jadi file ini saya simpan di sana. Kalau "Calok" memang nama yang kamu mau, cukup beri tahu dan saya ganti di seluruh dokumen; kalau salah ketik, folder bisa kamu ubah namanya kapan saja sebelum repo dibuat.

---

## 1. Ringkasan

Colok adalah peta titik-titik di ruang publik tempat orang bisa mengecas, tersambung Wi-Fi, mengisi botol minum, dan duduk bekerja: stasiun, perpustakaan, taman, kampus, masjid, mal. Siapa pun boleh menambah titik. Yang membuatnya berbeda dari peta biasa adalah **verifikasi oleh orang lain**: wallet lain yang benar-benar datang ke sana menekan "Still here" atau melaporkan masalah. Titik baru berstatus *terverifikasi* setelah dua orang lain mengonfirmasinya, berubah *usang* kalau lama tidak dikonfirmasi, dan *dilaporkan mati* kalau laporan masalah lebih banyak.

Setiap titik dan setiap konfirmasi tercatat di BOT Chain, sehingga daftar ini tidak dimiliki satu perusahaan dan riwayat siapa memverifikasi apa bisa diperiksa siapa saja.

| | |
|---|---|
| Kategori | Tools / DePIN |
| Jaringan | BOT Chain Mainnet (chain ID 677) |
| Bentuk | Satu smart contract + satu web app berbasis peta |
| Token | Tidak ada. Tidak ada biaya selain gas |
| Bahasa UI | Inggris; nama dan istilah Indonesia |
| Folder | `D:\Project Web3\calok` |

## 2. Latar belakang dan tujuan

### Masalah
Informasi "di mana ada colokan yang bisa dipakai" tersebar di ulasan, grup obrolan, dan ingatan orang, dan cepat basi: colokan dicabut, Wi-Fi diberi kata sandi, keran rusak. Peta komersial jarang mencatat fasilitas sekecil ini dan tidak menunjukkan kapan terakhir kali seseorang memastikannya.

Di sisi BOT Chain, narasi jaringannya adalah DePIN dan AI, tetapi kategori DePIN di direktori baru berisi **4 dari 1.195 project**, dan tidak satu pun memetakan infrastruktur fisik lewat partisipasi orang.

### Tujuan produk
1. Menjawab satu pertanyaan dengan cepat: *di dekat sini, di mana saya bisa mengecas atau bekerja, dan apakah infonya masih benar?*
2. Menjadikan kesegaran data sebagai fitur utama, bukan catatan kaki: setiap titik menampilkan status dan kapan terakhir dikonfirmasi.
3. Membuat kontribusi kecil terasa berarti: satu ketukan "Still here" adalah satu transaksi yang memperbarui peta untuk semua orang.
4. Memenuhi seluruh kriteria eligibility program lewat pemakaian wajar.

### Bukan tujuan (v1)
- Tidak ada token, poin yang bisa ditukar, atau hadiah memetakan.
- Tidak ada foto titik.
- Tidak ada bukti kehadiran kriptografis; verifikasi berbasis kepercayaan dan silang-periksa.
- Tidak ada perangkat keras atau sensor.
- Tidak ada pencarian alamat, rute, atau peta offline.
- Tidak ada backend, database, atau indexer.

## 3. Pengguna sasaran

| Persona | Kebutuhan | Yang didapat |
|---|---|---|
| **Pekerja lapangan dan mahasiswa** | Butuh tempat ngecas atau kerja sekarang | Peta dan daftar terdekat, bisa dipakai tanpa wallet |
| **Pemeta** | Tahu tempat bagus dan mau membagikannya | Menambah titik dalam satu transaksi |
| **Yang kebetulan lewat** | Melihat colokan masih ada atau sudah dicabut | Satu ketukan untuk mengonfirmasi atau melapor |
| **Pengelola komunitas** | Ingin memetakan kampus atau kotanya | Tautan per titik untuk dibagikan; papan kontributor |

Membaca peta tidak memerlukan wallet. Wallet baru diminta saat menambah, mengonfirmasi, atau melapor.

## 4. Pemetaan ke kriteria program

| Kriteria | Cara dipenuhi |
|---|---|
| Akun X aktif, 5 post | Akun X khusus Colok. Draft post disiapkan di tahap akhir. **Dikerjakan olehmu.** |
| Pengumuman mainnet | Post dengan kalimat wajib "Officially launched on BOT Chain Mainnet." |
| BOT Chain di website | Footer dan panel "About" menampilkan nama BOT Chain dengan tautan ke `https://botchain.ai` dan `https://scan.botchain.ai` |
| Produk usable | Peta berfungsi, connect wallet, menambah dan memverifikasi titik berjalan |
| Independen dan orisinal | Tidak ada peta fasilitas umum di direktori; mekanik status-kesegaran dan indeks sel geografis ditulis dari nol; tampilan berbeda dari dua project sebelumnya |
| 3 wallet, 5 transaksi | Satu titik terverifikasi = 1 penambah + 2 pengonfirmasi (3 wallet, 3 transaksi); dua titik sudah melewati 5 transaksi |
| Deployment + verification | Contract di-deploy ke mainnet dan source-nya diverifikasi di scan.botchain.ai |

## 5. Cara kerja verifikasi

Ini inti produk, jadi aturannya dibuat sederhana dan bisa dijelaskan dalam satu layar.

### 5.1 Skor kesehatan
Setiap titik punya **skor kesehatan** dari −3 sampai +3, mulai dari 0.

| Aksi | Efek |
|---|---|
| Wallet lain menekan **Still here** | +1 |
| Wallet lain menekan **Report a problem** | −1 |

Pembatas agar tidak mudah dipermainkan:
- Penambah titik **tidak bisa** mengonfirmasi titiknya sendiri.
- Satu wallet hanya bisa menggerakkan skor satu titik **sekali per 30 hari**.
- Skor tidak bisa melewati −3 atau +3, sehingga titik lama tidak kebal terhadap laporan baru.

### 5.2 Status yang ditampilkan

| Status | Syarat | Tampilan di peta |
|---|---|---|
| **New** | Skor −1 sampai +1 | Pin garis luar |
| **Verified** | Skor ≥ +2 dan konfirmasi terakhir ≤ 90 hari | Pin penuh |
| **Stale** | Konfirmasi terakhir > 90 hari | Pin pudar |
| **Reported gone** | Skor ≤ −2 | Pin dicoret; tersembunyi dari tampilan bawaan |

Status dihitung oleh contract dari skor dan cap waktu, bukan oleh frontend, sehingga aplikasi lain yang membaca contract mendapat jawaban yang sama.

### 5.3 Alasan laporan
Gone (sudah tidak ada) · Broken (rusak) · No longer free (sekarang berbayar atau dikunci) · Wrong place (lokasi salah).

### 5.4 Jalan keluar
- Penambah titik boleh **menutup** titiknya sendiri.
- Pemilik contract boleh **menyembunyikan** titik yang melanggar (rumah pribadi, teks tidak pantas). Data tetap ada di chain; frontend tidak menampilkannya.

## 6. Lingkup fitur

### 6.1 Masuk v1

**F1 — Peta.**
Peta penuh layar dengan pin berbentuk stopkontak. Pin dibedakan menurut status. Peta dibuka di lokasi pengguna bila diizinkan; bila tidak, di area yang memiliki titik.

**F2 — Saring.**
Empat fasilitas, bisa digabung: **Power** (colokan), **Wi-Fi**, **Water** (isi ulang air), **Seating** (tempat duduk). Ditambah pilihan menampilkan titik usang dan yang dilaporkan mati.

**F3 — Detail titik.**
Nama, fasilitas, jenis tempat, catatan, status dengan penjelasannya, kapan terakhir dikonfirmasi dan oleh siapa, jumlah konfirmasi dan laporan. Tombol **Directions** membuka aplikasi peta di perangkat. Setiap titik punya tautan sendiri untuk dibagikan.

**F4 — Menambah titik.**
Geser peta sampai tanda bidik tepat di lokasi, atau pakai lokasi perangkat. Isi nama (maksimal 48 byte), fasilitas, jenis tempat, dan catatan (maksimal 160 byte), misalnya "di tiang dekat pintu timur, lantai 2".

Jenis tempat: Transit · Library · Park · Campus · Mall · Place of worship · Café · Other.

**F5 — Konfirmasi dan lapor.**
Dua tombol di detail titik. Tombol menjelaskan sendiri bila tidak bisa dipakai: titik milikmu, atau kamu sudah menggerakkan skornya dalam 30 hari terakhir (dengan tanggal boleh lagi).

**F6 — Daftar terdekat.**
Tampilan daftar sebagai padanan peta, diurutkan menurut jarak. Ini juga jalur utama bagi pengguna keyboard dan pembaca layar.

**F7 — Kontributor.**
Papan wallet dengan jumlah titik ditambah, konfirmasi, dan laporan. Halaman "My spots" untuk kontribusi sendiri.

**F8 — Halaman About.**
Cara kerja verifikasi, apa yang tercatat di chain, dan catatan privasi (bagian 12).

**F9 — Statistik langsung.**
Jumlah titik, titik terverifikasi, konfirmasi, dan kontributor, dibaca dari contract.

### 6.2 Tidak masuk v1 (kandidat v2)
- Pencarian nama tempat atau alamat.
- Foto titik.
- Jam buka terstruktur.
- Tampilan klaster untuk zoom sangat jauh.
- Toggle bahasa Indonesia/Inggris.

## 7. Alur pengguna

### 7.1 Mencari tempat
1. Buka situs. Peta meminta izin lokasi; menolak tetap bisa memakai peta.
2. Pilih saringan, misalnya Power + Seating.
3. Ketuk pin → panel detail terbuka → **Directions**.

### 7.2 Menambah titik
1. **Add a spot** → hubungkan wallet bila perlu.
2. Posisikan tanda bidik. Koordinat dibulatkan ke lima desimal (sekitar satu meter).
3. Isi form → konfirmasi di wallet → pin baru muncul dengan status New.
4. Salin tautan titik untuk dibagikan, agar orang lain bisa memverifikasinya.

### 7.3 Memverifikasi
1. Buka titik, dari peta atau dari tautan.
2. **Still here** atau **Report a problem** (pilih alasan) → konfirmasi.
3. Status titik diperbarui. Pada konfirmasi kedua dari orang lain, pin berubah menjadi Verified.

### 7.4 Keadaan yang ditangani
Tanpa wallet · jaringan salah · izin lokasi ditolak · lokasi tidak tersedia · peta gagal dimuat (daftar tetap berfungsi) · area tanpa titik · zoom terlalu jauh · titik milik sendiri · masih dalam masa tunggu 30 hari · titik tersembunyi atau ditutup · transaksi ditolak atau gagal · RPC gagal · saldo BOT tidak cukup.

## 8. Halaman dan layar

| Rute | Isi |
|---|---|
| `#/` Peta | Peta penuh, saringan, tombol lokasi, tombol tambah, panel detail (samping di desktop, lembar bawah di mobile) |
| `#/spot/:id` Titik | Peta terpusat di titik dengan panel detail terbuka |
| `#/add` Tambah | Peta dengan tanda bidik dan form |
| `#/list` Daftar | Titik terdekat sebagai daftar, saringan yang sama |
| `#/mappers` Kontributor | Papan kontributor |
| `#/me` Titik saya | Titik yang ditambah, konfirmasi yang diberikan |
| `#/about` Tentang | Cara verifikasi, privasi, tautan BOT Chain dan contract |

Karena beranda adalah peta penuh layar tanpa footer biasa, nama dan tautan BOT Chain ditempatkan di **bilah bawah peta yang selalu terlihat** dan diulang di footer halaman lain.

## 9. Arah desain

Sengaja berbeda dari dua project sebelumnya.

| | Sambung | Dakon | Colok |
|---|---|---|---|
| Suasana | Kertas terang | Panggung gelap | Papan penunjuk arah |
| Motif | Benang merah | Papan kayu, kawung | Stopkontak dan piktogram |
| Aksen | Merah | Kuningan | Kuning rambu di atas hitam |
| Tipografi | Serif buku | Grotesk berkarakter | Sans rambu, tegas, huruf besar pada label |
| Pusat layar | Kolom baca | Papan permainan | Peta |

- **Tiga atribut:** lugas, terbaca sekilas, bisa dipercaya.
- **Motif:** stopkontak bulat dua lubang sebagai bentuk pin dan logo; piktogram bergaya rambu fasilitas umum untuk empat fasilitas.
- **Peta:** dasar abu-abu redup agar pin menonjol; warna hanya dipakai untuk status.
- **Status tidak hanya lewat warna:** bentuk pin berbeda (garis luar, penuh, pudar, dicoret) dan selalu disertai teks.
- **Mobile dulu:** produk ini dipakai sambil berjalan. Target sentuh minimal 44 px, panel detail sebagai lembar bawah, tombol utama dalam jangkauan ibu jari.
- **Gerak:** minim; pin baru muncul dengan satu denyut. Dimatikan pada reduced motion.

Kontras minimal WCAG AA di atas peta maupun panel.

## 10. Spesifikasi smart contract

**Contract:** `Colok.sol` · Solidity 0.8.24 · EVM target `paris` · tanpa dependensi eksternal · tanpa fungsi payable.

### 10.1 Data titik
- Koordinat disimpan sebagai bilangan bulat **mikroderajat** (derajat × 1.000.000), tanpa pecahan, sehingga hasilnya identik di contract dan frontend.
- Fasilitas disimpan sebagai **bitmask** empat bit, jadi satu titik bisa punya beberapa fasilitas.
- Skor kesehatan, cap waktu konfirmasi terakhir, dan penghitung konfirmasi/laporan disimpan per titik.

### 10.2 Indeks geografis
Blockchain tidak bisa menjawab "titik di sekitar sini" secara langsung. Solusinya:
- Bumi dibagi menjadi **sel 0,1° × 0,1°** (sekitar 11 km). Setiap titik didaftarkan ke selnya saat dibuat.
- Frontend menghitung sel mana yang terlihat di layar, lalu meminta isi sel-sel itu dalam satu panggilan.
- Jumlah sel per panggilan dibatasi. Bila peta di-zoom terlalu jauh, aplikasi meminta pengguna memperbesar dan menampilkan titik terbaru sebagai gantinya.

### 10.3 Fungsi tulis

| Fungsi | Aturan |
|---|---|
| `addSpot(lat, lng, amenities, place, name, note)` | Lintang ±90°, bujur ±180°; minimal satu fasilitas; nama 3–48 byte; catatan 0–160 byte |
| `confirm(spotId)` | Bukan penambah; di luar masa tunggu 30 hari; titik tidak ditutup atau disembunyikan |
| `report(spotId, reason)` | Syarat sama dengan `confirm`; `reason` 0–3 |
| `closeSpot(spotId)` | Hanya penambah titik |
| `setHidden(spotId, hidden)` | Hanya pemilik contract |
| `transferOwnership(newOwner)` | Hanya pemilik contract |

### 10.4 Fungsi baca

RPC mainnet mematikan `eth_getLogs`, jadi semua data dibaca lewat fungsi view.

`spotCount` · `getSpot(id)` · `getSpots(cursor, limit)` · `getSpotsByIds(ids[])` · `getSpotsInCells(cells[], perCell)` · `cellCounts(cells[])` · `statusOf(id)` · `voteOf(id, wallet)` · `spotsBy(wallet)` · `mapperOf(wallet)` · `getMappers(cursor, limit)` · `stats()`

Ditambahkan saat implementasi (M1): `canVote(id, wallet)` — alasan tombol tidak bisa dipakai dan tanggal boleh lagi; `votedOn(wallet)` — titik yang pernah dikonfirmasi/dilaporkan wallet, untuk halaman "My spots"; `cellOf(lat, lng)` — perhitungan sel yang sama dengan frontend, dibuktikan test paritas.

Catatan implementasi: enum status di contract juga memuat **Closed** dan **Hidden**, agar aplikasi lain mendapat jawaban lengkap. Konfirmasi dan laporan berbagi masa tunggu 30 hari. Titik yang tidak pernah dikonfirmasi dihitung dari waktu ditambahkan, sehingga tetap bisa menjadi Stale. `getSpotsInCells` melewati titik yang ditutup atau disembunyikan. Angka "terverifikasi" di `stats()` adalah titik yang **pernah** mencapai skor +2.

### 10.5 Event
`SpotAdded` · `SpotConfirmed` · `SpotReported` · `SpotClosed` · `SpotHiddenSet` · `OwnershipTransferred` — untuk keterbacaan di explorer.

### 10.6 Keamanan
- Tidak ada dana yang disimpan atau dipindahkan.
- Pemilik hanya bisa menyembunyikan titik; tidak bisa mengubah koordinat, teks, atau skor.
- Panjang semua teks dibatasi di contract.
- Perhitungan status memakai waktu blok; tidak ada ketergantungan pada oracle.

### 10.7 Biaya terukur (gas 20 gwei)

Diukur di test suite pada 11 November 2026 (menggantikan perkiraan awal 0,04–0,07 / ± 0,007 / ± 0,0015 BOT).

| Aksi | Gas | BOT |
|---|---|---|
| Deploy contract | 2.948.363 | 0,059 |
| Menambah titik, nama 48 byte + catatan 160 byte, wallet baru | 446.499 | 0,0089 |
| Menambah titik, nama 24 byte + catatan 47 byte, wallet baru | 281.834 | 0,0056 |
| Menambah titik, wallet yang sudah pernah berkontribusi | 158.477 | 0,0032 |
| Konfirmasi, wallet baru | 178.105 | 0,0036 |
| Konfirmasi, wallet lama | 99.419 | 0,0020 |
| Lapor, wallet baru | 175.081 | 0,0035 |

Konfirmasi lebih mahal dari perkiraan karena kontribusi pertama sebuah wallet juga mendaftarkannya di papan kontributor dan di daftar "My spots". Kueri peta penuh (48 sel, 30 titik) ± 0,67 juta gas `eth_call`, gratis.

## 11. Arsitektur teknis

```
calok/
├── PRD.md
├── README.md
├── PROGRESS.md
├── contracts/            Hardhat 2 + ethers + chai (JavaScript)
│   ├── contracts/Colok.sol
│   ├── test/             aturan skor, masa tunggu, status berbasis waktu, indeks sel
│   ├── scripts/          deploy, seed (lokal saja), export-abi
│   └── .env.example      (PRIVATE_KEY diisi olehmu, tidak pernah di-commit)
└── web/                  Vite + React + TypeScript + viem + pustaka peta
    └── src/
        ├── geo/          sel, jarak, pembulatan koordinat
        ├── config/       chain, alamat contract, ABI
        ├── lib/          wallet, client baca, format
        ├── components/   peta, pin, panel detail, saringan
        ├── pages/
        └── styles/
```

- **Peta:** MapLibre GL dengan ubin **OpenFreeMap** (style Positron, dibuat abu-abu penuh). Syarat pakai diperiksa di M2: tanpa akun, tanpa kunci API, tanpa batas request, boleh komersial; atribusi OpenFreeMap / OpenMapTiles / OpenStreetMap selalu tampil tanpa dilipat. Ubin raster OpenStreetMap **tidak** dipakai sebagai cadangan karena kebijakannya meminta kontak publik dan bisa memblokir tanpa pemberitahuan; cadangannya adalah daftar terdekat, yang bisa melakukan semua yang bisa dilakukan peta.
- **Pustaka peta dimuat belakangan**, supaya daftar dan kerangka halaman tampil dulu.
- **Lokasi perangkat** hanya dipakai di browser untuk memusatkan peta dan menghitung jarak. Tidak dikirim ke mana pun.
- **Wallet:** EIP-6963 dengan cadangan `window.ethereum`; lapisan koneksinya memakai pola yang sudah teruji di Sambung, tampilannya dibuat baru.
- **Routing:** hash router. **Hosting:** Vercel, root directory `web`.
- **Wallet dev:** hanya di mode development pada chain lokal; tidak ikut build produksi.

## 12. Privasi dan keamanan pengguna

Karena produk ini menyangkut lokasi, hal berikut ditulis jelas di aplikasi, bukan hanya di PRD.

- **Konfirmasi bersifat publik.** Menekan "Still here" mencatat bahwa wallet tertentu menyatakan pernah berada di titik itu pada waktu itu. Peringatan ini muncul sebelum konfirmasi pertama.
- **Lokasi perangkat tidak pernah ditulis ke chain.** Yang tercatat hanya koordinat titik yang sengaja ditambahkan.
- **Hanya tempat umum.** Form tambah titik menyatakan bahwa rumah pribadi dan area terbatas tidak boleh dipetakan; titik semacam itu disembunyikan moderator.
- **Tanpa data pribadi.** Nama dan catatan titik bersifat publik dan permanen.

## 13. Kebutuhan non-fungsional

| Aspek | Target |
|---|---|
| Kecepatan | Kerangka halaman dan daftar tampil sebelum peta selesai dimuat |
| Ketahanan | Bila ubin peta gagal, daftar terdekat tetap berfungsi penuh |
| Responsif | Dipakai nyaman di 375 px dengan satu tangan |
| Aksesibilitas | Daftar sebagai padanan peta; status tidak bergantung warna; semua aksi bisa lewat keyboard |
| Ketepatan | Pembulatan koordinat dan perhitungan sel identik di contract dan frontend, dibuktikan dengan test |

## 14. Tahapan dan progres

| Tahap | Isi | Progres |
|---|---|---|
| M0 | PRD | 5% |
| M1 | Smart contract + test lulus — selesai 11 Nov 2026 | 25% |
| M2 | **UI/UX lengkap: peta, detail, tambah, daftar, kontributor; alur tambah-lalu-verifikasi berjalan di chain lokal** — selesai 11 Nov 2026 | **55%** |
| M3 | Deploy testnet (968) + uji dengan wallet sungguhan di ponsel | 70% |
| M4 | Deploy mainnet (677) + verifikasi source | 85% |
| M5 | Vercel produksi, titik awal yang nyata, pengumuman X, audit checklist | 100% |

**Titik lapor:** di akhir M2 saya berhenti dan memberi tahu kamu, supaya kamu bisa menyiapkan repo dan menghubungkannya.

## 15. Pembagian kerja

| Saya | Kamu |
|---|---|
| PRD, contract, test, frontend, script deploy | Membuat group project **sebelum** deploy mainnet |
| Uji lokal dan panduan uji testnet | Setup repo dan menghubungkan ke Vercel |
| Draft post X dan teks pengumuman | Membuat akun X dan mempublikasikan post |
| Panduan verifikasi contract | Menjalankan deploy dengan private key-mu sendiri |
| Audit checklist eligibility | **Menambahkan titik awal yang nyata** dan mengajak 2–3 orang memverifikasinya di tempat |

Titik awal di mainnet harus tempat yang benar-benar ada dan sudah dicek. Data contoh hanya dipakai di chain lokal.

## 16. Risiko

| Risiko | Mitigasi |
|---|---|
| Peta kosong di awal | Peluncuran difokuskan pada satu kota atau kampus; titik awal nyata dari kamu dan tester; tautan per titik untuk mengajak verifikasi |
| Titik palsu atau spam | Titik baru berstatus New sampai dua orang lain mengonfirmasi; laporan menurunkan skor; moderator bisa menyembunyikan |
| Konfirmasi tanpa benar-benar datang | Tidak bisa dicegah sepenuhnya di v1; diredam oleh masa tunggu 30 hari, batas skor, dan laporan dari orang lain. Dinyatakan terbuka di halaman About |
| Penyedia ubin peta mati atau mengubah syarat | Penyedia cadangan; daftar terdekat tidak bergantung pada peta |
| Jejak lokasi wallet menjadi publik | Peringatan sebelum konfirmasi pertama; dijelaskan di About |
| Kueri geografis di chain mahal atau lambat | Indeks sel 0,1°; batas sel per panggilan; minta perbesar saat zoom jauh |
| Dinilai mirip project lain | Tidak ada peta fasilitas umum di direktori; mekanik kesegaran orisinal; tampilan berbasis peta |
| Ukuran pustaka peta besar | Dimuat belakangan; kerangka dan daftar tampil dulu |

## 17. Kriteria terima

1. Satu wallet menambah titik; dua wallet lain mengonfirmasi; status berubah dari New menjadi Verified.
2. Contract menolak: konfirmasi oleh penambah titik, konfirmasi kedua dari wallet yang sama dalam 30 hari, koordinat di luar rentang, titik tanpa fasilitas.
3. Status berubah menjadi Stale setelah 90 hari tanpa konfirmasi, dibuktikan dengan test yang memajukan waktu.
4. Dua laporan masalah dari wallet berbeda mengubah titik menjadi Reported gone.
5. Titik yang ditambahkan muncul di sel yang benar dan tampil saat peta digeser ke lokasinya.
6. Seluruh alur bisa diselesaikan lewat daftar tanpa menyentuh peta.
7. Peta dan panel detail nyaman dipakai di 375 px.
8. Nama BOT Chain dan kedua tautan wajib terlihat di beranda dan di footer halaman lain.
9. Contract terverifikasi di scan.botchain.ai dan alamatnya tampil di situs.

## 18. Hal yang masih terbuka

- **Nama project:** Colok atau Calok (lihat catatan di atas).
- Apakah empat fasilitas (Power, Wi-Fi, Water, Seating) sudah tepat, atau ada yang perlu ditambah.
- Ambang verifikasi: dua konfirmasi, masa tunggu 30 hari, usang setelah 90 hari.
- Kota atau kampus untuk peluncuran, yang menentukan titik awal.
- Nama akun X dan domain.
- Kriteria ketujuh program, yang belum tercantum di materi.
