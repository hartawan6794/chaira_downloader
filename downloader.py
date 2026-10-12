"""
YouTube Downloader Pro - Core Downloader Engine
Handles metadata extraction, format filtering, video+audio stream downloading,
FFmpeg merging, TV Compatibility Mode (H.264 / AVC + AAC), smart typo auto-correction,
and 4K/2K Ultra HD support.
"""

import os
import re
import shutil
import asyncio
import subprocess
import threading
from typing import Dict, Any, Optional, Callable, Tuple, List
import yt_dlp

DOWNLOADS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "downloads"))
os.makedirs(DOWNLOADS_DIR, exist_ok=True)

# Detect Node.js binary for yt-dlp JS runtime (prevents YouTube throttling/warnings)
NODE_PATHS = [
    "/home/sits/.nvm/versions/node/v24.18.0/bin/node",
    shutil.which("node"),
    "/usr/bin/node",
    "/usr/local/bin/node"
]
NODE_BIN = next((p for p in NODE_PATHS if p and os.path.exists(p) and os.access(p, os.X_OK)), None)
if NODE_BIN:
    node_dir = os.path.dirname(NODE_BIN)
    if node_dir not in os.environ.get("PATH", ""):
        os.environ["PATH"] = f"{node_dir}{os.pathsep}{os.environ.get('PATH', '')}"


def find_ffmpeg_bin_dir() -> Optional[str]:
    """Finds ffmpeg installation directory across system PATH, WinGet, and standard locations."""
    ffmpeg_in_path = shutil.which("ffmpeg")
    if ffmpeg_in_path:
        return os.path.dirname(os.path.abspath(ffmpeg_in_path))

    if os.name == "nt":
        import glob
        local_app_data = os.environ.get("LOCALAPPDATA", "")
        candidates = []
        if local_app_data:
            # WinGet packages (prioritizes yt-dlp.FFmpeg or Gyan.FFmpeg)
            candidates.extend(glob.glob(os.path.join(local_app_data, "Microsoft", "WinGet", "Packages", "*ffmpeg*", "**", "ffmpeg.exe"), recursive=True))
            candidates.extend(glob.glob(os.path.join(local_app_data, "Microsoft", "WinGet", "Links", "ffmpeg.exe")))
        candidates.extend(glob.glob(r"C:\ffmpeg*\**\ffmpeg.exe", recursive=True))
        candidates.extend(glob.glob(r"C:\Program Files*\ffmpeg*\**\ffmpeg.exe", recursive=True))

        for c in candidates:
            if os.path.isfile(c):
                return os.path.dirname(os.path.abspath(c))

    return None


FFMPEG_DIR = find_ffmpeg_bin_dir()
if FFMPEG_DIR:
    current_path = os.environ.get("PATH", "")
    if FFMPEG_DIR not in current_path:
        os.environ["PATH"] = f"{FFMPEG_DIR}{os.pathsep}{current_path}"

FFMPEG_BIN = os.path.join(FFMPEG_DIR, "ffmpeg.exe") if (FFMPEG_DIR and os.name == "nt") else (os.path.join(FFMPEG_DIR, "ffmpeg") if FFMPEG_DIR else "ffmpeg")
FFPROBE_BIN = os.path.join(FFMPEG_DIR, "ffprobe.exe") if (FFMPEG_DIR and os.name == "nt") else (os.path.join(FFMPEG_DIR, "ffprobe") if FFMPEG_DIR else "ffprobe")


def get_base_ydl_opts() -> Dict[str, Any]:
    """Base options for yt-dlp instance with EJS challenge solver for full DASH format access."""
    opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": False,
        "remote_components": ["ejs:github"]
    }
    if NODE_BIN:
        opts["js_runtimes"] = {"node": {"path": NODE_BIN}}
    if FFMPEG_DIR:
        opts["ffmpeg_location"] = FFMPEG_DIR
    return opts


