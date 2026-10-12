#!/usr/bin/env bash
# ==============================================================================
# YouTube Downloader Pro - Startup Launcher
# ==============================================================================

set -e
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "======================================================================"
echo "          🚀 YOUTUBE DOWNLOADER PRO (High-Res + TV Ready)            "
echo "======================================================================"
echo " - Direktori: $PROJECT_DIR"
echo " - Penyimpanan: $PROJECT_DIR/downloads"
echo " - Kompatibilitas: H.264 (yuv420p) + Audio AAC Stereo (Smart TV Ready)"
echo "----------------------------------------------------------------------"

# Check FFmpeg dependency
if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "⚠️  PERINGATAN: 'ffmpeg' belum terdeteksi di sistem!"
    echo "   YouTube resolusi tinggi (1080p+) & konversi format TV membutuhkan FFmpeg."
    echo "   Silakan install FFmpeg terlebih dahulu:"
    echo "     - Ubuntu/Debian: sudo apt update && sudo apt install -y ffmpeg"
    echo "     - Arch Linux:    sudo pacman -S ffmpeg"
    echo "     - Fedora:        sudo dnf install ffmpeg"
    echo "     - macOS:         brew install ffmpeg"
    echo "     - Windows:       winget install Gyan.FFmpeg"
    echo "----------------------------------------------------------------------"
fi

# Ensure venv exists
if [ ! -d ".venv" ]; then
    echo "🔧 Virtual environment (.venv) belum ada, menyiapkan otomatis..."
    if command -v uv >/dev/null 2>&1; then
        echo "✔ Menggunakan uv package manager (ekstra cepat)..."
        uv venv .venv
        .venv/bin/python -m uv pip install -r requirements.txt
    elif [ -x "$HOME/.local/bin/uv" ]; then
        echo "✔ Menggunakan uv di $HOME/.local/bin/uv..."
        "$HOME/.local/bin/uv" venv .venv
        .venv/bin/python -m uv pip install -r requirements.txt
    else
        echo "✔ Menggunakan python3 venv standar..."
        if ! command -v python3 >/dev/null 2>&1; then
            echo "❌ Error: Python 3 tidak ditemukan. Silakan install Python 3.10+ terlebih dahulu."
            exit 1
        fi
        python3 -m venv .venv
        .venv/bin/pip install --upgrade pip
        .venv/bin/pip install -r requirements.txt
    fi
    echo "✔ Environment berhasil disiapkan!"
    echo "----------------------------------------------------------------------"
fi

# Detect free port (default 8000)
PORT=8000
if command -v lsof >/dev/null 2>&1; then
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
        PORT=8080
    fi
fi

echo " Membuka server di: http://localhost:$PORT"
echo " Tekan Ctrl+C untuk menghentikan server."
echo "======================================================================"

# Auto-open browser in background if browser opener available
if command -v xdg-open >/dev/null 2>&1; then
    (sleep 1 && xdg-open "http://localhost:$PORT" >/dev/null 2>&1 &) || true
elif command -v open >/dev/null 2>&1; then
    (sleep 1 && open "http://localhost:$PORT" >/dev/null 2>&1 &) || true
fi

# Run uvicorn
exec "$PROJECT_DIR/.venv/bin/python" -m uvicorn app:app --host 0.0.0.0 --port $PORT --reload
