/**
 * PresetManager
 * Manages preset loading, application, and persistence
 * Presets now capture ALL reader settings for a complete experience snapshot.
 */
import { showToast } from './ui.js';

// Tauri API - dynamic import with fallback
let invoke;
let isTauri = false;

try {
    const tauriCore = await import('@tauri-apps/api/core');
    invoke = tauriCore.invoke;
    isTauri = true;
} catch (e) {
    // Running in browser mode
}

export class PresetManager {
    constructor(reader, bgManager, overlayManager) {
        this.reader = reader;
        this.bgManager = bgManager;
        this.overlayManager = overlayManager;
        this.currentPreset = null;
        this.presets = [];
    }

    /**
     * Load presets from backend
     */
    async loadPresets() {
        if (!isTauri) {
            this.presets = this._getFallbackPresets();
            return this.presets;
        }

        try {
            const presetNames = await invoke('list_presets');
            this.presets = [];
            for (const name of presetNames) {
                try {
                    const preset = await invoke('load_preset', { presetName: name });
                    this.presets.push(preset);
                } catch (error) {
                    console.error(`Failed to load preset ${name}:`, error);
                }
            }
            return this.presets;
        } catch (error) {
            console.error('Failed to load presets from backend:', error);
            this.presets = this._getFallbackPresets();
            return this.presets;
        }
    }

    /**
     * Apply a preset — applies ALL settings it contains
     * @param {string} presetName
     * @returns {boolean}
     */
    async applyPreset(presetName) {
        let preset = this.presets.find(p => p.name === presetName);

        if (!preset && isTauri) {
            try {
                preset = await invoke('load_preset', { presetName });
            } catch (error) {
                console.error('Failed to load preset:', error);
                return false;
            }
        }

        if (!preset) return false;

        try {
            // Background
            if (preset.background) {
                if (preset.background.type === 'media' && preset.background.path) {
                    this.bgManager.setMedia(preset.background.path);
                } else if (preset.background.type === 'image' && preset.background.path) {
                    if (isTauri) {
                        const appDir = await invoke('get_app_dir');
                        const fullPath = `${appDir}/${preset.background.path}`;
                        this.bgManager.setMedia(fullPath);
                    } else {
                        this.bgManager.setMedia(preset.background.path);
                    }
                } else {
                    this.bgManager.clearMedia();
                }
            }

            // Overlay
            if (preset.overlay) {
                this.overlayManager.setTint(preset.overlay.color, preset.overlay.opacity);
            }

            // Reader core
            if (preset.reader) {
                const r = preset.reader;
                if (r.opacity !== undefined) this.reader.setOpacity(r.opacity);
                if (r.backgroundColor) this.reader.setBackgroundColor(r.backgroundColor);
                if (r.textColor) this.reader.setTextColor(r.textColor);
                if (r.fontFamily) this.reader.setFontFamily(r.fontFamily);
                if (r.fontSize) this.reader.setFontSize(r.fontSize);
                if (r.readingMode) this.reader.setFlow(r.readingMode);
                if (r.glassmorphism !== undefined) this.reader.setGlassmorphism(r.glassmorphism);
                if (r.glassBlur !== undefined) this.reader.setBlur(r.glassBlur);
                if (r.scrollbarTrack || r.scrollbarThumb) {
                    this.reader.setScrollbarColors(r.scrollbarTrack, r.scrollbarThumb);
                }
            }

            this.currentPreset = preset;
            return true;
        } catch (error) {
            console.error('Error applying preset:', error);
            showToast('Failed to apply preset', 'error');
            return false;
        }
    }

    /**
     * Build a full preset snapshot from current state
     * @param {string} name
     * @param {object} currentPrefs - current preferences object from main.js
     * @returns {object} Preset data
     */
    buildPresetFromCurrent(name, currentPrefs) {
        const bgMedia = this.bgManager.getCurrentMedia();

        return {
            version: '2.0',
            name: name,
            author: 'User',
            description: `Custom preset: ${name}`,
            background: {
                type: bgMedia.path ? 'media' : 'none',
                path: bgMedia.path || null
            },
            overlay: {
                color: this.overlayManager?.currentColor || '#000000',
                opacity: this.overlayManager?.currentOpacity || 0
            },
            reader: {
                opacity: (currentPrefs.containerOpacity ?? 95) / 100,
                backgroundColor: currentPrefs.containerColor || '#FFFFFF',
                textColor: currentPrefs.textColor || '#1a1a1a',
                fontFamily: currentPrefs.fontFamily || 'serif',
                fontSize: currentPrefs.fontSize || 18,
                readingMode: currentPrefs.readingMode || 'paginated',
                glassmorphism: currentPrefs.glassmorphism || false,
                glassBlur: currentPrefs.glassBlur ?? 12,
                scrollbarTrack: currentPrefs.scrollbarTrack || '#1a1a1a',
                scrollbarThumb: currentPrefs.scrollbarThumb || '#4a9eff'
            }
        };
    }

