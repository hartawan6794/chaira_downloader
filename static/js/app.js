/**
 * YouTube Downloader Pro - Modern Frontend Application
 * Handles URL fetching, format selection, TV mode toggling,
 * WebSocket live progress tracking, TV conversion, typo recovery, and media playback.
 */

// State
let currentVideoData = null;
let selectedFormatType = 'video'; // 'video' or 'audio'
let selectedQuality = '1080';
let activeJobId = null;
let activeSocket = null;

// DOM Elements
const inputUrl = document.getElementById('inputUrl');
const btnPaste = document.getElementById('btnPaste');
const btnFetch = document.getElementById('btnFetch');
const fetchSpinner = document.getElementById('fetchSpinner');
const urlErrorMsg = document.getElementById('urlErrorMsg');

const videoCard = document.getElementById('videoCard');
const videoThumb = document.getElementById('videoThumb');
const videoDuration = document.getElementById('videoDuration');
const videoTitle = document.getElementById('videoTitle');
const videoChannel = document.getElementById('channelText');
const videoViews = document.getElementById('videoViews');

const tabVideo = document.getElementById('tabVideo');
const tabAudio = document.getElementById('tabAudio');
const tvModeBanner = document.getElementById('tvModeBanner');
const toggleTvMode = document.getElementById('toggleTvMode');
const videoOptionsGrid = document.getElementById('videoOptionsGrid');
const audioOptionsGrid = document.getElementById('audioOptionsGrid');
const selectedFormatText = document.getElementById('selectedFormatText');
const btnStartDownload = document.getElementById('btnStartDownload');

const progressCard = document.getElementById('progressCard');
const progressStatusPill = document.getElementById('progressStatusPill');
const progressTitle = document.getElementById('progressTitle');
const progressPercentDisplay = document.getElementById('progressPercentDisplay');
const progressBarFill = document.getElementById('progressBarFill');
const statSpeed = document.getElementById('statSpeed');
const statSize = document.getElementById('statSize');
const statEta = document.getElementById('statEta');
const statPhase = document.getElementById('statPhase');
const progressSuccessActions = document.getElementById('progressSuccessActions');
const successMessageText = document.getElementById('successMessageText');
const btnBrowserDownload = document.getElementById('btnBrowserDownload');
const btnPlayPreview = document.getElementById('btnPlayPreview');
const btnOpenFolderCard = document.getElementById('btnOpenFolderCard');

const historyList = document.getElementById('historyList');
const emptyHistory = document.getElementById('emptyHistory');
const btnRefreshHistory = document.getElementById('btnRefreshHistory');
const btnOpenFolderNav = document.getElementById('btnOpenFolderNav');
const btnOpenFolderHistory = document.getElementById('btnOpenFolderHistory');

const playerModal = document.getElementById('playerModal');
const modalTitle = document.getElementById('modalTitle');
const modalVideoPlayer = document.getElementById('modalVideoPlayer');
const modalAudioPlayer = document.getElementById('modalAudioPlayer');
const btnModalClose = document.getElementById('btnModalClose');
const toastContainer = document.getElementById('toastContainer');

let lastFinishedFilename = null;

