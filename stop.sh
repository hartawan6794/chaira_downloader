#!/usr/bin/env bash
# ==============================================================================
# YouTube Downloader Pro - Stop Script
# ==============================================================================

echo "======================================================================"
echo "          🛑 MENGHENTIKAN YOUTUBE DOWNLOADER PRO                      "
echo "======================================================================"

# 1. Hentikan uvicorn yang menjalankan app
if pkill -f "uvicorn app:app" ; then
    echo "✔ Proses server uvicorn berhasil dihentikan."
else
    echo "ℹ Tidak ada proses uvicorn aktif yang ditemukan."
fi

# 2. Pastikan port 8000 dan 8080 bebas
if command -v fuser >/dev/null 2>&1; then
    fuser -k 8000/tcp >/dev/null 2>&1 || true
    fuser -k 8080/tcp >/dev/null 2>&1 || true
fi

# 3. Opsional: periksa jika masih ada port yang listen
if command -v lsof >/dev/null 2>&1; then
    PORT_PID=$(lsof -ti :8000 2>/dev/null || true)
    if [ -n "$PORT_PID" ]; then
        kill -9 $PORT_PID 2>/dev/null || true
        echo "✔ Port 8000 berhasil dibebaskan."
    fi
fi

echo "======================================================================"
echo "✅ Aplikasi telah berhasil dihentikan sepenuhnya."
echo "======================================================================"