    /**
     * Extract preferences from a preset for syncing currentPrefs
     * @param {object} preset
     * @returns {object} Partial prefs object
     */
    extractPrefsFromPreset(preset) {
        const prefs = {};
        if (preset.reader) {
            const r = preset.reader;
            if (r.fontFamily) prefs.fontFamily = r.fontFamily;
            if (r.fontSize) prefs.fontSize = r.fontSize;
            if (r.readingMode) prefs.readingMode = r.readingMode;
            if (r.textColor) prefs.textColor = r.textColor;
            if (r.backgroundColor) prefs.containerColor = r.backgroundColor;
            if (r.opacity !== undefined) prefs.containerOpacity = Math.round(r.opacity * 100);
            if (r.glassmorphism !== undefined) prefs.glassmorphism = r.glassmorphism;
            if (r.glassBlur !== undefined) prefs.glassBlur = r.glassBlur;
            if (r.scrollbarTrack) prefs.scrollbarTrack = r.scrollbarTrack;
            if (r.scrollbarThumb) prefs.scrollbarThumb = r.scrollbarThumb;
        }
        if (preset.background?.path) {
            prefs.bgMediaPath = preset.background.path;
        } else {
            prefs.bgMediaPath = null;
        }
        return prefs;
    }

    /**
     * Save current atmosphere as a custom preset
     * @param {string} name
     * @param {object} currentPrefs
     */
    async saveCurrentAsPreset(name, currentPrefs) {
        if (!isTauri) {
            showToast('Cannot save in browser mode', 'error');
            return null;
        }

        try {
            const presetData = this.buildPresetFromCurrent(name, currentPrefs);
            const presetJson = JSON.stringify(presetData);
            const saved = await invoke('save_custom_preset', { name, presetJson });

            await this.loadPresets();
            showToast(`Saved preset: ${name}`, 'success');
            return saved;
        } catch (error) {
            console.error('Failed to save custom preset:', error);
            showToast('Failed to save preset', 'error');
            return null;
        }
    }

    /**
     * Auto-save the current state as the _last_session preset (no toast)
     * @param {object} currentPrefs
     */
    async saveLastSession(currentPrefs) {
        if (!isTauri) return;
        try {
            const presetData = this.buildPresetFromCurrent('_last_session', currentPrefs);
            const presetJson = JSON.stringify(presetData);
            await invoke('save_custom_preset', { name: '_last_session', presetJson });
        } catch (error) {
            console.error('Failed to save last session preset:', error);
        }
    }

    /**
     * Delete a user-created preset
     * @param {string} name
     */
    async deletePreset(name) {
        if (!isTauri) return;
        try {
            await invoke('delete_preset', { name });
            await this.loadPresets();
            showToast(`Deleted preset: ${name}`, 'success');
        } catch (error) {
            console.error('Failed to delete preset:', error);
            showToast('Failed to delete preset', 'error');
        }
    }

    getPresets() {
        // Filter out the internal _last_session preset from the list
        return this.presets.filter(p => p.name !== '_last_session');
    }

    getCurrentPreset() {
        return this.currentPreset;
    }

    _getFallbackPresets() {
        return [
            {
                version: '2.0',
                name: 'Cozy Reading',
                author: 'EPUB Team',
                description: 'Warm, comfortable reading atmosphere',
                background: { type: 'none', path: null },
                overlay: { color: '#8B4513', opacity: 0.2 },
                reader: {
                    opacity: 0.92, backgroundColor: '#FFF8DC',
                    textColor: '#3e2723', fontFamily: 'serif', fontSize: 18,
                    readingMode: 'paginated', glassmorphism: false, glassBlur: 12,
                    scrollbarTrack: '#1a1a1a', scrollbarThumb: '#8B4513'
                }
            },
            {
                version: '2.0',
                name: 'Focus Mode',
                author: 'EPUB Team',
                description: 'Minimal distraction, maximum concentration',
                background: { type: 'none', path: null },
                overlay: { color: '#000000', opacity: 0 },
                reader: {
                    opacity: 1.0, backgroundColor: '#FFFFFF',
                    textColor: '#1a1a1a', fontFamily: 'sans-serif', fontSize: 18,
                    readingMode: 'paginated', glassmorphism: false, glassBlur: 0,
                    scrollbarTrack: '#f0f0f0', scrollbarThumb: '#999999'
                }
            },
            {
                version: '2.0',
                name: 'Night Reading',
                author: 'EPUB Team',
                description: 'Gentle on the eyes for late-night reading',
                background: { type: 'none', path: null },
                overlay: { color: '#1a1a2e', opacity: 0.4 },
                reader: {
                    opacity: 0.85, backgroundColor: '#2d2d2d',
                    textColor: '#e0e0e0', fontFamily: 'serif', fontSize: 20,
                    readingMode: 'paginated', glassmorphism: false, glassBlur: 8,
                    scrollbarTrack: '#1a1a1a', scrollbarThumb: '#555555'
                }
            }
        ];
    }
}