// -----------------------------------------------------------------------------
// Toast Notifications
// -----------------------------------------------------------------------------
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : type === 'success' ? 'toast-success' : ''}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// -----------------------------------------------------------------------------
// Event Listeners Initialization
// -----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    loadHistory();

    // Paste from Clipboard
    btnPaste.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                inputUrl.value = text.trim();
                showToast('URL berhasil ditempel dari clipboard!', 'success');
                fetchVideoInfo();
            }
        } catch (err) {
            showToast('Izin akses clipboard ditolak browser. Silakan paste manual (Ctrl+V).', 'error');
        }
    });

    // Enter key triggers search
    inputUrl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            fetchVideoInfo();
        }
    });

    btnFetch.addEventListener('click', fetchVideoInfo);

    // Format Tab Switch
    tabVideo.addEventListener('click', () => switchTab('video'));
    tabAudio.addEventListener('click', () => switchTab('audio'));

    // TV Mode Toggle
    toggleTvMode.addEventListener('change', () => {
        updateSelectedSummary();
        renderVideoOptions(currentVideoData?.video_formats || []);
    });

    // Start Download Button
    btnStartDownload.addEventListener('click', startDownload);

    // Open Folder Triggers
    const openFolderHandler = async () => {
        try {
            const res = await fetch('/api/open-folder', { method: 'POST' });
            if (res.ok) {
                showToast('Folder downloads berhasil dibuka di komputer!', 'success');
            } else {
                showToast('Gagal membuka folder di file manager.', 'error');
            }
        } catch (e) {
            showToast('Tidak dapat menghubungi server lokal.', 'error');
        }
    };
    btnOpenFolderNav.addEventListener('click', openFolderHandler);
    btnOpenFolderHistory.addEventListener('click', openFolderHandler);
    btnOpenFolderCard.addEventListener('click', openFolderHandler);

    btnRefreshHistory.addEventListener('click', () => {
        loadHistory();
        showToast('Daftar riwayat unduhan diperbarui.', 'info');
    });

    // In-browser Preview Play
    btnPlayPreview.addEventListener('click', () => {
        if (lastFinishedFilename) {
            openMediaPlayer(lastFinishedFilename);
        }
    });

    // Modal Close
    btnModalClose.addEventListener('click', closeMediaPlayer);
    playerModal.addEventListener('click', (e) => {
        if (e.target === playerModal) closeMediaPlayer();
    });
});

// -----------------------------------------------------------------------------
// Fetch Video Info
// -----------------------------------------------------------------------------
async function fetchVideoInfo() {
    const url = inputUrl.value.trim();
    if (!url) {
        showError('Silakan masukkan link video YouTube terlebih dahulu.');
        return;
    }

    hideError();
    setFetchLoading(true);

    try {
        const response = await fetch('/api/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Gagal mengekstrak video.');
        }

        const data = await response.json();
        currentVideoData = data;

        // If backend auto-corrected a typo in the URL
        if (data.correction_note) {
            if (data.webpage_url) {
                inputUrl.value = data.webpage_url;
            }
            showToast(data.correction_note, 'info');
        }

        renderVideoCard(data);
        showToast('Detail video berhasil ditemukan!', 'success');

        // Scroll smoothly to video details
        videoCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
        let errMsg = err.message || 'Terjadi kesalahan saat memeriksa URL YouTube.';
        if (errMsg.includes('This video is not available') || errMsg.includes('This video is unavailable')) {
            errMsg = `Video tidak ditemukan di YouTube. Pastikan link video benar, video tidak disetel privat, dan tidak ada kesalahan ketik pada link.`;
        }
        showError(errMsg);
    } finally {
        setFetchLoading(false);
    }
}

function setFetchLoading(loading) {
    if (loading) {
        btnFetch.disabled = true;
        fetchSpinner.style.display = 'inline-block';
        btnFetch.querySelector('.btn-text').textContent = 'Menganalisis...';
        btnFetch.querySelector('.btn-arrow').style.display = 'none';
    } else {
        btnFetch.disabled = false;
        fetchSpinner.style.display = 'none';
        btnFetch.querySelector('.btn-text').textContent = 'Cari Video';
        btnFetch.querySelector('.btn-arrow').style.display = 'inline-block';
    }
}

function showError(msg) {
    urlErrorMsg.textContent = msg;
    urlErrorMsg.classList.remove('hidden');
}

function hideError() {
    urlErrorMsg.classList.add('hidden');
    urlErrorMsg.textContent = '';
}

// -----------------------------------------------------------------------------
// Render Video Card & Options
// -----------------------------------------------------------------------------
function renderVideoCard(data) {
    videoThumb.src = data.thumbnail || '';
    videoDuration.textContent = data.duration_formatted || '00:00';
    videoTitle.textContent = data.title || 'YouTube Video';
    videoChannel.textContent = data.channel || 'Channel';
    videoViews.textContent = Number(data.view_count || 0).toLocaleString('id-ID') + ' views';

    renderVideoOptions(data.video_formats);
    renderAudioOptions(data.audio_formats);

    // Default select best 1080p or first available
    const has1080 = data.video_formats.some(f => f.height === 1080);
    if (has1080) {
        selectedQuality = '1080';
    } else if (data.video_formats.length > 0) {
        selectedQuality = String(data.video_formats[0].height);
    }

    switchTab('video');
    videoCard.classList.remove('hidden');
    updateSelectedSummary();
}

