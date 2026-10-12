# YouTube Downloader Pro 🚀

### Solusi Download Video YouTube Resolusi Tinggi + Audio Utuh + TV Ready (H.264 & AAC)

Aplikasi web modern berbasis **FastAPI**, **yt-dlp**, dan **FFmpeg** yang dirancang khusus untuk mengatasi 2 masalah umum unduhan YouTube:

1. **Audio Hilang pada Resolusi Tinggi (1080p, 2K, 4K, 8K)**.
2. **Video Tidak Bisa Diputar di Smart TV / Android TV / USB Flashdisk** (karena codec VP9/AV1/Opus yang tidak didukung decoder TV).

---

## 💡 Mengapa Masalah Tersebut Terjadi?

### 1. Masalah Audio Hilang pada Resolusi Tinggi

- YouTube tidak lagi menyediakan file video tunggal (muxed) untuk resolusi 1080p ke atas.
- Resolusi tinggi dipisah menjadi **Stream Video DASH** (tanpa suara) dan **Stream Audio DASH** (tanpa video).
- **Solusi Kami**: Mengunduh kedua stream terbaik (`bestvideo` + `bestaudio`) secara paralel, lalu menggabungkannya secara sempurna menggunakan **FFmpeg** menjadi kontainer MP4 utuh.

### 2. Masalah Video Tidak Bisa Diputar di TV

- YouTube sering kali menyajikan video resolusi tinggi dengan codec modern seperti **VP9** atau **AV1**, serta audio **Opus**.
- Mayoritas Smart TV (Samsung Tizen, LG webOS, Android TV, TV tabung/box USB) **tidak memiliki hardware decoder untuk AV1/Opus**, sehingga TV hanya menampilkan layar hitam, error format tidak didukung, atau video jalan tapi bisu.
- **Solusi Kami (Mode Kompatibel TV)**:
  - Mengutamakan stream native **H.264 (AVC1)** dan **AAC** dari YouTube (download instan tanpa re-encoding jika tersedia).
  - Jika video hanya tersedia dalam format VP9/AV1 (misal 2K/4K), aplikasi otomatis mengonversi ke **H.264** dengan pixel format standar **`yuv420p`** dan audio **`AAC stereo 192kbps`** serta tag **`+faststart`** agar USB flashdisk langsung bisa membacanya tanpa jeda!

---

## ✨ Fitur Unggulan

- **Resolusi Penuh**: Pilihan 8K, 4K UHD, 2K QHD, 1080p Full HD (hingga 60fps), 720p HD, 480p, 360p.
- **Audio Utuh & Ekstraksi Musik**:
  - MP3 320 kbps (Ultra High Quality).
  - MP3 192 kbps (Standard).
  - M4A / AAC (Kualitas Asli YouTube).
- **Mode Kompatibel TV (H.264 + AAC)**: Saklar otomatis untuk menjamin hasil unduhan 100% kompatibel di semua televisi.
- **Fitur Konversi TV 1-Klik**: Tombol konversi langsung di riwayat unduhan untuk memperbaiki video lama yang gagal putar di TV.
- **Real-Time Live Progress**: Indikator persentase, kecepatan unduh (MB/s), estimasi waktu (ETA), dan status muxing FFmpeg via WebSocket.
- **Dual Delivery**:
  - Otomatis tersimpan di folder lokal `downloads/` pada komputer Anda.
  - Tombol download instan langsung melalui browser.
- **Buka Folder di Komputer**: Tombol khusus untuk langsung membuka file manager Linux (`xdg-open`).
- **Player Media Bawaan**: Tonton dan dengarkan langsung hasil unduhan di browser untuk memastikan kualitas video dan suara sebelum dipindahkan ke flashdisk.
- **Desain Glassmorphism Mewah**: Antarmuka gelap modern dengan animasi halus dan responsif.

---

## 🛠️ Persyaratan Sistem

Pastikan device baru telah memiliki:
1. **Python 3.10+** (bersama `python3-venv` dan `pip`)
2. **FFmpeg** (Wajib untuk menggabungkan audio/video resolusi tinggi dan transcoding TV)
3. **Git**

---

## 💻 Panduan Konfigurasi Awal di Device Lain (Device Baru)