def format_bytes(size: Optional[float]) -> str:
    """Format bytes into readable string."""
    if not size or size <= 0:
        return "—"
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size < 1024.0:
            return f"{size:.1f} {unit}"
        size /= 1024.0
    return f"{size:.1f} PB"


def format_seconds(seconds: Optional[int]) -> str:
    """Format seconds into HH:MM:SS or MM:SS."""
    if not seconds:
        return "00:00"
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    if h > 0:
        return f"{h:02d}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"


def extract_with_typo_correction(url: str, opts: Dict[str, Any]) -> Tuple[Dict[str, Any], Optional[str]]:
    """
    Attempts to extract video info. If unavailable, checks for visual typos
    in the 11-character video ID (e.g. lowercase 'l' vs uppercase 'I' or '1').
    """
    with yt_dlp.YoutubeDL(opts) as ydl:
        try:
            return ydl.extract_info(url, download=False), None
        except Exception as primary_err:
            err_str = str(primary_err).lower()
            if "unavailable" not in err_str and "not available" not in err_str and "no video formats" not in err_str:
                raise primary_err

            # Parse video ID
            m = re.search(r'(?:v=|youtu\.be/|shorts/|embed/)([a-zA-Z0-9_-]{11})', url)
            if not m:
                raise primary_err

            orig_id = m.group(1)
            replacements = {
                'l': ['I', '1'],
                'I': ['l', '1'],
                '1': ['l', 'I'],
                '0': ['O'],
                'O': ['0']
            }

            candidates = []
            for i, ch in enumerate(orig_id):
                if ch in replacements:
                    for rep in replacements[ch]:
                        new_id = orig_id[:i] + rep + orig_id[i+1:]
                        if new_id not in candidates and new_id != orig_id:
                            candidates.append(new_id)

            for cand_id in candidates:
                cand_url = url.replace(orig_id, cand_id)
                try:
                    res = ydl.extract_info(cand_url, download=False)
                    if res:
                        return res, f"Typo terdeteksi pada URL: otomatis dikoreksi ke ID {cand_id}"
                except Exception:
                    continue

            raise primary_err


