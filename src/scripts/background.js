/**
 * BackgroundManager
 * Manages background image and video layers
 */

// Tauri API - dynamic import with fallback
let convertFileSrc;
let isTauri = false;

try {
    const tauriCore = await import('@tauri-apps/api/core');
    convertFileSrc = tauriCore.convertFileSrc;
    isTauri = true;
} catch (e) {
    // Running in browser mode
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'avi', 'mkv'];

export class BackgroundManager {
    constructor() {
        this.bgImage = document.getElementById('background-image');
        this.bgVideo = document.getElementById('background-video');
        this.currentMedia = null;   // file path
        this.currentType = null;    // 'image' | 'video' | null
        this.muted = true;          // default muted

        // Background music
        this.bgAudio = new Audio();
        this.bgAudio.loop = true;
        this.bgAudio.volume = 0.5;
        this.musicPath = null;
        this.musicMuted = true;
    }

    /**
     * Determine if a file path is an image or video
     * @param {string} filePath
     * @returns {'image'|'video'|null}
     */
    _getMediaType(filePath) {
        const ext = filePath.split('.').pop().toLowerCase();
        if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
        if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
        return null;
    }

    /**
     * Convert local path to asset URL (Tauri-compatible)
     * @param {string} filePath
     * @returns {string}
     */
    _toAssetUrl(filePath) {
        if (isTauri && convertFileSrc) {
            return convertFileSrc(filePath);
        }
        return filePath;
    }

    /**
     * Set background media (image or video)
     * @param {string} filePath - Path to media file
     */
    setMedia(filePath) {
        if (!filePath) {
            this.clearMedia();
            return;
        }

        const type = this._getMediaType(filePath);
        if (!type) {
            console.warn('Unsupported media type:', filePath);
            return;
        }

        // Clear previous
        this._hideAll();

        const url = this._toAssetUrl(filePath);
        this.currentMedia = filePath;
        this.currentType = type;

        if (type === 'image') {
            this.bgImage.src = url;
            this.bgImage.classList.add('active');
        } else {
            this.bgVideo.src = url;
            this.bgVideo.muted = this.muted;
            this.bgVideo.classList.add('active');
            this.bgVideo.play().catch(e => console.warn('Video autoplay failed:', e));
        }
    }

    /**
     * Set muted state for background video
     * @param {boolean} muted
     */
    setMuted(muted) {
        this.muted = muted;
        this.bgVideo.muted = muted;
    }

    /**
     * Toggle mute/unmute
     * @returns {boolean} new muted state
     */
    toggleMute() {
        this.setMuted(!this.muted);
        return this.muted;
    }

    /**
     * @returns {boolean} whether video audio is muted
     */
    isMuted() {
        return this.muted;
    }

    /**
     * Clear all background media
     */
    clearMedia() {
        this._hideAll();
        this.currentMedia = null;
        this.currentType = null;
    }

    /**
     * Hide both image and video
     * @private
     */
    _hideAll() {
        this.bgImage.classList.remove('active');
        this.bgImage.src = '';
        this.bgVideo.classList.remove('active');
        this.bgVideo.pause();
        this.bgVideo.src = '';
    }

    /**
     * Get current media info
     * @returns {{ path: string|null, type: string|null }}
     */
    getCurrentMedia() {
        return { path: this.currentMedia, type: this.currentType };
    }

    // ─── Background Music ──────────────────────────────────

    /**
     * Set background music from a file path
     * @param {string} filePath
     */
    setMusic(filePath) {
        if (!filePath) {
            this.clearMusic();
            return;
        }

        const url = this._toAssetUrl(filePath);
        this.musicPath = filePath;
        this.bgAudio.src = url;
        this.bgAudio.muted = this.musicMuted;

        if (!this.musicMuted) {
            this.bgAudio.play().catch(e => console.warn('Music autoplay failed:', e));
        }
    }

    /**
     * Clear background music
     */
    clearMusic() {
        this.bgAudio.pause();
        this.bgAudio.src = '';
        this.musicPath = null;
    }

    /**
     * Set music volume
     * @param {number} volume - 0 to 100
     */
    setMusicVolume(volume) {
        this.bgAudio.volume = Math.max(0, Math.min(1, volume / 100));
    }

    /**
     * Set music muted state
     * @param {boolean} muted
     */
    setMusicMuted(muted) {
        this.musicMuted = muted;
        this.bgAudio.muted = muted;
        if (!muted && this.musicPath) {
            this.bgAudio.play().catch(e => console.warn('Music play failed:', e));
        }
    }

    /**
     * Toggle music mute
     * @returns {boolean} new muted state
     */
    toggleMusicMute() {
        this.setMusicMuted(!this.musicMuted);
        return this.musicMuted;
    }

    /**
     * Get current music info
     * @returns {{ path: string|null, volume: number, muted: boolean }}
     */
    getCurrentMusic() {
        return {
            path: this.musicPath,
            volume: Math.round(this.bgAudio.volume * 100),
            muted: this.musicMuted
        };
    }
}