Ikuti langkah-langkah mudah di bawah ini untuk memasang dan menjalankan aplikasi di komputer/laptop lain:

### 1. Install FFmpeg di Device Baru

FFmpeg diperlukan untuk memproses audio 1080p+ dan membuat video TV-compatible:

- **Ubuntu / Debian / Linux Mint**:
  ```bash
  sudo apt update && sudo apt install -y ffmpeg python3-venv python3-pip
  ```
- **Arch Linux / Manjaro**:
  ```bash
  sudo pacman -S ffmpeg python
  ```
- **Fedora / RHEL**:
  ```bash
  sudo dnf install ffmpeg python3
  ```
- **macOS (Homebrew)**:
  ```bash
  brew install ffmpeg python
  ```
- **Windows (PowerShell / Winget)**:
  ```powershell
  winget install Gyan.FFmpeg
  ```

---

### 2. Clone Repository

Buka Terminal atau Command Prompt di device baru, lalu clone repo:

```bash
git clone https://github.com/hartawan6794/chaira_downloader.git
cd chaira_downloader
```

---

### 3. Menjalankan Aplikasi

#### ⚡ Opsi A: Cara Cepat & Otomatis (Linux / macOS)

Script `start.sh` sudah dirancang otomatis menyiapkan virtual environment, menginstal dependensi dari `requirements.txt`, dan langsung membuka browser:

```bash
chmod +x start.sh stop.sh
./start.sh
```

> **Note**: Jika device memiliki package manager [uv](https://github.com/astral-sh/uv), instalasi dependensi akan selesai hanya dalam 2-3 detik. Jika tidak ada, script otomatis menggunakan `python3 -m venv` bawaan.

#### 🛠️ Opsi B: Cara Manual (Semua OS Termasuk Windows)

1. **Buat & aktifkan virtual environment:**
   ```bash
   # Linux / macOS:
   python3 -m venv .venv
   source .venv/bin/activate

   # Windows (Command Prompt / PowerShell):
   python -m venv .venv
   .venv\Scripts\activate
   ```

2. **Instal dependensi:**
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

3. **Jalankan server:**
   ```bash
   python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload
   ```

4. **Buka di Browser:**
   Akses melalui browser di alamat:
   👉 **[http://localhost:8000](http://localhost:8000)**

---

### 4. Menghentikan Server

- **Di terminal**: Tekan tombol `Ctrl + C`
- **Atau via script (Linux/macOS)**:
  ```bash
  ./stop.sh
  ```

---

## 📁 Struktur Direktori

```
chaira_downloader/
├── .gitignore          # Konfigurasi file yang diabaikan Git (cache, downloads, venv)
├── app.py              # Server FastAPI, REST API & WebSocket handler
├── downloader.py       # Engine downloader yt-dlp & FFmpeg muxer + TV transcoder
├── requirements.txt    # Daftar pustaka Python yang dibutuhkan
├── start.sh            # Script launcher otomatis & pengecek sistem
├── stop.sh             # Script penghenti server & pembersih port
├── downloads/          # Direktori penyimpanan hasil download video/audio
├── templates/
│   └── index.html      # Tampilan antarmuka web (UI)
└── static/
    ├── css/
    │   └── style.css   # Styling modern glassmorphic
    └── js/
        └── app.js      # Interaktivitas front-end & WebSocket live progress
```

---

## 🔧 Tips Pemeliharaan & Troubleshooting

1. **Memperbarui yt-dlp secara berkala:**
   YouTube sering mengubah algoritma enkripsinya. Jika unduhan gagal di kemudian hari, perbarui `yt-dlp` ke versi terbaru:
   ```bash
   .venv/bin/pip install --upgrade yt-dlp
   ```

2. **Port 8000 sudah terpakai:**
   Script `./start.sh` akan otomatis beralih ke port `8080` jika port 8000 sedang digunakan oleh aplikasi lain.

3. **Akses dari Device Lain dalam Satu Jaringan Wi-Fi:**
   Server berjalan di host `0.0.0.0`, sehingga Anda juga dapat membuka antarmuka downloader dari HP / tablet dengan mengakses `http://<IP_KOMPUTER>:8000`.
