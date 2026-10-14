# Suwandi SecondBranded: instalasi, cara pakai, dan deploy

Website toko sepatu bekas bermerek di Medan: katalog (etalase), checkout dengan reservasi otomatis, pembayaran transfer
dengan bukti, panel pegawai, dashboard owner, dan AI chatbot. Monorepo: `apps/web` (Vue 3 + PrimeVue), `apps/api`
(NestJS + Prisma), `packages/shared` (enum dan tipe bersama), database PostgreSQL.

Daftar isi:

1. [Kebutuhan](#1-kebutuhan)
2. [Instalasi lokal](#2-instalasi-lokal)
3. [Variabel lingkungan (.env)](#3-variabel-lingkungan-env)
4. [Menjalankan dan akun demo](#4-menjalankan-dan-akun-demo)
5. [Cara pakai](#5-cara-pakai)
6. [Perintah penting](#6-perintah-penting)
7. [Deploy ke produksi](#7-deploy-ke-produksi)
8. [Masalah umum](#8-masalah-umum)
9. [Batasan saat ini](#9-batasan-saat-ini)

---

## 1. Kebutuhan

| Perangkat             | Versi                 | Catatan                                                             |
| --------------------- | --------------------- | ------------------------------------------------------------------- |
| Node.js               | 22.18 atau lebih baru | seed dijalankan langsung dari file `.ts`                            |
| npm                   | 10+                   | ikut terpasang bersama Node                                         |
| PostgreSQL            | 15+                   | lokal, atau lewat Docker (`docker-compose.yml`)                     |
| Git                   | bebas                 |                                                                     |
| Docker Desktop        | opsional              | hanya bila Postgres mau dijalankan lewat Docker                     |
| API key Google Gemini | opsional              | untuk mode AI chatbot; tanpa key chatbot tetap jalan dalam mode FAQ |

## 2. Instalasi lokal

Semua perintah dijalankan dari folder root repo.

```bash
# 1. Ambil kode dan pasang dependency semua workspace
git clone <url-repo> MPTI-Capstone
cd MPTI-Capstone
npm install

# 2. Siapkan database PostgreSQL
#    Pilihan A, Docker (user/password/db = ssb/ssb/ssb):
docker compose up -d db
#    Pilihan B, Postgres lokal: buat database kosong, mis. `createdb ssb_capstone`

# 3. Buat file env API dari contoh, lalu isi (lihat bagian 3)
cp apps/api/.env.example apps/api/.env        # PowerShell: Copy-Item apps/api/.env.example apps/api/.env

# 4. Buat tabel dan isi data contoh
npm run db:migrate -w apps/api               # prisma migrate dev
npm run db:seed -w apps/api                  # produk, rekening, FAQ, akun demo

# 5. Jalankan web + API bersamaan
npm run dev
```

Setelah jalan:

- Web: http://localhost:5173
- API: http://localhost:3000/api (cek kesehatan: http://localhost:3000/api/health)

Web dev server meneruskan semua permintaan `/api` ke API (proxy Vite), jadi cookie login berjalan di satu origin.

> **Peringatan:** `npm run db:seed` menghapus dan mengisi ulang data. Jangan jalankan di database produksi yang sudah berisi
> transaksi asli.

## 3. Variabel lingkungan (.env)

File: `apps/api/.env` (tidak di-commit; contoh lengkap di `apps/api/.env.example`). Divalidasi saat API start, jadi API
berhenti dengan pesan jelas bila ada yang salah.

| Nama                     | Wajib | Contoh / default                                        | Fungsi                                                                 |
| ------------------------ | ----- | ------------------------------------------------------- | ---------------------------------------------------------------------- |
| `NODE_ENV`               | tidak | `development`                                           | `production` di server (cookie jadi `Secure`)                          |
| `PORT`                   | tidak | `3000`                                                  | port API                                                               |
| `DATABASE_URL`           | ya    | `postgresql://ssb:ssb@localhost:5432/ssb?schema=public` | koneksi PostgreSQL                                                     |
| `JWT_SECRET`             | ya    | minimal 32 karakter acak                                | tanda tangan token login                                               |
| `APP_URL`                | tidak | `http://localhost:5173`                                 | alamat web, dipakai di tautan email (reset password, undangan pegawai) |
| `UPLOAD_DIR`             | tidak | `uploads`                                               | folder foto produk (publik) dan bukti transfer (privat)                |
| `TRUST_PROXY`            | tidak | `0`                                                     | jumlah reverse proxy di depan API; `1` di belakang Caddy/Nginx         |
| `GEMINI_API_KEY`         | tidak | kosong                                                  | key dari https://aistudio.google.com/apikey; kosong = chatbot mode FAQ |
| `GEMINI_MODEL`           | tidak | `gemini-3.5-flash-lite`                                 | model Gemini; ganti bila Google memensiunkan model                     |
| `SMTP_HOST`              | tidak | kosong                                                  | server SMTP; kosong = email hanya dicetak ke log API                   |
| `SMTP_PORT`              | tidak | `587`                                                   | `587` STARTTLS, `465` TLS, `1025` Mailpit dev                          |
| `SMTP_USER`, `SMTP_PASS` | tidak | kosong                                                  | login SMTP                                                             |
| `MAIL_FROM`              | tidak | `Suwandi SecondBranded <no-reply@localhost>`            | alamat pengirim email                                                  |

Membuat `JWT_SECRET` acak:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Variabel untuk web dev server (opsional, diatur di terminal saat `npm run dev`):

| Nama      | Default                 | Fungsi                                               |
| --------- | ----------------------- | ---------------------------------------------------- |
| `API_URL` | `http://localhost:3000` | tujuan proxy `/api` bila API dijalankan di port lain |

Contoh bila port 3000 sudah dipakai aplikasi lain:

```bash
PORT=3001 API_URL=http://localhost:3001 npm run dev          # Git Bash / macOS / Linux
```

```powershell
$env:PORT=3001; $env:API_URL='http://localhost:3001'; npm run dev   # PowerShell
```

Setelah mengubah `.env`, **restart API** (env hanya dibaca saat start).

## 4. Menjalankan dan akun demo

Akun dari seed, semua dengan password **`ssb-demo-123`**:

| Peran    | Email                                                            | Halaman awal setelah masuk |
| -------- | ---------------------------------------------------------------- | -------------------------- |
| Owner    | `owner@ssb.test`                                                 | `/panel/owner/dashboard`   |
| Pegawai  | `pegawai1@ssb.test`, `pegawai2@ssb.test`                         | `/panel/dashboard`         |
| Customer | `customer1@ssb.test`, `customer2@ssb.test`, `customer3@ssb.test` | beranda                    |

Halaman masuk: http://localhost:5173/masuk. Pengunjung tanpa akun bisa melihat katalog, Kanal Resmi, dan chatbot.

Data toko di seed (alamat, WA, rekening) masih berisi `[isi oleh owner]`. Ganti lewat **Owner → Pengaturan toko**.

## 5. Cara pakai

### Customer

1. **Cari sepatu**: Beranda atau Katalog (filter merek, ukuran, kondisi, harga, urutan). Tiap sepatu hanya 1 unit.
2. **Keranjang**: "Tambah ke Keranjang" di halaman sepatu. Keranjang belum mengunci sepatu; sepatu yang keburu dipesan orang lain
   ditandai dan tidak ikut total.
3. **Checkout**: isi penerima, pilih ambil di toko atau dikirim, centang persetujuan, "Buat Pesanan". Sepatu langsung
   **direservasi** selama batas bayar (default 24 jam). Bila bentrok dengan pembeli lain, sepatu itu dicoret dan total diperbarui.
4. **Bayar**: transfer ke rekening resmi yang tampil di halaman bayar (ada hitung mundur dan tombol salin).
5. **Upload bukti**: foto/screenshot atau PDF (maks 5 MB), isi nama pengirim, bank, nominal.
6. **Pesanan saya** (`/pesanan`): status per tab, timeline, alasan bila bukti ditolak (bisa unggah ulang), nomor resi,
   invoice setelah pembayaran diverifikasi (cetak/simpan PDF dari browser).
7. **Profil** (`/profil`): data diri, alamat, ganti password.
8. **Tanya Asisten**: chatbot untuk mencari sepatu ("ada Nike 42 di bawah 500 ribu?"), cara bayar, jam buka.

Pesanan yang tidak dibayar sampai batas waktu dibatalkan otomatis (dicek tiap menit), dan sepatunya kembali tersedia.

### Pegawai (`/panel/...`)

1. **Dashboard**: jumlah tugas hari ini, daftar "Perlu tindakan", reservasi yang hampir habis.
2. **Verifikasi bayar**: buka antrean bukti (terlama di atas), bandingkan nominal, cek mutasi rekening toko, centang
   "Dana sudah masuk", lalu **Terima**. Atau **Tolak** dengan alasan (minimal 10 karakter, dibaca customer).
3. **Kelola pesanan**: klik kode pesanan untuk membuka detail, lalu Tandai Siap Diambil / isi ekspedisi dan resi lalu
   Tandai Dikirim / Tandai Selesai / Batalkan (alasan wajib).
4. **Ganti password**: ikon kunci di bawah menu samping (`/panel/password`).
5. **Produk**: tambah sepatu (3-6 foto, foto utama, kondisi, minus), ubah data/harga, nonaktifkan. Harga sepatu yang sedang
   dipesan atau terjual terkunci.

### Owner (`/panel/owner/...`)

Semua fitur pegawai, ditambah:

1. **Dashboard bisnis**: pendapatan, sepatu terjual, grafik harian/mingguan/bulanan, status pesanan, merek dan ukuran terlaris.
2. **Laporan penjualan**: filter tanggal dan metode, **Ekspor PDF / Excel**.
3. **Performa produk**: lama terjual, per merek/kategori/ukuran, sepatu belum laku lebih dari 30 hari.
4. **Akun**: undang pegawai (email undangan untuk membuat password), aktif/nonaktifkan akun, kirim tautan reset password.
5. **Log aktivitas**: semua perubahan penting (verifikasi, status pesanan, harga, pengaturan), bisa difilter.
6. **Pengaturan toko**: rekening resmi (setiap perubahan minta password owner), WhatsApp, Instagram, TikTok, alamat, jam buka,
   batas waktu bayar, cara ambil sepatu, FAQ chatbot. Semua langsung tampil di halaman Kanal Resmi dan instruksi bayar.

## 6. Perintah penting

| Perintah                                              | Fungsi                                                 |
| ----------------------------------------------------- | ------------------------------------------------------ |
| `npm run dev`                                         | web (5173) + API (3000) bersamaan                      |
| `npm run dev -w apps/web` / `npm run dev -w apps/api` | salah satu saja                                        |
| `npm run lint`                                        | Prettier + ESLint + type check semua workspace         |
| `npm run test`                                        | semua test (unit + e2e API ke database schema `e2e`)   |
| `npm run test:e2e`                                    | Playwright alur pembelian penuh (butuh seed, ADR-0007) |
| `npm run format`                                      | rapikan format kode                                    |
| `npm run db:migrate -w apps/api`                      | buat/terapkan migrasi saat development                 |
| `npm run db:seed -w apps/api`                         | isi ulang data contoh (**menghapus data**)             |
| `npm run db:studio -w apps/api`                       | lihat/ubah isi database lewat Prisma Studio            |
| `npm run build -w packages/shared`                    | build paket bersama (otomatis saat `npm install`)      |

Wajib hijau sebelum commit: `npm run lint && npm run test`.

## 7. Deploy ke produksi

### Prinsip

- Web dan API **harus berada di satu origin** (domain yang sama). Web memanggil `/api/...` secara relatif dan login memakai
  cookie `httpOnly` (ADR-0003). Caranya: reverse proxy yang menyajikan file web dan meneruskan `/api` ke proses Node API.
- Wajib **HTTPS**: di `NODE_ENV=production` cookie login bertanda `Secure`, jadi tidak terkirim lewat HTTP biasa.
- Folder `UPLOAD_DIR` berisi foto produk dan **bukti transfer pelanggan** (privat). Simpan di disk permanen yang ikut di-backup,
  jangan di folder yang hilang saat redeploy.
- Jalankan **satu instance** API (scheduler pembatalan otomatis dan rate limit chatbot disimpan di memori proses).
- Di belakang reverse proxy set `TRUST_PROXY=1`. Tanpa itu semua pengunjung terbaca dengan IP proxy dan berbagi satu kuota
  rate limit chatbot (20 pesan / 10 menit).

```
Browser ── https://toko.example.com ──► Reverse proxy (Caddy / Nginx)
                                          ├─ /api/*  ──► Node API (apps/api, port 3000) ──► PostgreSQL
                                          └─ /*      ──► file statis apps/web/dist (SPA, fallback index.html)
```

### Opsi A: Docker Compose di satu server (disarankan)

Butuh server Linux dengan Docker + Docker Compose, DNS domain mengarah ke server, port 80 dan 443 terbuka. Isinya
(ADR-0008): PostgreSQL, migrasi otomatis, API, dan Caddy (HTTPS otomatis + satu origin untuk web dan `/api`).

```bash
git clone <url-repo> /srv/ssb && cd /srv/ssb
cp .env.production.example .env.production   # isi SITE_ADDRESS, APP_URL, POSTGRES_PASSWORD, JWT_SECRET
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
# Hanya server demo/kosong: data contoh + akun demo
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm migrate npm run db:seed
```

- Update versi: `git pull` lalu ulangi perintah `up -d --build` (migrasi baru dijalankan otomatis sebelum API start).
- Log: `docker compose -f docker-compose.prod.yml logs -f api`.
- Backup: `docker compose -f docker-compose.prod.yml exec db pg_dump -U ssb ssb > backup.sql`, dan volume `ssb-prod_uploads`
  (foto produk + bukti transfer).
- Mencoba di komputer sendiri: `SITE_ADDRESS=localhost`, `APP_URL=https://localhost`, lalu buka https://localhost
  (sertifikat lokal Caddy, browser memberi peringatan). Port 80/443 harus kosong.
- Railway/Render yang mendukung Dockerfile: target `api` untuk API dan `web` untuk proxy + web (ubah `reverse_proxy api:3000`
  di `deploy/Caddyfile` ke alamat internal API di platform itu).

### Opsi B: satu server (VPS) tanpa Docker, dengan Caddy

1. Siapkan server Linux dengan Node.js 22.18+, PostgreSQL 15+, dan Caddy; arahkan DNS domain ke server.
2. Ambil kode dan pasang dependency:
   ```bash
   git clone <url-repo> /srv/ssb && cd /srv/ssb
   npm ci
   ```
3. Buat `apps/api/.env` produksi:
   ```env
   NODE_ENV=production
   PORT=3000
   DATABASE_URL=postgresql://ssb:<password-kuat>@localhost:5432/ssb?schema=public
   JWT_SECRET=<64 karakter acak>
   APP_URL=https://toko.example.com
   UPLOAD_DIR=/var/lib/ssb/uploads
   TRUST_PROXY=1
   GEMINI_API_KEY=<opsional>
   GEMINI_MODEL=gemini-3.5-flash-lite
   ```
4. Build dan siapkan database:
   ```bash
   npm run build -w packages/shared
   npm run build -w apps/api
   npm run build -w apps/web                       # hasil: apps/web/dist
   cd apps/api && npx prisma migrate deploy && cd ../..
   # Hanya untuk server demo/kosong: npm run db:seed -w apps/api
   ```
5. Jalankan API sebagai service (contoh systemd `/etc/systemd/system/ssb-api.service`):
   ```ini
   [Unit]
   Description=SSB API
   After=network.target postgresql.service

   [Service]
   WorkingDirectory=/srv/ssb/apps/api
   ExecStart=/usr/bin/node dist/main
   Restart=always
   User=ssb

   [Install]
   WantedBy=multi-user.target
   ```
   ```bash
   sudo systemctl enable --now ssb-api
   ```
   API membaca `apps/api/.env` dari `WorkingDirectory`.
6. Caddy (`/etc/caddy/Caddyfile`), HTTPS otomatis:
   ```caddy
   toko.example.com {
       encode gzip
       handle /api/* {
           reverse_proxy localhost:3000
       }
       handle {
           root * /srv/ssb/apps/web/dist
           try_files {path} /index.html
           file_server
       }
   }
   ```
   ```bash
   sudo systemctl reload caddy
   ```
7. Login sebagai owner, **ganti password akun demo** (atau jangan jalankan seed), lalu isi Pengaturan toko dan rekening resmi.

Alternatif Nginx (setara dengan langkah 6):

```nginx
server {
    server_name toko.example.com;
    root /srv/ssb/apps/web/dist;
    client_max_body_size 30m;            # unggahan foto produk (6 × 5 MB)
    location /api/ { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $remote_addr; }
    location / { try_files $uri /index.html; }
    # HTTPS: pasang sertifikat dengan certbot --nginx
}
```

### Opsi C: platform (Railway / Render / sejenisnya)

- Buat **PostgreSQL** terkelola dan **satu web service Node** untuk API:
  - build: `npm ci && npm run build -w packages/shared && npm run build -w apps/api && npm run build -w apps/web`
  - start: `cd apps/api && npx prisma migrate deploy && node dist/main`
  - env seperti tabel di bagian 3; `DATABASE_URL` dari database platform.
  - pasang **persistent volume** untuk `UPLOAD_DIR`.
- Agar satu origin, pilih salah satu:
  - frontend di Vercel/Netlify dengan **rewrite** `/api/*` ke URL API (cookie dianggap first-party oleh browser), atau
  - proxy kecil (Caddy/Nginx) di depan API yang juga menyajikan `apps/web/dist` seperti opsi B (atau image target `web` dari opsi A).
- Jangan memanggil API dari domain lain secara langsung: cookie `SameSite=Lax` tidak ikut dan login akan gagal.

### Update versi (opsi B)

```bash
cd /srv/ssb && git pull && npm ci
npm run build -w packages/shared && npm run build -w apps/api && npm run build -w apps/web
cd apps/api && npx prisma migrate deploy && cd ../..
sudo systemctl restart ssb-api
```

### Checklist sebelum go-live

- [ ] `NODE_ENV=production`, `JWT_SECRET` baru dan acak, `APP_URL` = domain asli
- [ ] HTTPS aktif; web dan `/api` di domain yang sama
- [ ] `UPLOAD_DIR` di disk permanen; backup harian database (`pg_dump`) dan folder unggahan
- [ ] Password akun demo diganti atau akun demo tidak dibuat
- [ ] Pengaturan toko dan rekening resmi diisi owner (seed berisi `[isi oleh owner]`)
- [ ] `SMTP_HOST` dan kawan-kawan diisi (email lupa password dan undangan pegawai benar-benar terkirim)
- [ ] `GEMINI_API_KEY` diisi bila mode AI chatbot dipakai

## 8. Masalah umum

| Gejala                                                                                                  | Penyebab dan solusi                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `db:seed` gagal `Unknown file extension ".ts"`, atau `npm run dev` API gagal `ERR_REQUIRE_CYCLE_MODULE` | Node terlalu lama. Pasang Node 22.18 atau lebih baru (`node --version`).                                                                                         |
| `npm install` gagal `EPERM ... query_engine` (Windows)                                                  | API dev server mengunci file Prisma. Hentikan `npm run dev`, ulangi install.                                                                                     |
| `EADDRINUSE :::3000`                                                                                    | Port 3000 dipakai aplikasi lain. Jalankan dengan `PORT=3001 API_URL=http://localhost:3001 npm run dev`.                                                          |
| Halaman dev tampil berantakan setelah membuat file `.vue` baru                                          | Tailwind dev server telat membuat kelas baru. Simpan ulang `apps/web/src/assets/styles/main.css` lalu reload.                                                    |
| Chatbot selalu "Mode FAQ" walau key sudah diisi                                                         | API belum di-restart, atau model ditolak Google. Lihat log API baris `WARN [Chatbot] Gemini gagal, ...`; ganti `GEMINI_MODEL` bila modelnya dipensiunkan.        |
| `curl` ke API gagal di PowerShell                                                                       | Pakai `Invoke-RestMethod -Method Post -Uri http://localhost:5173/api/chat -ContentType 'application/json' -Body '{"messages":[{"role":"user","text":"halo"}]}'`. |
| Login di produksi tidak tersimpan                                                                       | Situs tidak HTTPS, atau web dan API beda domain (lihat bagian 7).                                                                                                |
| API berhenti dengan "Konfigurasi env tidak valid"                                                       | Periksa `apps/api/.env` sesuai tabel bagian 3 (`DATABASE_URL`, `JWT_SECRET` minimal 32 karakter).                                                                |
| Email undangan/reset tidak sampai                                                                       | `SMTP_HOST` kosong: isi email tercetak di log API. Bila SMTP diisi, cek log `[Mail] Gagal mengirim email`.                                                       |

## 9. Batasan saat ini

- **Email** terkirim lewat SMTP bila `SMTP_HOST` diisi (ADR-0009); tanpa itu hanya dicetak ke log API. Untuk mencoba di
  komputer sendiri: `docker compose up -d mailpit`, `SMTP_HOST=localhost`, `SMTP_PORT=1025`, lihat email di http://localhost:8025.
- **Ongkir** tidak dihitung sistem; dikonfirmasi pegawai lewat WhatsApp.
- **Rate limit chatbot** dan **scheduler** berjalan di memori satu proses; jangan jalankan lebih dari satu instance API.
- **Deploy ke server publik** belum dilakukan (T-7.4); konfigurasi Docker sudah siap dan teruji lokal.
