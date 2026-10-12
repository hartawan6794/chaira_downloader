"""
YouTube Downloader Pro - FastAPI Application
Provides REST API, WebSockets for real-time progress, file streaming, and web interface.
Includes TV Compatibility Mode (H.264 / AVC + AAC).
"""

import os
import sys
import uuid
import asyncio
import subprocess
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
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

# Auto-cleanup configuration: Files older than 15 minutes are automatically purged
FILE_TTL_SECONDS = 900           # 15 minutes
CLEANUP_INTERVAL_SECONDS = 180   # Run every 3 minutes


async def auto_cleanup_worker():
    """Background worker to purge expired temporary files and session directories."""
    while True:
        await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)
        try:
            now = datetime.now().timestamp()
            if os.path.exists(DOWNLOADS_DIR):
                for root, dirs, files in os.walk(DOWNLOADS_DIR, topdown=False):
                    for f in files:
                        fp = os.path.join(root, f)
                        try:
                            stat = os.stat(fp)
                            if now - stat.st_mtime > FILE_TTL_SECONDS:
                                os.remove(fp)
                        except Exception:
                            pass
                    if root != DOWNLOADS_DIR:
                        try:
                            if not os.listdir(root):
                                os.rmdir(root)
                        except Exception:
                            pass
        except Exception:
            pass


@app.on_event("startup")
async def startup_cleanup():
    asyncio.create_task(auto_cleanup_worker())


class InfoRequest(BaseModel):
    url: str


class DownloadRequest(BaseModel):
    url: str
    format_type: str        # 'video' or 'audio'
    quality: str            # e.g. '1080', '2160', 'mp3-320'
    tv_mode: bool = True    # H.264 (AVC) + AAC Stereo for 100% TV compatibility
    session_id: Optional[str] = None


class ConvertRequest(BaseModel):
    filename: str
    session_id: Optional[str] = None


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
        tv_mode=req.tv_mode,
        session_id=req.session_id
    )
    return {"job_id": job.job_id, "status": job.status, "session_id": job.session_id}


@app.post("/api/convert-tv")
async def convert_to_tv(req: ConvertRequest):
    """Converts an existing file to H.264 (yuv420p) + AAC for TV compatibility."""
    filename = os.path.basename(req.filename.strip())
    session_dir = os.path.join(DOWNLOADS_DIR, os.path.basename(req.session_id)) if req.session_id else DOWNLOADS_DIR
    filepath = os.path.join(session_dir, filename)
    if not os.path.exists(filepath):
        fallback = os.path.join(DOWNLOADS_DIR, filename)
        if os.path.exists(fallback):
            filepath = fallback
        else:
            raise HTTPException(status_code=404, detail="File tidak ditemukan")

    job_id = uuid.uuid4().hex
    job = downloader.downloader_manager.start_tv_conversion(job_id=job_id, input_filename=filename, session_id=req.session_id)
    return {"job_id": job.job_id, "status": job.status, "session_id": job.session_id}


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

    # Push job state periodically.
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
async def get_history(session_id: Optional[str] = None):
    """Returns list of downloaded files for this user session with codec info."""
    files = []
    target_dir = os.path.join(DOWNLOADS_DIR, os.path.basename(session_id)) if session_id else None
    if target_dir and os.path.exists(target_dir):
        for entry in os.scandir(target_dir):
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
                    try:
                        cmd = [
                            downloader.FFPROBE_BIN, "-v", "error",
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


def _resolve_file_path(filename: str, session_id: Optional[str] = None) -> Optional[str]:
    safe_filename = os.path.basename(filename)
    if session_id:
        sess_path = os.path.join(DOWNLOADS_DIR, os.path.basename(session_id), safe_filename)
        if os.path.exists(sess_path):
            return sess_path
    root_path = os.path.join(DOWNLOADS_DIR, safe_filename)
    if os.path.exists(root_path):
        return root_path
    return None


@app.get("/api/file/{filename}")
async def download_file(
    filename: str,
    session_id: Optional[str] = None,
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """Direct file download from the browser with automatic server cleanup."""
    file_path = _resolve_file_path(filename, session_id)
    if not file_path:
        raise HTTPException(status_code=404, detail="File tidak ditemukan atau sudah dibersihkan dari server.")

    safe_filename = os.path.basename(file_path)

    # Schedule deletion 60s after download starts (allowing multi-threaded chunks to complete)
    async def delayed_delete(target_file: str, parent_dir: Optional[str]):
        await asyncio.sleep(60)
        try:
            if os.path.exists(target_file):
                os.remove(target_file)
            if parent_dir and os.path.exists(parent_dir) and parent_dir != DOWNLOADS_DIR:
                if not os.listdir(parent_dir):
                    os.rmdir(parent_dir)
        except Exception:
            pass

    parent_dir = os.path.dirname(file_path)
    background_tasks.add_task(asyncio.create_task, delayed_delete(file_path, parent_dir))

    return FileResponse(
        path=file_path,
        filename=safe_filename,
        media_type="application/octet-stream"
    )


@app.get("/api/stream/{filename}")
async def stream_file(filename: str, session_id: Optional[str] = None):
    """Stream media file directly for in-browser preview."""
    file_path = _resolve_file_path(filename, session_id)
    if not file_path:
        raise HTTPException(status_code=404, detail="File tidak ditemukan atau sudah dibersihkan.")

    safe_filename = os.path.basename(file_path)
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
async def delete_file(filename: str, session_id: Optional[str] = None):
    """Delete a downloaded file from server storage."""
    file_path = _resolve_file_path(filename, session_id)
    if file_path and os.path.exists(file_path):
        os.remove(file_path)
        parent_dir = os.path.dirname(file_path)
        if parent_dir != DOWNLOADS_DIR and os.path.exists(parent_dir) and not os.listdir(parent_dir):
            try:
                os.rmdir(parent_dir)
            except Exception:
                pass
        return {"success": True, "message": "File berhasil dihapus dari server"}
    return {"success": True, "message": "File sudah tidak ada di server"}


@app.post("/api/open-folder")
async def open_downloads_folder():
    """Opens the local downloads folder using the system file manager."""
    try:
        if os.name == "nt":
            os.startfile(DOWNLOADS_DIR)
        elif sys.platform == "darwin":
            subprocess.Popen(["open", DOWNLOADS_DIR])
        else:
            subprocess.Popen(["xdg-open", DOWNLOADS_DIR])
        return {"success": True, "path": DOWNLOADS_DIR}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tidak dapat membuka folder: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