def extract_info(url: str) -> Dict[str, Any]:
    """
    Extracts detailed video information and organizes all available resolutions
    and audio formats. Supports YouTube, Instagram, and TikTok (without watermark).
    """
    opts = get_base_ydl_opts()
    opts["skip_download"] = True

    is_instagram = "instagram.com" in url.lower() or "instagr.am" in url.lower()
    is_tiktok = "tiktok.com" in url.lower()

    info, correction_note = extract_with_typo_correction(url, opts)

    if not info:
        raise ValueError("Tidak dapat mengambil informasi video.")

    formats = info.get("formats", [])
    duration = info.get("duration", 0)

    # Find highest audio bitrate for size calculations
    best_audio_bitrate = 128  # kbps fallback
    for f in formats:
        if f.get("vcodec") == "none" and f.get("acodec") != "none":
            abr = f.get("abr") or 0
            if abr > best_audio_bitrate:
                best_audio_bitrate = abr

    # Check which resolutions have native H.264 (avc1) stream available
    native_h264_heights = set()
    for f in formats:
        vcodec = f.get("vcodec", "")
        if vcodec and vcodec.startswith(("avc1", "h264")):
            h = f.get("height")
            if h:
                native_h264_heights.add(h)

    # Group video formats by height resolution
    resolutions_map: Dict[int, Dict[str, Any]] = {}
    
    for f in formats:
        height = f.get("height")
        if not height or height < 144:
            continue
        vcodec = f.get("vcodec", "")
        if vcodec == "none":
            continue

        fps = f.get("fps") or 30
        filesize = f.get("filesize") or f.get("filesize_approx")
        tbr = f.get("tbr") or 0

        # Estimate size if not provided
        if not filesize and tbr and duration:
            filesize = int((tbr + best_audio_bitrate) * 1000 / 8 * duration)

        if height not in resolutions_map or (filesize and filesize > (resolutions_map[height].get("filesize") or 0)):
            label = f"{height}p"
            badge = ""
            if height >= 4320:
                label = "8K Ultra HD"
                badge = "8K UHD"
            elif height >= 2160:
                label = "4K Ultra HD (2160p)"
                badge = "4K UHD"
            elif height >= 1440:
                label = "2K Quad HD (1440p)"
                badge = "2K QHD"
            elif height >= 1080:
                label = f"1080p Full HD{ ' 60fps' if fps >= 50 else '' }"
                badge = "1080p FHD"
            elif height >= 720:
                label = f"720p HD{ ' 60fps' if fps >= 50 else '' }"
                badge = "720p HD"
            elif height >= 480:
                label = "480p SD"
                badge = "480p"
            elif height >= 360:
                label = "360p Standard"
                badge = "360p"
            else:
                label = f"{height}p"
                badge = f"{height}p"

            has_native_h264 = height in native_h264_heights or is_instagram or is_tiktok

            resolutions_map[height] = {
                "height": height,
                "label": label,
                "badge": badge,
                "fps": fps,
                "format_id": f.get("format_id"),
                "filesize": filesize,
                "filesize_formatted": format_bytes(filesize) if filesize else "Kalkulasi dinamis",
                "ext": "mp4",
                "is_upscale": False,
                "has_native_h264": has_native_h264,
                "tv_compatible_native": has_native_h264,
                "note": "Native H.264 + AAC (Instan untuk TV)" if has_native_h264 else "Auto-convert H.264 jika Mode TV aktif"
            }

    # If resolutions_map is empty (common for Instagram and TikTok single-format responses)
    if not resolutions_map:
        h = info.get("height") or 1080
        resolutions_map[h] = {
            "height": h,
            "label": f"Kualitas Asli ({h}p HD)" if h else "Kualitas Asli (MP4 HD)",
            "badge": f"{h}p HD" if (h and h >= 720) else "Original HD",
            "fps": info.get("fps") or 30,
            "format_id": "best",
            "filesize": info.get("filesize") or info.get("filesize_approx"),
            "filesize_formatted": format_bytes(info.get("filesize") or info.get("filesize_approx")),
            "ext": "mp4",
            "is_upscale": False,
            "has_native_h264": True,
            "tv_compatible_native": True,
            "note": "Format Asli TikTok Tanpa Watermark (H.264 + AAC)" if is_tiktok else "Format Asli Instagram (H.264 + AAC)"
        }

    # If the video's highest native resolution is 1080p, add 4K (2160p) and 2K (1440p) Ultra HD options (YouTube only)!
    max_native_height = max(resolutions_map.keys()) if resolutions_map else 0
    if not is_instagram and not is_tiktok and 1080 <= max_native_height < 2160:
        base_1080 = resolutions_map.get(1080)
        base_size = base_1080.get("filesize", 0) if base_1080 else int(3000 * 1000 / 8 * duration)

        if 2160 not in resolutions_map:
            resolutions_map[2160] = {
                "height": 2160,
                "label": "2160p (4K Ultra HD)",
                "badge": "4K UHD",
                "fps": 30,
                "format_id": "upscale_2160",
                "filesize": int(base_size * 2.2) if base_size else None,
                "filesize_formatted": format_bytes(int(base_size * 2.2)) if base_size else "Estimasi 4K",
                "ext": "mp4",
                "is_upscale": True,
                "has_native_h264": False,
                "tv_compatible_native": False,
                "note": "Upscale dari 1080p (bukan 4K asli, proses lama)"
            }

        if 1440 not in resolutions_map:
            resolutions_map[1440] = {
                "height": 1440,
                "label": "1440p (2K Quad HD)",
                "badge": "2K QHD",
                "fps": 30,
                "format_id": "upscale_1440",
                "filesize": int(base_size * 1.5) if base_size else None,
                "filesize_formatted": format_bytes(int(base_size * 1.5)) if base_size else "Estimasi 2K",
                "ext": "mp4",
                "is_upscale": True,
                "has_native_h264": False,
                "tv_compatible_native": False,
                "note": "Upscale dari 1080p (bukan 2K asli, proses lama)"
            }

    # Sort resolutions descending (4K -> 2K -> 1080p -> 720p -> 480p -> 360p -> ...)
    sorted_resolutions = [resolutions_map[h] for h in sorted(resolutions_map.keys(), reverse=True)]

    # Standard Audio formats
    audio_formats = [
        {
            "id": "mp3-320",
            "type": "audio",
            "codec": "mp3",
            "bitrate": "320k",
            "label": "Audio MP3 (320 kbps - Ultra HQ)",
            "badge": "MP3 320k",
            "ext": "mp3",
            "filesize_formatted": format_bytes(int(320 * 1000 / 8 * duration)) if duration else "Dynamic"
        },
        {
            "id": "mp3-192",
            "type": "audio",
            "codec": "mp3",
            "bitrate": "192k",
            "label": "Audio MP3 (192 kbps - Standar TV/Car)",
            "badge": "MP3 192k",
            "ext": "mp3",
            "filesize_formatted": format_bytes(int(192 * 1000 / 8 * duration)) if duration else "Dynamic"
        },
        {
            "id": "m4a-aac",
            "type": "audio",
            "codec": "m4a",
            "bitrate": "best",
            "label": "Audio M4A / AAC (Kualitas Asli)",
            "badge": "M4A AAC",
            "ext": "m4a",
            "filesize_formatted": format_bytes(int(best_audio_bitrate * 1000 / 8 * duration)) if duration else "Dynamic"
        }
    ]

    thumbnail = info.get("thumbnail")
    thumbnails = info.get("thumbnails", [])
    if thumbnails:
        sorted_thumbs = sorted(thumbnails, key=lambda t: t.get("width", 0) or 0, reverse=True)
        if sorted_thumbs:
            thumbnail = sorted_thumbs[0].get("url", thumbnail)

    webpage_url = info.get("webpage_url") or url

    # Generate title & channel appropriately for TikTok, Instagram, or YouTube
    raw_title = info.get("title") or info.get("description") or ""
    if is_tiktok:
        platform = "tiktok"
        title = raw_title[:90].strip() if raw_title else f"TikTok Video ({info.get('id', 'video')})"
        channel = info.get("uploader") or info.get("creator") or info.get("uploader_id") or "TikTok Creator"
        if not channel.startswith("@") and channel != "TikTok Creator":
            channel = f"@{channel}"
    elif is_instagram:
        platform = "instagram"
        title = raw_title[:80].strip() if raw_title else f"Instagram Reel ({info.get('id', 'video')})"
        channel = info.get("uploader") or info.get("channel") or info.get("uploader_id") or "Instagram User"
        if not channel.startswith("@") and channel != "Instagram User":
            channel = f"@{channel}"
    else:
        platform = "youtube"
        title = info.get("title", "YouTube Video")
        channel = info.get("uploader") or info.get("channel") or "Unknown Channel"

    return {
        "id": info.get("id"),
        "platform": platform,
        "title": title,
        "channel": channel,
        "duration": duration,
        "duration_formatted": format_seconds(duration) if duration else "--:--",
        "thumbnail": thumbnail,
        "view_count": info.get("view_count", 0) or info.get("like_count", 0),
        "upload_date": info.get("upload_date", ""),
        "description": (info.get("description") or "")[:280],
        "video_formats": sorted_resolutions,
        "audio_formats": audio_formats,
        "webpage_url": webpage_url,
        "max_native_height": max_native_height,
        "correction_note": correction_note
    }