function renderVideoOptions(formats) {
    videoOptionsGrid.innerHTML = '';
    const isTvMode = toggleTvMode.checked;

    if (!formats || formats.length === 0) {
        videoOptionsGrid.innerHTML = '<div style="color: #94a3b8; font-size: 0.9rem;">Tidak ada format video yang tersedia.</div>';
        return;
    }

    formats.forEach((f) => {
        const card = document.createElement('div');
        const isSelected = selectedFormatType === 'video' && String(f.height) === String(selectedQuality);
        card.className = `format-card ${isSelected ? 'selected' : ''}`;
        card.dataset.height = f.height;

        let badgeClass = 'badge-sd';
        if (f.height >= 2160) badgeClass = 'badge-4k';
        else if (f.height >= 1440) badgeClass = 'badge-2k';
        else if (f.height >= 1080) badgeClass = 'badge-fhd';
        else if (f.height >= 720) badgeClass = 'badge-hd';

        let tvBadgeNote = '';
        if (f.is_upscale) {
            tvBadgeNote = `<div class="format-note" style="color: #fbbf24;">⬆ ${f.note}</div>`;
        } else if (isTvMode) {
            tvBadgeNote = f.tv_compatible_native
                ? '<div class="format-note">✓ Native H.264 + AAC (Instan TV)</div>'
                : '<div class="format-note" style="color: #c4b5fd;">📺 Auto-convert H.264 untuk TV</div>';
        } else {
            tvBadgeNote = '<div class="format-note">✓ Video + Audio Merged</div>';
        }

        card.innerHTML = `
            <div class="format-card-top">
                <span class="format-res-badge">${f.label}</span>
                <span class="format-quality-pill ${badgeClass}">${f.badge}</span>
            </div>
            <div class="format-size">${f.filesize_formatted}</div>
            ${tvBadgeNote}
        `;

        card.addEventListener('click', () => {
            selectedFormatType = 'video';
            selectedQuality = String(f.height);
            document.querySelectorAll('.format-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            updateSelectedSummary();
        });

        videoOptionsGrid.appendChild(card);
    });
}

function renderAudioOptions(formats) {
    audioOptionsGrid.innerHTML = '';
    if (!formats) return;

    formats.forEach((f) => {
        const card = document.createElement('div');
        const isSelected = selectedFormatType === 'audio' && f.id === selectedQuality;
        card.className = `format-card ${isSelected ? 'selected' : ''}`;
        card.dataset.audioId = f.id;

        card.innerHTML = `
            <div class="format-card-top">
                <span class="format-res-badge">${f.label}</span>
                <span class="format-quality-pill badge-fhd">${f.badge}</span>
            </div>
            <div class="format-size">${f.filesize_formatted}</div>
            <div class="format-note">✓ Kompatibel semua perangkat & mobil</div>
        `;

        card.addEventListener('click', () => {
            selectedFormatType = 'audio';
            selectedQuality = f.id;
            document.querySelectorAll('.format-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            updateSelectedSummary();
        });

        audioOptionsGrid.appendChild(card);
    });
}

function switchTab(type) {
    selectedFormatType = type;
    if (type === 'video') {
        tabVideo.classList.add('active');
        tabAudio.classList.remove('active');
        videoOptionsGrid.classList.remove('hidden');
        audioOptionsGrid.classList.add('hidden');
        tvModeBanner.classList.remove('hidden');

        if (currentVideoData?.video_formats?.length > 0) {
            const hasQuality = currentVideoData.video_formats.some(f => String(f.height) === String(selectedQuality));
            if (!hasQuality) selectedQuality = String(currentVideoData.video_formats[0].height);
        }
    } else {
        tabAudio.classList.add('active');
        tabVideo.classList.remove('active');
        audioOptionsGrid.classList.remove('hidden');
        videoOptionsGrid.classList.add('hidden');
        tvModeBanner.classList.add('hidden');

        if (!selectedQuality.startsWith('mp3') && !selectedQuality.startsWith('m4a')) {
            selectedQuality = 'mp3-320';
        }
    }

    document.querySelectorAll('.format-card').forEach(card => {
        if (type === 'video' && card.dataset.height === selectedQuality) {
            card.classList.add('selected');
        } else if (type === 'audio' && card.dataset.audioId === selectedQuality) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });

    updateSelectedSummary();
}

function updateSelectedSummary() {
    const isTv = toggleTvMode.checked;
    if (selectedFormatType === 'video') {
        const found = currentVideoData?.video_formats?.find(f => String(f.height) === String(selectedQuality));
        const resLabel = found ? found.label : `${selectedQuality}p`;
        const tvLabel = isTv ? ' (H.264 + AAC TV Ready)' : ' (MP4 + Audio)';
        selectedFormatText.textContent = `${resLabel}${tvLabel}`;
    } else {
        const found = currentVideoData?.audio_formats?.find(f => f.id === selectedQuality);
        selectedFormatText.textContent = found ? found.label : 'Audio MP3 / M4A';
    }
}

// -----------------------------------------------------------------------------
// Start Download & WebSocket Tracking
// -----------------------------------------------------------------------------
async function startDownload() {
    if (!currentVideoData) return;

    const url = currentVideoData.webpage_url || inputUrl.value.trim();
    const isTv = toggleTvMode.checked;

    btnStartDownload.disabled = true;
    btnStartDownload.innerHTML = `
        <span class="btn-spinner" style="display:inline-block;"></span>
        <span>Menyiapkan Unduhan...</span>
    `;

    try {
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url,
                format_type: selectedFormatType,
                quality: selectedQuality,
                tv_mode: isTv
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Gagal memulai unduhan.');
        }

        const data = await response.json();
        activeJobId = data.job_id;

        initProgressCard(currentVideoData.title, isTv);
        trackJobProgress(activeJobId);

    } catch (err) {
        showToast(err.message, 'error');
        btnStartDownload.disabled = false;
        btnStartDownload.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            <span>Download Sekarang</span>
        `;
    }
}

function initProgressCard(title, isTv) {
    progressCard.classList.remove('hidden');
    progressSuccessActions.classList.add('hidden');
    progressStatusPill.className = 'progress-status-pill';
    progressStatusPill.textContent = 'Mengunduh';
    progressTitle.textContent = title;
    progressPercentDisplay.textContent = '0%';
    progressBarFill.style.width = '0%';

    statSpeed.textContent = 'Menghubungkan...';
    statSize.textContent = '— / —';
    statEta.textContent = '--:--';
    statPhase.textContent = 'Mengambil detail video...';

    btnStartDownload.disabled = true;
    btnStartDownload.innerHTML = `
        <span class="btn-spinner" style="display:inline-block;"></span>
        <span>Sedang Diproses...</span>
    `;

    progressCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function trackJobProgress(jobId) {
    if (activeSocket) {
        try { activeSocket.close(); } catch (e) {}
    }
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }

    let jobDone = false;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/${jobId}`;

    activeSocket = new WebSocket(wsUrl);

    activeSocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.status === 'finished' || data.status === 'error') jobDone = true;
            handleProgressUpdate(data);
        } catch (e) {}
    };

    // If the socket fails or closes before the job is done, keep updating via HTTP polling
    activeSocket.onerror = () => {
        if (!jobDone) fallbackPolling(jobId);
    };
    activeSocket.onclose = () => {
        if (!jobDone) fallbackPolling(jobId);
    };
}

