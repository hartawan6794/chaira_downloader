/**
 * YouTube Downloader Pro - Modern Frontend Application
 * Handles URL fetching, format selection, TV mode toggling,
 * WebSocket live progress tracking, TV conversion, typo recovery, media playback,
 * and dual platform support (YouTube & Instagram).
 */

// State
let currentPlatform = 'youtube'; // 'youtube' or 'instagram'
let currentVideoData = null;
let selectedFormatType = 'video'; // 'video' or 'audio'
let selectedQuality = '1080';
let activeJobId = null;
let activeSocket = null;

// DOM Elements - Navigation & Platform Switcher
const btnNavYouTube = document.getElementById('btnNavYouTube');
const btnNavInstagram = document.getElementById('btnNavInstagram');
const btnNavTikTok = document.getElementById('btnNavTikTok');
const brandSubtitle = document.getElementById('brandSubtitle');
const brandLogoBox = document.getElementById('brandLogoBox');
const brandLogoSvg = document.getElementById('brandLogoSvg');

// DOM Elements - Hero
const heroBadgeText = document.getElementById('heroBadgeText');
const heroBadgeIcon = document.getElementById('heroBadgeIcon');
const heroTitle = document.getElementById('heroTitle');
const heroDesc = document.getElementById('heroDesc');
const btnFetchText = document.getElementById('btnFetchText');

// DOM Elements - URL Input
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

const YT_SVG_PATH = `<path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>`;
const IG_SVG_PATH = `<path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>`;
const TT_SVG_PATH = `<path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.97v7.94c.03 2.58-1.12 5.14-3.08 6.82-2.02 1.75-4.88 2.37-7.46 1.66-2.58-.7-4.7-2.68-5.6-5.18-.89-2.5-.47-5.38 1.1-7.48 1.59-2.12 4.24-3.27 6.88-2.97.02 1.39.01 2.78.01 4.17-1.39-.18-2.84.24-3.83 1.22-.98.98-1.28 2.47-.78 3.77.5 1.3 1.73 2.19 3.12 2.25 1.39.06 2.72-.73 3.32-1.99.35-.74.45-1.57.44-2.39V.02h-3.04z"/>`;