class DownloadJob:
    """Tracks state and progress of an active download or conversion."""

    def __init__(self, job_id: str, url: str, format_type: str, quality: str, tv_mode: bool = True, session_id: Optional[str] = None):
        self.job_id = job_id
        self.url = url
        self.format_type = format_type  # 'video' or 'audio' or 'convert'
        self.quality = quality          # e.g. '1080', '2160', 'mp3-320'
        self.tv_mode = tv_mode          # True: H.264 (yuv420p) + AAC for universal TV compatibility
        self.session_id = session_id or ""
        self.job_dir = os.path.join(DOWNLOADS_DIR, self.session_id) if self.session_id else DOWNLOADS_DIR
        os.makedirs(self.job_dir, exist_ok=True)
        self.status = "queued"          # queued, downloading, merging, converting, finished, error
        self.progress: float = 0.0
        self.speed: str = "—"
        self.downloaded_bytes: int = 0
        self.total_bytes: int = 0
        self.eta: str = "--:--"
        self.phase: str = "Menyiapkan..."
        self.title: str = ""
        self.final_filename: str = ""
        self.final_filepath: str = ""
        self.error_message: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "job_id": self.job_id,
            "status": self.status,
            "progress": round(self.progress, 1),
            "speed": self.speed,
            "downloaded": format_bytes(self.downloaded_bytes),
            "total": format_bytes(self.total_bytes),
            "eta": self.eta,
            "phase": self.phase,
            "title": self.title,
            "filename": self.final_filename,
            "session_id": self.session_id,
            "tv_mode": self.tv_mode,
            "error": self.error_message
        }