let pollTimer = null;
function fallbackPolling(jobId) {
    if (pollTimer) return; // already polling
    pollTimer = setInterval(async () => {
        try {
            const res = await fetch(`/api/progress/${jobId}`);
            if (res.ok) {
                const data = await res.json();
                handleProgressUpdate(data);
                if (data.status === 'finished' || data.status === 'error') {
                    clearInterval(pollTimer);
                    pollTimer = null;
                }
            }
        } catch (e) {}
    }, 1000);
}

function handleProgressUpdate(data) {
    if (data.title) {
        progressTitle.textContent = data.title;
    }

    const pct = data.progress || 0;
    progressPercentDisplay.textContent = `${Math.round(pct)}%`;
    progressBarFill.style.width = `${pct}%`;

    statSpeed.textContent = data.speed || '—';
    statSize.textContent = `${data.downloaded || '—'} / ${data.total || '—'}`;
    statEta.textContent = data.eta || '--:--';
    statPhase.textContent = data.phase || 'Memproses...';

    progressStatusPill.style.backgroundColor = '';
    if (data.status === 'downloading') {
        progressStatusPill.textContent = 'Mengunduh';
        progressStatusPill.className = 'progress-status-pill';
    } else if (data.status === 'merging') {
        progressStatusPill.textContent = 'Muxing FFmpeg';
        progressStatusPill.className = 'progress-status-pill convert';
    } else if (data.status === 'converting') {
        progressStatusPill.textContent = 'Konversi';
        progressStatusPill.className = 'progress-status-pill convert';
    }

    if (data.status === 'finished') {
        progressStatusPill.className = 'progress-status-pill success';
        progressStatusPill.textContent = 'Selesai';
        progressPercentDisplay.textContent = '100%';
        progressBarFill.style.width = '100%';

        lastFinishedFilename = data.filename;
        if (data.filename) {
            btnBrowserDownload.href = `/api/file/${encodeURIComponent(data.filename)}`;
            btnBrowserDownload.download = data.filename;
        }

        successMessageText.textContent = data.tv_mode
            ? 'Unduhan selesai! Format H.264 dan Audio AAC termuxing rapi siap diputar di TV.'
            : 'Unduhan selesai dengan resolusi penuh dan audio utuh!';

        progressSuccessActions.classList.remove('hidden');

        btnStartDownload.disabled = false;
        btnStartDownload.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            <span>Download Lagi</span>
        `;

        showToast('Video berhasil diunduh & digabungkan sempurna!', 'success');
        loadHistory();
    } else if (data.status === 'error') {
        progressStatusPill.className = 'progress-status-pill';
        progressStatusPill.style.backgroundColor = 'rgba(239, 68, 68, 0.4)';
        progressStatusPill.textContent = 'Gagal';
        statPhase.textContent = `Error: ${data.error || 'Terjadi kesalahan'}`;

        btnStartDownload.disabled = false;
        btnStartDownload.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            <span>Download Sekarang</span>
        `;
        showToast(data.error || 'Gagal memproses video.', 'error');
    }
}