// -----------------------------------------------------------------------------
// Platform Switcher Handler
// -----------------------------------------------------------------------------
function setPlatform(platform, fromUserClick = false) {
    currentPlatform = platform;

    // Reset all tabs
    [btnNavYouTube, btnNavInstagram, btnNavTikTok].forEach(btn => {
        if (btn) {
            btn.classList.remove('active');
            btn.setAttribute('aria-selected', 'false');
        }
    });

    document.body.classList.remove('theme-instagram', 'theme-tiktok');

    if (platform === 'tiktok') {
        if (btnNavTikTok) {
            btnNavTikTok.classList.add('active');
            btnNavTikTok.setAttribute('aria-selected', 'true');
        }
        document.body.classList.add('theme-tiktok');
        if (brandLogoSvg) brandLogoSvg.innerHTML = TT_SVG_PATH;
        if (brandSubtitle) brandSubtitle.textContent = 'TikTok Video & Sound Downloader • Bebas Watermark HD';

        if (heroBadgeIcon) heroBadgeIcon.textContent = '🎵';
        if (heroBadgeText) heroBadgeText.textContent = 'Download Video TikTok Bebas Watermark + Audio MP3 Jernih';
        if (heroTitle) heroTitle.innerHTML = 'Download TikTok <span class="gradient-text" id="heroGradientText">Tanpa Watermark</span> Kualitas HD';
        if (heroDesc) heroDesc.innerHTML = 'Download video TikTok bersih tanpa watermark logo mengganggu! Dilengkapi opsi unduh audio/sound TikTok terpisah dalam format MP3 berkualitas tinggi.';

        if (!inputUrl.value.trim() || inputUrl.placeholder.includes('youtube') || inputUrl.placeholder.includes('instagram')) {
            inputUrl.placeholder = 'Tempel link TikTok di sini (contoh: https://www.tiktok.com/@.../video/... atau https://vt.tiktok.com/...)';
        }

        if (fromUserClick) {
            showToast('Mode TikTok Aktif: Siap unduh video tanpa watermark & audio MP3.', 'info');
        }
    } else if (platform === 'instagram') {
        if (btnNavInstagram) {
            btnNavInstagram.classList.add('active');
            btnNavInstagram.setAttribute('aria-selected', 'true');
        }
        document.body.classList.add('theme-instagram');
        if (brandLogoSvg) brandLogoSvg.innerHTML = IG_SVG_PATH;
        if (brandSubtitle) brandSubtitle.textContent = 'Instagram Reels & Video Downloader • HD MP4';

        if (heroBadgeIcon) heroBadgeIcon.textContent = '📸';
        if (heroBadgeText) heroBadgeText.textContent = 'Download Reels, Video, & Audio Instagram Bebas Watermark HD';
        if (heroTitle) heroTitle.innerHTML = 'Download Instagram <span class="gradient-text" id="heroGradientText">Reels & Video</span> Cepat';
        if (heroDesc) heroDesc.innerHTML = 'Download Reels, Video, dan Postingan Instagram dengan kualitas gambar dan suara terbaik (MP4 HD). Otomatis siap diputar di semua perangkat, TV, HP, dan disimpan ke galeri tanpa watermark.';

        if (!inputUrl.value.trim() || inputUrl.placeholder.includes('youtube') || inputUrl.placeholder.includes('tiktok')) {
            inputUrl.placeholder = 'Tempel link Instagram di sini (contoh: https://www.instagram.com/reel/...)';
        }

        if (fromUserClick) {
            showToast('Mode Instagram Aktif: Siap unduh Reels, Video Feed & Postingan HD.', 'info');
        }
    } else {
        // YouTube mode
        if (btnNavYouTube) {
            btnNavYouTube.classList.add('active');
            btnNavYouTube.setAttribute('aria-selected', 'true');
        }
        if (brandLogoSvg) brandLogoSvg.innerHTML = YT_SVG_PATH;
        if (brandSubtitle) brandSubtitle.textContent = 'YouTube, Instagram & TikTok • Full HD + Audio Muxing';

        if (heroBadgeIcon) heroBadgeIcon.textContent = '📺';
        if (heroBadgeText) heroBadgeText.textContent = 'Solusi Video 1080p, 2K & 4K + Audio Utuh + Kompatibel Smart TV';
        if (heroTitle) heroTitle.innerHTML = 'Download YouTube <span class="gradient-text" id="heroGradientText">Resolusi Tinggi</span> + Suara Utuh';
        if (heroDesc) heroDesc.innerHTML = 'Download video tanpa audio bisu! YouTube Downloader Pro otomatis menggabungkan stream video dan audio dengan <strong>FFmpeg</strong>, serta dilengkapi <strong>Mode Kompatibel TV (H.264 + AAC)</strong> agar pasti bisa diputar di Smart TV, Android TV, dan USB flashdisk.';

        if (!inputUrl.value.trim() || inputUrl.placeholder.includes('instagram') || inputUrl.placeholder.includes('tiktok')) {
            inputUrl.placeholder = 'Tempel URL YouTube di sini (contoh: https://www.youtube.com/watch?v=...)';
        }

        if (fromUserClick) {
            showToast('Mode YouTube Aktif: Siap unduh video, shorts & audio 1080p/4K.', 'info');
        }
    }
}

function detectAndSwitchPlatform(url) {
    if (!url) return;
    const lower = url.toLowerCase();
    if (lower.includes('tiktok.com') && currentPlatform !== 'tiktok') {
        setPlatform('tiktok');
        showToast('Link TikTok terdeteksi — otomatis beralih ke Mode TikTok!', 'info');
    } else if ((lower.includes('instagram.com') || lower.includes('instagr.am')) && currentPlatform !== 'instagram') {
        setPlatform('instagram');
        showToast('Link Instagram terdeteksi — otomatis beralih ke Mode Instagram!', 'info');
    } else if ((lower.includes('youtube.com') || lower.includes('youtu.be')) && currentPlatform !== 'youtube') {
        setPlatform('youtube');
        showToast('Link YouTube terdeteksi — otomatis beralih ke Mode YouTube!', 'info');
    }
}

// -----------------------------------------------------------------------------
// Session & Auto-Download Helpers
// -----------------------------------------------------------------------------
function getSessionId() {
    let sid = localStorage.getItem('yt_pro_session_id');
    if (!sid) {
        sid = 'sess_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
        localStorage.setItem('yt_pro_session_id', sid);
    }
    return sid;
}