def run_ffmpeg_with_progress(args: List[str], duration: float,
                             on_progress: Callable[[float, float], None]) -> Tuple[int, str]:
    """
    Runs ffmpeg with `-progress pipe:1` and reports (seconds_done, speed_x) to on_progress.
    Returns (returncode, stderr_text).
    """
    cmd = [FFMPEG_BIN, "-y", "-hide_banner", "-loglevel", "error", "-nostats",
           "-progress", "pipe:1", *args]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            text=True, bufsize=1)

    # Drain stderr in a separate thread so ffmpeg can never block on a full pipe
    err_chunks: List[str] = []
    err_thread = threading.Thread(target=lambda: err_chunks.append(proc.stderr.read()), daemon=True)
    err_thread.start()

    out_time = 0.0
    speed_x = 0.0
    assert proc.stdout is not None
    for line in proc.stdout:
        key, _, value = line.strip().partition("=")
        if key in ("out_time_us", "out_time_ms"):  # both are microseconds in ffmpeg
            try:
                out_time = int(value) / 1_000_000
            except ValueError:
                pass
        elif key == "speed":
            try:
                speed_x = float(value.rstrip("x"))
            except ValueError:
                speed_x = 0.0
        elif key == "progress":
            on_progress(out_time, speed_x)

    proc.wait()
    err_thread.join(timeout=5)
    return proc.returncode, "".join(err_chunks)


