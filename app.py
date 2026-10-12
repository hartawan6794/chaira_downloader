"""
YouTube Downloader Pro - FastAPI Application
Provides REST API, WebSockets for real-time progress, file streaming, and web interface.
Includes TV Compatibility Mode (H.264 / AVC + AAC).
"""

import os
import uuid
import asyncio
import subprocess
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import downloader

app = FastAPI(title="YouTube Downloader Pro", version="1.0.0")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
DOWNLOADS_DIR = os.path.join(BASE_DIR, "downloads")

os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(os.path.join(STATIC_DIR, "css"), exist_ok=True)
os.makedirs(os.path.join(STATIC_DIR, "js"), exist_ok=True)
os.makedirs(TEMPLATES_DIR, exist_ok=True)
os.makedirs(DOWNLOADS_DIR, exist_ok=True)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class InfoRequest(BaseModel):
    url: str


class DownloadRequest(BaseModel):
    url: str
    format_type: str        # 'video' or 'audio'
    quality: str            # e.g. '1080', '2160', 'mp3-320'
    tv_mode: bool = True    # H.264 (AVC) + AAC Stereo for 100% TV compatibility


class ConvertRequest(BaseModel):
    filename: str


@app.get("/", response_class=HTMLResponse)
async def get_index():
    index_file = os.path.join(TEMPLATES_DIR, "index.html")
    if os.path.exists(index_file):
        with open(index_file, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse("<h1>YouTube Downloader Pro - Template Missing</h1>", status_code=500)


@app.post("/api/info")
async def get_info(req: InfoRequest):
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL cannot be empty")
    try:
        data = downloader.extract_info(url)
        return data
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Gagal mengambil detail video: {str(e)}")


@app.post("/api/download")
async def start_download(req: DownloadRequest):
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL cannot be empty")

    job_id = uuid.uuid4().hex
    job = downloader.downloader_manager.start_download(
        job_id=job_id,
        url=url,
        format_type=req.format_type,
        quality=req.quality,
        tv_mode=req.tv_mode
    )
    return {"job_id": job.job_id, "status": job.status}


@app.post("/api/convert-tv")
async def convert_to_tv(req: ConvertRequest):
    """Converts an existing file to H.264 (yuv420p) + AAC for TV compatibility."""
    filename = os.path.basename(req.filename.strip())
    filepath = os.path.join(DOWNLOADS_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File tidak ditemukan")

    job_id = uuid.uuid4().hex
    job = downloader.downloader_manager.start_tv_conversion(job_id=job_id, input_filename=filename)
    return {"job_id": job.job_id, "status": job.status}


@app.get("/api/progress/{job_id}")
async def get_progress(job_id: str):
    job = downloader.downloader_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job.to_dict()


@app.websocket("/ws/{job_id}")
async def websocket_progress(websocket: WebSocket, job_id: str):
    await websocket.accept()
    job = downloader.downloader_manager.get_job(job_id)
    if not job:
        await websocket.send_json({"error": "Job not found", "status": "error"})
        await websocket.close()
        return

    # Push job state periodically. (Previously this awaited receive_text(),
    # which blocked forever because the browser never sends messages.)
    last_sent = None
    try:
        while True:
            data = job.to_dict()
            if data != last_sent:
                await websocket.send_json(data)
                last_sent = data
            if data.get("status") in ("finished", "error"):
                break
            await asyncio.sleep(0.4)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass


@app.get("/api/history")
async def get_history():
    """Returns list of downloaded files with codec info and TV compatibility indicator."""
    files = []
    if os.path.exists(DOWNLOADS_DIR):
        for entry in os.scandir(DOWNLOADS_DIR):
            if entry.is_file() and not entry.name.endswith((".part", ".ytdl", ".temp", ".tv.mp4")):
                stat = entry.stat()
                ext = os.path.splitext(entry.name)[1].lower().replace(".", "")
                is_video = ext in ["mp4", "mkv", "webm", "avi", "mov"]
                is_audio = ext in ["mp3", "m4a", "wav", "aac", "opus", "flac"]

                vcodec = ""
                acodec = ""
                tv_ready = False

                if is_video:
                    vcodec = downloader.downloader_manager._probe_video_codec(entry.path) or ""
                    # Check audio codec
                    try:
                        cmd = [
                            "ffprobe", "-v", "error",
                            "-select_streams", "a:0",
                            "-show_entries", "stream=codec_name",
                            "-of", "default=noprint_wrappers=1:nokey=1",
                            entry.path
                        ]
                        res = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
                        acodec = res.stdout.strip().lower()
                    except Exception:
                        acodec = ""

                    tv_ready = (vcodec in ["h264", "avc1"]) and (acodec in ["aac", "mp3"])

                files.append({
                    "filename": entry.name,
                    "size": downloader.format_bytes(stat.st_size),
                    "bytes": stat.st_size,
                    "modified": datetime.fromtimestamp(stat.st_mtime).strftime("%d %b %Y, %H:%M"),
                    "mtime": stat.st_mtime,
                    "ext": ext,
                    "is_video": is_video,
                    "is_audio": is_audio,
                    "vcodec": vcodec,
                    "acodec": acodec,
                    "tv_ready": tv_ready
                })

    files.sort(key=lambda x: x["mtime"], reverse=True)
    return {"files": files}


@app.get("/api/file/{filename}")
async def download_file(filename: str):
    """Direct file download from the browser."""
    safe_filename = os.path.basename(filename)
    file_path = os.path.join(DOWNLOADS_DIR, safe_filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File tidak ditemukan")
    return FileResponse(
        path=file_path,
        filename=safe_filename,
        media_type="application/octet-stream"
    )


@app.get("/api/stream/{filename}")
async def stream_file(filename: str):
    """Stream media file directly for in-browser preview."""
    safe_filename = os.path.basename(filename)
    file_path = os.path.join(DOWNLOADS_DIR, safe_filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File tidak ditemukan")

    ext = os.path.splitext(safe_filename)[1].lower()
    media_type = "video/mp4"
    if ext == ".mp3":
        media_type = "audio/mpeg"
    elif ext == ".m4a":
        media_type = "audio/mp4"
    elif ext == ".webm":
        media_type = "video/webm"

    return FileResponse(path=file_path, media_type=media_type)


@app.delete("/api/file/{filename}")
async def delete_file(filename: str):
    """Delete a downloaded file."""
    safe_filename = os.path.basename(filename)
    file_path = os.path.join(DOWNLOADS_DIR, safe_filename)
    if os.path.exists(file_path):
        os.remove(file_path)
        return {"success": True, "message": "File berhasil dihapus"}
    raise HTTPException(status_code=404, detail="File tidak ditemukan")


@app.post("/api/open-folder")
async def open_downloads_folder():
    """Opens the local downloads folder using the system file manager."""
    try:
        subprocess.Popen(["xdg-open", DOWNLOADS_DIR])
        return {"success": True, "path": DOWNLOADS_DIR}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tidak dapat membuka folder: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