function triggerAutoDownload(filename, sessionId) {
    if (!filename) return;
    const downloadUrl = `/api/file/${encodeURIComponent(filename)}?session_id=${encodeURIComponent(sessionId || getSessionId())}`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 150);
}

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

    // Platform switcher menu clicks
    if (btnNavYouTube) {
        btnNavYouTube.addEventListener('click', () => setPlatform('youtube', true));
    }
    if (btnNavInstagram) {
        btnNavInstagram.addEventListener('click', () => setPlatform('instagram', true));
    }
    if (btnNavTikTok) {
        btnNavTikTok.addEventListener('click', () => setPlatform('tiktok', true));
    }

    // Auto-detect platform on typing / paste
    inputUrl.addEventListener('input', () => {
        detectAndSwitchPlatform(inputUrl.value.trim());
    });

    // Paste from Clipboard
    btnPaste.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                inputUrl.value = text.trim();
                detectAndSwitchPlatform(text.trim());
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
        const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isLocalHost) {
            try {
                const res = await fetch('/api/open-folder', { method: 'POST' });
                if (res.ok) {
                    showToast('Folder downloads berhasil dibuka di komputer!', 'success');
                } else {
                    showToast('File otomatis tersimpan di folder Downloads browser Anda.', 'info');
                }
            } catch (e) {
                showToast('File otomatis tersimpan di folder Downloads browser Anda.', 'info');
            }
        } else {
            showToast('File otomatis tersimpan di folder Downloads laptop/perangkat Anda.', 'info');
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
        let msg = 'Silakan masukkan link video YouTube terlebih dahulu.';
        if (currentPlatform === 'tiktok') msg = 'Silakan masukkan link Video TikTok terlebih dahulu.';
        else if (currentPlatform === 'instagram') msg = 'Silakan masukkan link Reels atau Video Instagram terlebih dahulu.';
        showError(msg);
        return;
    }

    // Auto switch tab if user pasted cross-platform link
    detectAndSwitchPlatform(url);

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

        if (data.platform) {
            setPlatform(data.platform);
        }

        // If backend auto-corrected a typo in the URL
        if (data.correction_note) {
            if (data.webpage_url) {
                inputUrl.value = data.webpage_url;
            }
            showToast(data.correction_note, 'info');
        }

        renderVideoCard(data);
        const platformName = data.platform === 'tiktok' ? 'TikTok' : (data.platform === 'instagram' ? 'Instagram' : 'video');
        showToast(`Detail ${platformName} berhasil ditemukan!`, 'success');

        // Scroll smoothly to video details
        videoCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
        let errMsg = err.message || (currentPlatform === 'tiktok' ? 'Terjadi kesalahan saat memeriksa URL TikTok.' : (currentPlatform === 'instagram' ? 'Terjadi kesalahan saat memeriksa URL Instagram.' : 'Terjadi kesalahan saat memeriksa URL YouTube.'));
        if (errMsg.includes('This video is not available') || errMsg.includes('This video is unavailable')) {
            if (currentPlatform === 'tiktok') {
                errMsg = 'Video TikTok tidak ditemukan atau telah dihapus/disetel privat.';
            } else if (currentPlatform === 'instagram') {
                errMsg = 'Konten Instagram tidak ditemukan atau disetel privat. Pastikan link publik dan akun tidak dikunci.';
            } else {
                errMsg = 'Video tidak ditemukan di YouTube. Pastikan link video benar, video tidak disetel privat, dan tidak ada kesalahan ketik pada link.';
            }
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
    videoTitle.textContent = data.title || (data.platform === 'tiktok' ? 'TikTok Video' : (data.platform === 'instagram' ? 'Instagram Media' : 'YouTube Video'));
    videoChannel.textContent = data.channel || (data.platform === 'tiktok' ? '@tiktok' : (data.platform === 'instagram' ? '@instagram' : 'Channel'));

    if (data.view_count && Number(data.view_count) > 0) {
        videoViews.textContent = Number(data.view_count).toLocaleString('id-ID') + ' views';
        videoViews.style.display = 'inline';
    } else {
        videoViews.textContent = data.platform === 'tiktok' ? 'TikTok Video' : (data.platform === 'instagram' ? 'Instagram Media' : '0 views');
        videoViews.style.display = 'inline';
    }

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
                tv_mode: isTv,
                session_id: getSessionId()
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
        const currentSession = data.session_id || getSessionId();
        if (data.filename) {
            const dlUrl = `/api/file/${encodeURIComponent(data.filename)}?session_id=${encodeURIComponent(currentSession)}`;
            btnBrowserDownload.href = dlUrl;
            btnBrowserDownload.download = data.filename;

            // 1. Auto-download directly to user's computer/device
            triggerAutoDownload(data.filename, currentSession);

            // 2. Save to user's private localStorage history
            saveLocalHistoryItem({
                id: data.job_id || Date.now().toString(),
                filename: data.filename,
                title: data.title || currentVideoData?.title || data.filename,
                platform: data.platform || currentVideoData?.platform || currentPlatform,
                size: data.total || data.downloaded || '—',
                ext: data.filename.split('.').pop() || 'mp4',
                is_video: selectedFormatType === 'video',
                tv_mode: data.tv_mode,
                session_id: currentSession,
                date: new Date().toLocaleDateString('id-ID', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                }),
                timestamp: Date.now()
            });
        }

        successMessageText.textContent = data.tv_mode
            ? 'Unduhan selesai & langsung tersimpan di komputer! Format H.264 + AAC siap diputar di TV.'
            : 'Unduhan selesai & langsung tersimpan di komputer dengan resolusi penuh!';

        progressSuccessActions.classList.remove('hidden');

        btnStartDownload.disabled = false;
        btnStartDownload.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            <span>Download Lagi</span>
        `;

        showToast('Video berhasil diunduh ke komputer Anda!', 'success');
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
            body: JSON.stringify({ filename, session_id: getSessionId() })
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
// Download History (Private & LocalStorage Powered)
// -----------------------------------------------------------------------------
const LOCAL_STORAGE_HISTORY_KEY = 'yt_pro_user_history';

function getLocalHistory() {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function saveLocalHistoryItem(item) {
    let list = getLocalHistory();
    list = list.filter(x => x.filename !== item.filename);
    list.unshift(item);
    if (list.length > 50) list = list.slice(0, 50);
    try {
        localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(list));
    } catch (e) {}
    renderLocalHistory();
}

function removeLocalHistoryItem(filename, sessionId) {
    let list = getLocalHistory();
    list = list.filter(x => x.filename !== filename);
    try {
        localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(list));
    } catch (e) {}

    // Clean up from server if still exists in temporary buffer
    fetch(`/api/file/${encodeURIComponent(filename)}?session_id=${encodeURIComponent(sessionId || '')}`, {
        method: 'DELETE'
    }).catch(() => {});

    renderLocalHistory();
    showToast('Item berhasil dihapus dari riwayat pribadi.', 'info');
}

function loadHistory() {
    renderLocalHistory();
}

function renderLocalHistory() {
    const files = getLocalHistory();
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

        const isVid = file.is_video !== false;
        const iconClass = isVid ? 'icon-video' : 'icon-audio';
        const iconText = (file.ext || (isVid ? 'MP4' : 'MP3')).toUpperCase();

        let tvBadgeHtml = '';
        let convertBtnHtml = '';

        if (isVid) {
            if (file.tv_mode) {
                tvBadgeHtml = '<span class="badge-codec badge-tv-ready">✓ TV Ready (H.264 + AAC)</span>';
            } else {
                tvBadgeHtml = '<span class="badge-codec badge-tv-not-ready">Standar (Resolusi Penuh)</span>';
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

        let platformBadgeHtml = '';
        if (file.platform === 'tiktok' || (file.filename && file.filename.toLowerCase().includes('tiktok'))) {
            platformBadgeHtml = '<span class="badge-platform badge-platform-tiktok">TikTok</span>';
        } else if (file.platform === 'instagram' || (file.filename && (file.filename.includes('Instagram') || file.filename.toLowerCase().includes('reel')))) {
            platformBadgeHtml = '<span class="badge-platform badge-platform-instagram">Instagram</span>';
        } else {
            platformBadgeHtml = '<span class="badge-platform badge-platform-youtube">YouTube</span>';
        }

        const dlUrl = `/api/file/${encodeURIComponent(file.filename)}?session_id=${encodeURIComponent(file.session_id || '')}`;

        item.innerHTML = `
            <div class="history-left">
                <div class="file-type-icon ${iconClass}">${iconText}</div>
                <div class="history-meta">
                    <div class="history-file-name" title="${file.filename}">${file.title || file.filename}</div>
                    <div class="history-sub-meta">
                        ${platformBadgeHtml}
                        <span>•</span>
                        <span>${file.size || '—'}</span>
                        <span>•</span>
                        <span>${file.date || ''}</span>
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
                <a href="${dlUrl}" download="${file.filename}" class="btn btn-sm btn-outline" title="Unduh lagi ke komputer">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                    </svg>
                    <span>Unduh</span>
                </a>
                <button class="btn btn-sm btn-delete" title="Hapus dari riwayat">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                    </svg>
                </button>
            </div>
        `;

        item.querySelector('.btn-play').addEventListener('click', () => {
            openMediaPlayer(file.filename, isVid, file.session_id);
        });

        const convBtn = item.querySelector('.btn-convert-tv');
        if (convBtn) {
            convBtn.addEventListener('click', () => {
                convertFileToTv(file.filename, file.session_id);
            });
        }

        item.querySelector('.btn-delete').addEventListener('click', () => {
            if (confirm(`Hapus "${file.filename}" dari riwayat pribadi Anda?`)) {
                removeLocalHistoryItem(file.filename, file.session_id);
            }
        });

        historyList.appendChild(item);
    });
}

// -----------------------------------------------------------------------------
// Media Player Modal
// -----------------------------------------------------------------------------
function openMediaPlayer(filename, isVideo = true, sessionId = null) {
    modalTitle.textContent = filename;
    const sid = sessionId || getSessionId();
    const streamUrl = `/api/stream/${encodeURIComponent(filename)}?session_id=${encodeURIComponent(sid)}`;

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