class DownloadManager:
    """Manages download jobs and background processes."""

    def __init__(self):
        self.jobs: Dict[str, DownloadJob] = {}
        self.lock = threading.Lock()

    def get_job(self, job_id: str) -> Optional[DownloadJob]:
        return self.jobs.get(job_id)

    def start_download(self, job_id: str, url: str, format_type: str, quality: str, tv_mode: bool = True, session_id: Optional[str] = None) -> DownloadJob:
        job = DownloadJob(job_id, url, format_type, quality, tv_mode, session_id=session_id)
        with self.lock:
            self.jobs[job_id] = job

        thread = threading.Thread(target=self._run_download, args=(job,), daemon=True)
        thread.start()
        return job

    def start_tv_conversion(self, job_id: str, input_filename: str, session_id: Optional[str] = None) -> DownloadJob:
        job = DownloadJob(job_id, input_filename, "convert", "h264_aac", True, session_id=session_id)
        job.title = f"Konversi TV: {input_filename}"
        with self.lock:
            self.jobs[job_id] = job

        thread = threading.Thread(target=self._run_conversion, args=(job, input_filename), daemon=True)
        thread.start()
        return job

    # ------------------------------------------------------------------
    # FFmpeg helpers (with live progress)
    # ------------------------------------------------------------------
    def _ffmpeg_progress_cb(self, job: DownloadJob, duration: float, label: str):
        def cb(done_sec: float, speed_x: float):
            if duration > 0:
                job.progress = min(99.5, done_sec / duration * 100.0)
            job.speed = f"{speed_x:.1f}x realtime" if speed_x > 0 else "—"
            if speed_x > 0 and duration > 0:
                job.eta = format_seconds(max(0, (duration - done_sec) / speed_x))
            job.phase = f"{label} ({job.progress:.0f}%)"
        return cb

    def _encode_tv(self, job: DownloadJob, src: str, dst: str, label: str,
                   scale_height: Optional[int] = None, crf: str = "20") -> bool:
        """Encode src -> dst as H.264 (yuv420p) + AAC stereo with live progress."""
        duration = self._probe_duration(src) or 0.0
        job.status = "converting"
        job.progress = 0.0
        job.eta = "--:--"
        job.phase = f"{label} (0%)"

        args = ["-i", src]
        if scale_height:
            args += ["-vf", f"scale=-2:{scale_height}:flags=lanczos"]
        args += [
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", crf,
            "-c:a", "aac", "-b:a", "192k", "-ac", "2",
            "-movflags", "+faststart",
            dst
        ]
        code, err = run_ffmpeg_with_progress(args, duration, self._ffmpeg_progress_cb(job, duration, label))
        if code != 0:
            if os.path.exists(dst):
                os.remove(dst)
            raise RuntimeError(f"FFmpeg gagal: {err.strip()[-300:] or 'unknown error'}")
        return True

    # ------------------------------------------------------------------
    # TV conversion for an existing file
    # ------------------------------------------------------------------
    def _run_conversion(self, job: DownloadJob, filename: str):
        """Convert any existing video to 100% universal TV-compatible H.264 + AAC."""
        try:
            input_path = os.path.join(job.job_dir, filename)
            if not os.path.exists(input_path):
                fallback = os.path.join(DOWNLOADS_DIR, filename)
                if os.path.exists(fallback):
                    input_path = fallback
                else:
                    raise FileNotFoundError(f"File {filename} tidak ditemukan.")

            base_name, _ = os.path.splitext(filename)
            clean_name = base_name.replace(" [TV-Ready]", "")
            out_filename = f"{clean_name} [TV-Ready].mp4"
            out_path = os.path.join(job.job_dir, out_filename)

            job.total_bytes = os.path.getsize(input_path)
            self._encode_tv(job, input_path, out_path, "Konversi ke H.264 + AAC")

            job.final_filename = out_filename
            job.final_filepath = out_path
            job.downloaded_bytes = job.total_bytes = os.path.getsize(out_path)
            job.status = "finished"
            job.progress = 100.0
            job.speed = "Selesai"
            job.eta = "00:00"
            job.phase = "Selesai! Format H.264 + AAC siap diputar di TV."

        except Exception as e:
            job.status = "error"
            job.error_message = str(e)
            job.phase = "Konversi Gagal"

    # ------------------------------------------------------------------
    # Download
    # ------------------------------------------------------------------
    def _run_download(self, job: DownloadJob):
        try:
            job.status = "downloading"
            job.phase = "Mengambil detail video..."

            outtmpl = os.path.join(job.job_dir, "%(title).180s [%(resolution)s].%(ext)s")

            # Per-stream byte tracking so video + audio form ONE combined progress bar
            stream_done: Dict[str, int] = {}
            stream_total: Dict[str, int] = {}
            plan = {"expected_total": 0, "n_streams": 1}

            def progress_hook(d):
                fname = d.get("filename") or d.get("tmpfilename") or "stream"
                status = d.get("status")

                if status == "downloading":
                    stream_done[fname] = d.get("downloaded_bytes") or 0
                    stream_total[fname] = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
                elif status == "finished":
                    final = d.get("total_bytes") or d.get("downloaded_bytes") or stream_total.get(fname, 0)
                    stream_done[fname] = final
                    stream_total[fname] = final
                else:
                    return

                grand_total = max(plan["expected_total"], sum(stream_total.values()))
                done = sum(stream_done.values())

                job.status = "downloading"
                job.downloaded_bytes = done
                job.total_bytes = grand_total
                if grand_total > 0:
                    job.progress = min(99.5, done / grand_total * 100.0)

                speed = d.get("speed")
                if speed:
                    job.speed = f"{format_bytes(speed)}/s"
                    remaining = max(0, grand_total - done)
                    job.eta = format_seconds(remaining / speed) if speed > 0 else "--:--"

                info_d = d.get("info_dict") or {}
                vcodec = info_d.get("vcodec")
                kind = "audio" if (not vcodec or vcodec == "none") else "video"
                idx = list(stream_total.keys()).index(fname) + 1 if fname in stream_total else 1
                n = max(plan["n_streams"], len(stream_total))
                stream_pct = (stream_done.get(fname, 0) / stream_total[fname] * 100) if stream_total.get(fname) else 0
                if n > 1:
                    job.phase = f"Mengunduh stream {kind} ({idx}/{n}) — {stream_pct:.0f}%"
                else:
                    job.phase = f"Mengunduh {kind} — {stream_pct:.0f}%"

            def postprocessor_hook(d):
                pp_name = d.get("postprocessor", "")
                if d["status"] == "started":
                    job.progress = 100.0
                    job.eta = "--:--"
                    if "Merger" in pp_name:
                        job.status = "merging"
                        job.phase = "Menggabungkan video + audio dengan FFmpeg..."
                    elif "ExtractAudio" in pp_name:
                        job.status = "merging"
                        job.phase = "Mengonversi audio..."
                    else:
                        job.phase = "Memproses file..."

            base_opts = get_base_ydl_opts()
            opts: Dict[str, Any] = {
                **base_opts,
                "outtmpl": outtmpl,
                "progress_hooks": [progress_hook],
                "postprocessor_hooks": [postprocessor_hook],
                "windowsfilenames": True,
                "restrictfilenames": False
            }

            target_height = 1080

            if job.format_type == "video":
                try:
                    target_height = int(job.quality)
                except ValueError:
                    target_height = 1080

                opts["merge_output_format"] = "mp4"

                is_instagram = "instagram.com" in job.url.lower() or "instagr.am" in job.url.lower()
                is_tiktok = "tiktok.com" in job.url.lower()
                if is_instagram or is_tiktok:
                    opts["format"] = "bestvideo+bestaudio/best"
                    opts["postprocessor_args"] = {
                        "merger": ["-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"]
                    }
                elif job.tv_mode:
                    opts["format"] = (
                        f"bestvideo[vcodec^=avc1][height<={target_height}]+bestaudio[acodec^=mp4a]/"
                        f"bestvideo[vcodec^=avc1][height<={target_height}]+bestaudio/"
                        f"bestvideo[height<={target_height}]+bestaudio/"
                        f"best[height<={target_height}]/best"
                    )
                    opts["postprocessor_args"] = {
                        "merger": ["-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ac", "2",
                                   "-movflags", "+faststart"]
                    }
                else:
                    opts["format"] = f"bestvideo[height<={target_height}]+bestaudio/best[height<={target_height}]/best"
                    opts["postprocessor_args"] = {
                        "merger": ["-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                                   "-movflags", "+faststart"]
                    }

            elif job.format_type == "audio":
                opts["format"] = "bestaudio/best"
                opts["outtmpl"] = os.path.join(job.job_dir, "%(title).180s.%(ext)s")

                if "m4a" in job.quality:
                    codec, quality = "m4a", "0"
                elif "192" in job.quality:
                    codec, quality = "mp3", "192"
                else:
                    codec, quality = "mp3", "320"
                opts["postprocessors"] = [{
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": codec,
                    "preferredquality": quality
                }]

            with yt_dlp.YoutubeDL(opts) as ydl:
                # Step 1: resolve formats first so we know the total size of all streams
                info = ydl.extract_info(job.url, download=False)
                job.title = info.get("title", "Video")
                requested = info.get("requested_formats") or [info]
                plan["n_streams"] = len(requested)
                plan["expected_total"] = sum(
                    (f.get("filesize") or f.get("filesize_approx") or 0) for f in requested
                )
                job.total_bytes = plan["expected_total"]
                job.phase = "Memulai unduhan..."

                # Step 2: download using the already-resolved info (no second extraction)
                info = ydl.process_ie_result(info, download=True)

                requested_downloads = info.get("requested_downloads")
                target_filepath = None
                if requested_downloads:
                    target_filepath = requested_downloads[0].get("filepath")

                if not target_filepath or not os.path.exists(target_filepath):
                    files = [
                        os.path.join(job.job_dir, f)
                        for f in os.listdir(job.job_dir)
                        if not f.endswith((".part", ".ytdl"))
                    ]
                    if files:
                        target_filepath = max(files, key=os.path.getmtime)

            if target_filepath and os.path.exists(target_filepath) and job.format_type == "video":
                current_height = self._probe_video_height(target_filepath)
                vcodec_actual = self._probe_video_codec(target_filepath)

                if target_height in (2160, 1440) and current_height and current_height < target_height:
                    # Upscale (no new detail is created; only useful for TVs with weak built-in scalers)
                    root, _ = os.path.splitext(target_filepath)
                    dst = f"{root} [upscale-{target_height}p].mp4"
                    self._encode_tv(job, target_filepath, dst,
                                    f"Upscale ke {target_height}p (H.264)", scale_height=target_height, crf="19")
                    os.remove(target_filepath)
                    target_filepath = dst
                elif job.tv_mode and vcodec_actual and vcodec_actual not in ("h264", "avc1"):
                    tmp = target_filepath + ".tv.mp4"
                    self._encode_tv(job, target_filepath, tmp,
                                    f"Konversi {vcodec_actual.upper()} ke H.264 untuk TV")
                    os.replace(tmp, target_filepath)

            if target_filepath and os.path.exists(target_filepath):
                job.final_filepath = target_filepath
                job.final_filename = os.path.basename(target_filepath)
                job.total_bytes = job.downloaded_bytes = os.path.getsize(target_filepath)

            job.status = "finished"
            job.progress = 100.0
            job.phase = "Selesai! Video & Audio siap diputar."
            job.speed = "Selesai"
            job.eta = "00:00"

        except Exception as e:
            job.status = "error"
            job.error_message = str(e)
            job.phase = "Gagal"

    # ------------------------------------------------------------------
    # ffprobe helpers
    # ------------------------------------------------------------------
    def _ffprobe(self, filepath: str, stream_sel: Optional[str], entry: str) -> str:
        cmd = [FFPROBE_BIN, "-v", "error"]
        if stream_sel:
            cmd += ["-select_streams", stream_sel]
        cmd += ["-show_entries", entry, "-of", "default=noprint_wrappers=1:nokey=1", filepath]
        try:
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            return res.stdout.strip().splitlines()[0] if res.stdout.strip() else ""
        except Exception:
            return ""

    def _probe_video_codec(self, filepath: str) -> Optional[str]:
        val = self._ffprobe(filepath, "v:0", "stream=codec_name")
        return val.lower() or None

    def _probe_video_height(self, filepath: str) -> Optional[int]:
        val = self._ffprobe(filepath, "v:0", "stream=height")
        return int(val) if val.isdigit() else None

    def _probe_duration(self, filepath: str) -> Optional[float]:
        val = self._ffprobe(filepath, None, "format=duration")
        try:
            return float(val)
        except ValueError:
            return None


downloader_manager = DownloadManager()