// -----------------------------------------------------------------------------
// Convert Existing File to TV Format
// -----------------------------------------------------------------------------
async function convertFileToTv(filename) {
    if (!confirm(`Konversi "${filename}" ke format H.264 (yuv420p) + AAC Stereo untuk TV?`)) {
        return;
    }

    try {
        const res = await fetch('/api/convert-tv', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Gagal memulai konversi.');
        }

        const data = await res.json();
        activeJobId = data.job_id;

        initProgressCard(`Konversi TV: ${filename}`, true);
        progressStatusPill.className = 'progress-status-pill convert';
        progressStatusPill.textContent = 'Konversi TV';
        trackJobProgress(activeJobId);
        showToast('Proses konversi format TV dimulai...', 'info');

    } catch (e) {
        showToast(e.message, 'error');
    }
}

// -----------------------------------------------------------------------------
// Download History
// -----------------------------------------------------------------------------
async function loadHistory() {
    try {
        const response = await fetch('/api/history');
        if (!response.ok) return;

        const data = await response.json();
        const files = data.files || [];

        historyList.innerHTML = '';

        if (files.length === 0) {
            historyList.appendChild(emptyHistory);
            emptyHistory.classList.remove('hidden');
            return;
        }

        emptyHistory.classList.add('hidden');

        files.forEach((file) => {
            const item = document.createElement('div');
            item.className = 'history-card';

            const isVid = file.is_video;
            const iconClass = isVid ? 'icon-video' : 'icon-audio';
            const iconText = file.ext.toUpperCase();

            let tvBadgeHtml = '';
            let convertBtnHtml = '';

            if (isVid) {
                if (file.tv_ready) {
                    tvBadgeHtml = '<span class="badge-codec badge-tv-ready">✓ TV Ready (H.264 + AAC)</span>';
                } else {
                    const codecInfo = file.vcodec ? file.vcodec.toUpperCase() : 'NON-H264';
                    tvBadgeHtml = `<span class="badge-codec badge-tv-not-ready">⚠ ${codecInfo} (Bisa bermasalah di TV)</span>`;
                    convertBtnHtml = `
                        <button class="btn btn-convert-tv" title="Konversi video ke H.264 + AAC agar pasti bisa diputar di TV">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
                                <polyline points="17 2 12 7 7 2"/>
                            </svg>
                            <span>Konversi TV</span>
                        </button>
                    `;
                }
            }

            item.innerHTML = `
                <div class="history-left">
                    <div class="file-type-icon ${iconClass}">${iconText}</div>
                    <div class="history-meta">
                        <div class="history-file-name" title="${file.filename}">${file.filename}</div>
                        <div class="history-sub-meta">
                            <span>${file.size}</span>
                            <span>•</span>
                            <span>${file.modified}</span>
                            ${tvBadgeHtml}
                        </div>
                    </div>
                </div>
                <div class="history-actions">
                    ${convertBtnHtml}
                    <button class="btn btn-sm btn-outline btn-play" title="Putar di browser">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                        <span>Putar</span>
                    </button>
                    <a href="/api/file/${encodeURIComponent(file.filename)}" download class="btn btn-sm btn-outline" title="Simpan ke browser">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                        </svg>
                        <span>Unduh</span>
                    </a>
                    <button class="btn btn-sm btn-delete" title="Hapus file">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                    </button>
                </div>
            `;

            item.querySelector('.btn-play').addEventListener('click', () => {
                openMediaPlayer(file.filename, isVid);
            });

            const convBtn = item.querySelector('.btn-convert-tv');
            if (convBtn) {
                convBtn.addEventListener('click', () => {
                    convertFileToTv(file.filename);
                });
            }

            item.querySelector('.btn-delete').addEventListener('click', async () => {
                if (confirm(`Hapus file "${file.filename}" dari komputer?`)) {
                    try {
                        const res = await fetch(`/api/file/${encodeURIComponent(file.filename)}`, { method: 'DELETE' });
                        if (res.ok) {
                            showToast('File berhasil dihapus.', 'info');
                            loadHistory();
                        } else {
                            showToast('Gagal menghapus file.', 'error');
                        }
                    } catch (e) {
                        showToast('Gagal menghubungi server.', 'error');
                    }
                }
            });

            historyList.appendChild(item);
        });
    } catch (e) {}
}

// -----------------------------------------------------------------------------
// Media Player Modal
// -----------------------------------------------------------------------------
function openMediaPlayer(filename, isVideo = true) {
    modalTitle.textContent = filename;
    const streamUrl = `/api/stream/${encodeURIComponent(filename)}`;

    if (isVideo) {
        modalVideoPlayer.src = streamUrl;
        modalVideoPlayer.classList.remove('hidden');
        modalAudioPlayer.classList.add('hidden');
        modalVideoPlayer.play().catch(() => {});
    } else {
        modalAudioPlayer.src = streamUrl;
        modalAudioPlayer.classList.remove('hidden');
        modalVideoPlayer.classList.add('hidden');
        modalAudioPlayer.play().catch(() => {});
    }

    playerModal.classList.remove('hidden');
}

function closeMediaPlayer() {
    modalVideoPlayer.pause();
    modalAudioPlayer.pause();
    modalVideoPlayer.src = '';
    modalAudioPlayer.src = '';
    playerModal.classList.add('hidden');
}
