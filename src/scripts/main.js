/**
 * Main Application Entry Point
 * Initializes managers and wires up event handlers
 */
import { EpubReader } from './reader.js';
import { BackgroundManager } from './background.js';
import { OverlayManager } from './overlay.js';
import { PresetManager } from './presets.js';
import { LibraryManager } from './library.js';
import { showToast, toggleVisibility, setupModalClose } from './ui.js';
import { readFile } from '@tauri-apps/plugin-fs';

// Tauri API imports
let invoke;
let appWindow;
let isTauri = false;

try {
    const tauriCore = await import('@tauri-apps/api/core');
    invoke = tauriCore.invoke;

    const tauriWindow = await import('@tauri-apps/api/window');
    appWindow = tauriWindow.getCurrentWindow();

    isTauri = true;
} catch (e) {
    console.warn('Tauri API not available, running in browser mode');
}

// Initialize managers
const reader = new EpubReader('reader-container');
const bgManager = new BackgroundManager();
const overlayManager = new OverlayManager();
const presetManager = new PresetManager(reader, bgManager, overlayManager);
const libraryManager = new LibraryManager(reader);

// Export Tauri state for other modules
export { invoke, isTauri };

// UI Elements
const openEpubBtn = document.getElementById('open-epub-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const presetBtn = document.getElementById('preset-btn');
const helpBtn = document.getElementById('help-btn');
const bookTitle = document.getElementById('book-title');

const presetPanel = document.getElementById('preset-panel');
const presetList = document.getElementById('preset-list');
const closePresetPanel = document.getElementById('close-preset-panel');

const shortcutOverlay = document.getElementById('shortcut-overlay');
const closeShortcutOverlay = document.getElementById('close-shortcut-overlay');

const userLibrary = document.getElementById('recent-books-container');

// Set reader container to empty state initially
document.getElementById('reader-container').classList.add('empty');

// Track current book ID for progress saving
let currentBookId = null;

// Debounce for progress saving
let saveTimeout = null;

// Current preferences
let currentPrefs = {
    fontFamily: 'serif',
    fontSize: 18,
    lastPreset: 'Cozy Reading',
    readingMode: 'paginated',
    textColor: '#1a1a1a',
    containerColor: '#FFFFFF',
    containerOpacity: 95,
    glassmorphism: false,
    glassBlur: 12,
    bgMediaPath: null,
    bgAudioMuted: true,
    bgMusicPath: null,
    bgMusicVolume: 50,
    bgMusicMuted: true,
    scrollbarTrack: '#1a1a1a',
    scrollbarThumb: '#4a9eff'
};

/**
 * Initialize the application
 */
async function init() {
    // Load user preferences first
    if (isTauri) {
        try {
            currentPrefs = await invoke('get_preferences');
        } catch (error) {
            console.error('Failed to load preferences:', error);
        }
    }

    // Load presets
    const presets = await presetManager.loadPresets();
    renderPresetList(presets);

    // Try to restore _last_session preset first, then apply user prefs on top
    const hasLastSession = presets.some(p => p.name === '_last_session');
    if (hasLastSession) {
        const applied = await presetManager.applyPreset('_last_session');
        if (applied) {
            // Sync currentPrefs from the applied preset
            const sessionPrefs = presetManager.extractPrefsFromPreset(presetManager.getCurrentPreset());
            Object.assign(currentPrefs, sessionPrefs);
        }
    } else {
        // First run — apply from currentPrefs directly
        reader.setFontFamily(currentPrefs.fontFamily);
        reader.setFontSize(currentPrefs.fontSize);
        reader.setFlow(currentPrefs.readingMode || 'paginated');
        reader.setTextColor(currentPrefs.textColor || '#1a1a1a');
        reader.setBackgroundColor(currentPrefs.containerColor || '#FFFFFF');
        reader.setOpacity((currentPrefs.containerOpacity ?? 95) / 100);
        reader.setGlassmorphism(currentPrefs.glassmorphism || false);
        reader.setBlur(currentPrefs.glassBlur ?? 12);
        reader.setScrollbarColors(
            currentPrefs.scrollbarTrack || '#1a1a1a',
            currentPrefs.scrollbarThumb || '#4a9eff'
        );
        if (currentPrefs.bgMediaPath) {
            bgManager.setMedia(currentPrefs.bgMediaPath);
        }
        bgManager.setMuted(currentPrefs.bgAudioMuted ?? true);
    }

    updateFontUI();
    updateModeUI();
    updateAppearanceUI();

    // Show background filename if set
    if (currentPrefs.bgMediaPath) {
        const bgMediaInfo = document.getElementById('bg-media-info');
        const bgFilename = document.getElementById('bg-media-filename');
        const name = currentPrefs.bgMediaPath.split(/[\\/]/).pop();
        if (bgFilename) bgFilename.textContent = name;
        if (bgMediaInfo) bgMediaInfo.classList.remove('hidden');

        // Show audio toggle if background is a video
        const ext = currentPrefs.bgMediaPath.split('.').pop().toLowerCase();
        const isVideo = ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext);
        const bgAudioGroup = document.getElementById('bg-audio-group');
        if (bgAudioGroup) bgAudioGroup.classList.toggle('hidden', !isVideo);
        if (isVideo) {
            const bgAudioToggle = document.getElementById('bg-audio-toggle');
            if (bgAudioToggle) bgAudioToggle.checked = !(currentPrefs.bgAudioMuted ?? true);
        }
    }

    // Restore background music if set
    if (currentPrefs.bgMusicPath) {
        bgManager.setMusicVolume(currentPrefs.bgMusicVolume ?? 50);
        bgManager.setMusic(currentPrefs.bgMusicPath);
        bgManager.setMusicMuted(currentPrefs.bgMusicMuted ?? true);

        const bgMusicInfo = document.getElementById('bg-music-info');
        const bgMusicFilename = document.getElementById('bg-music-filename');
        const bgMusicControls = document.getElementById('bg-music-controls');
        const name = currentPrefs.bgMusicPath.split(/[\\/]/).pop();
        if (bgMusicFilename) bgMusicFilename.textContent = name;
        if (bgMusicInfo) bgMusicInfo.classList.remove('hidden');
        if (bgMusicControls) bgMusicControls.classList.remove('hidden');

        const bgMusicToggle = document.getElementById('bg-music-toggle');
        if (bgMusicToggle) bgMusicToggle.checked = !(currentPrefs.bgMusicMuted ?? true);

        const bgMusicVolume = document.getElementById('bg-music-volume');
        const bgMusicVolumeValue = document.getElementById('bg-music-volume-value');
        if (bgMusicVolume) bgMusicVolume.value = currentPrefs.bgMusicVolume ?? 50;
        if (bgMusicVolumeValue) bgMusicVolumeValue.textContent = `${currentPrefs.bgMusicVolume ?? 50}%`;
    }

    // Load recent books
    await libraryManager.init();

    // Show library initially
    toggleVisibility(userLibrary, true);
    const readerContainer = document.getElementById('reader-container');
    toggleVisibility(readerContainer, false);

    // Hide nav controls in library
    document.querySelector('.nav-controls').style.visibility = 'hidden';

    // Focus first book for keyboard navigation
    libraryManager.focusFirstBook();

    setupEventListeners();
    setupSettingsPanel();

    // Register event listener for opening books from library
    document.addEventListener('open-recent-book', async (e) => {
        const path = e.detail.path;
        await openBookFromFile(path);
    });

    showToast('Epilogue ready', 'info');
}

/**
 * Render preset list in panel
 */
function renderPresetList(presets) {
    presetList.innerHTML = '';

    const BUILTIN_NAMES = ['Cozy Reading', 'Focus Mode', 'Night Reading'];

    // Sort: user-created first, then built-in defaults
    const userPresets = presets.filter(p => !BUILTIN_NAMES.includes(p.name));
    const builtinPresets = presets.filter(p => BUILTIN_NAMES.includes(p.name));
    const ordered = [...userPresets, ...builtinPresets];

    ordered.forEach(preset => {
        const item = document.createElement('div');
        item.className = 'preset-item';
        const isBuiltin = BUILTIN_NAMES.includes(preset.name);

        // Mark current preset as active
        if (presetManager.getCurrentPreset()?.name === preset.name) {
            item.classList.add('active');
        }

        const header = document.createElement('div');
        header.className = 'preset-header';

        const title = document.createElement('h4');
        title.textContent = preset.name;
        header.appendChild(title);

        // Delete button for user-created presets
        if (!isBuiltin) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'preset-delete-btn';
            deleteBtn.title = 'Delete preset';
            deleteBtn.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            `;
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await presetManager.deletePreset(preset.name);
                renderPresetList(presetManager.getPresets());
            });
            header.appendChild(deleteBtn);
        }

        const description = document.createElement('p');
        description.textContent = preset.description || '';
        if (isBuiltin) {
            description.textContent += ' (Built-in)';
        }

        item.appendChild(header);
        item.appendChild(description);

        item.addEventListener('click', async () => {
            const applied = await presetManager.applyPreset(preset.name);
            if (applied) {
                // Sync currentPrefs from the applied preset
                const presetPrefs = presetManager.extractPrefsFromPreset(preset);
                Object.assign(currentPrefs, presetPrefs);
                savePreferences();

                updateFontUI();
                updateModeUI();
                updateAppearanceUI();

                // Update bg filename display
                const bgMediaInfo = document.getElementById('bg-media-info');
                const bgFilename = document.getElementById('bg-media-filename');
                if (currentPrefs.bgMediaPath) {
                    const name = currentPrefs.bgMediaPath.split(/[\\/]/).pop();
                    if (bgFilename) bgFilename.textContent = name;
                    if (bgMediaInfo) bgMediaInfo.classList.remove('hidden');
                } else {
                    if (bgMediaInfo) bgMediaInfo.classList.add('hidden');
                }

                showToast(`Applied preset: ${preset.name}`, 'success');
            }

            // Update active state
            document.querySelectorAll('.preset-item').forEach(p => p.classList.remove('active'));
            item.classList.add('active');
        });

        presetList.appendChild(item);
    });
}

/**
 * Open book from file path
 */
async function openBookFromFile(filePath) {
    try {
        showToast('Opening book...', 'info');

        // Read file from backend
        const fileData = await readFile(filePath);
        const arrayBuffer = fileData.buffer;

        // Open in reader
        const metadata = await reader.openBook(arrayBuffer);

        // Attach keyboard and mouse handlers to iframe
        if (reader.rendition) {
            reader.rendition.on('keydown', handleKeyboard);
            reader.rendition.on('mousemove', handleMouseMove);
        }

        // Apply current font settings to the new rendition
        reader.setFontFamily(currentPrefs.fontFamily);
        reader.setFontSize(currentPrefs.fontSize);

        // Update title
        bookTitle.textContent = metadata.title;

        // Hide library when reading
        toggleVisibility(userLibrary, false);
        const readerContainer = document.getElementById('reader-container');
        toggleVisibility(readerContainer, true);

        // Show nav controls
        document.querySelector('.nav-controls').style.visibility = 'visible';

        // Show chapter selector
        const chapterWrapper = document.querySelector('.chapter-selector-wrapper');
        if (chapterWrapper) chapterWrapper.style.display = 'flex';

        // Auto-hide toolbar for immersive reading
        const topBar = document.getElementById('top-bar');
        topBar.classList.add('toolbar-hidden');

        // Add to library
        const book = await libraryManager.addBook(filePath, metadata);
        if (book) {
            currentBookId = book.id;

            // Check for saved progress
            const savedCfi = await libraryManager.getBookProgress(book.id);
            if (savedCfi) {
                try {
                    await reader.rendition.display(savedCfi);
                    showToast('Restored reading position', 'info');
                } catch (error) {
                    console.warn('Failed to restore position:', error);
                }
            }

            // Track page turns for progress saving
            reader.rendition.on('relocated', (location) => {
                if (saveTimeout) clearTimeout(saveTimeout);
                saveTimeout = setTimeout(async () => {
                    if (currentBookId && location && location.start) {
                        const progress = reader.book.locations ?
                            reader.book.locations.percentageFromCfi(location.start.cfi) : 0;
                        await libraryManager.updateProgress(
                            currentBookId,
                            location.start.cfi,
                            progress || 0
                        );
                    }
                }, 2000);
            });
        }

        // Populate chapter list
        const toc = await reader.getTOC();
        populateChapterList(toc);

        showToast(`Opened: ${metadata.title}`, 'success');
    } catch (error) {
        console.error('Error opening book:', error);
        showToast('Failed to open book', 'error');
    }
}

/**
 * Populate the chapter selector dropdown
 * @param {Array} toc - Table of contents
 */
function populateChapterList(toc) {
    const select = document.getElementById('chapter-select');
    if (!select) return;

    // Clear existing options
    select.innerHTML = '<option value="" disabled selected>Chapters</option>';

    if (!toc || toc.length === 0) return;

    // Helper to process items recursively
    const processItems = (items, level = 0) => {
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item.href;
            // Indent sub-chapters
            option.textContent = ' '.repeat(level * 2) + (item.label || 'Untitled');
            select.appendChild(option);

            if (item.subitems && item.subitems.length > 0) {
                processItems(item.subitems, level + 1);
            }
        });
    };

    processItems(toc);

    // Setup change listener if not already attached (safe to re-add if we check or use onclick)
    // Better to remove old listener or use a persistent one? 
    // Since init() runs once, let's attach the listener in init or here safely.
    // Actually, let's attach it ONCE in init() to avoid duplicates.
}

/**
 * Return to library view
 */
function closeBook() {
    reader.destroy();
    currentBookId = null;

    // Clear chapter list
    const select = document.getElementById('chapter-select');
    if (select) {
        select.innerHTML = '<option value="" disabled selected>Chapters</option>';
    }

    // Show library
    toggleVisibility(userLibrary, true);
    const readerContainer = document.getElementById('reader-container');
    toggleVisibility(readerContainer, false);

    // Hide nav controls in library
    document.querySelector('.nav-controls').style.visibility = 'hidden';

    // Hide chapter selector
    const chapterWrapper = document.querySelector('.chapter-selector-wrapper');
    if (chapterWrapper) chapterWrapper.style.display = 'none';

    // Reset title
    bookTitle.textContent = 'Epilogue';

    // Focus first book for keyboard navigation
    libraryManager.focusFirstBook();

    // Ensure toolbar is visible
    document.getElementById('top-bar').classList.remove('toolbar-hidden');
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Home button
    document.getElementById('home-btn').addEventListener('click', closeBook);

    // Open EPUB button
    openEpubBtn.addEventListener('click', async () => {
        if (!isTauri) {
            showToast('Tauri backend not available. Use cargo tauri dev to run the app.', 'info');
            return;
        }

        try {
            const filePath = await invoke('open_epub_dialog');
            await openBookFromFile(filePath);
        } catch (error) {
            if (error !== 'No file selected') {
                console.error('Error opening EPUB:', error);
                showToast('Failed to open EPUB file', 'error');
            }
        }
    });

    // Navigation buttons
    prevBtn.addEventListener('click', () => reader.prevPage());
    nextBtn.addEventListener('click', () => reader.nextPage());

    // Settings panel toggle
    presetBtn.addEventListener('click', () => {
        toggleVisibility(presetPanel, true);
    });

    closePresetPanel.addEventListener('click', () => {
        toggleVisibility(presetPanel, false);
    });

    setupModalClose(presetPanel, document.querySelector('.panel-content'));

    // Help overlay
    helpBtn.addEventListener('click', () => {
        toggleVisibility(shortcutOverlay, true);
    });

    closeShortcutOverlay.addEventListener('click', () => {
        toggleVisibility(shortcutOverlay, false);
    });

    setupModalClose(shortcutOverlay, document.querySelector('.shortcut-panel'));

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboard);

    // Mouse movement for toolbar auto-hide
    document.addEventListener('mousemove', handleMouseMove);
}

/**
 * Setup settings panel: tabs, font controls, save preset
 */
function setupSettingsPanel() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Update tab buttons
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update tab content
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const tabId = `tab-${btn.dataset.tab}`;
            document.getElementById(tabId)?.classList.add('active');
        });
    });

    // Mode selector
    document.querySelectorAll('.mode-option').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;

            // Update active state
            document.querySelectorAll('.mode-option').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Apply mode
            currentPrefs.readingMode = mode;
            reader.setFlow(mode);
            savePreferences();
        });
    });

    // Font family selector
    document.querySelectorAll('.font-option').forEach(btn => {
        btn.addEventListener('click', () => {
            const family = btn.dataset.font;

            // Update active state
            document.querySelectorAll('.font-option').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Apply font
            reader.setFontFamily(family);
            currentPrefs.fontFamily = family;
            savePreferences();
        });
    });

    // Font size stepper
    document.getElementById('font-size-down')?.addEventListener('click', () => {
        const newSize = Math.max(12, currentPrefs.fontSize - 2);
        currentPrefs.fontSize = newSize;
        reader.setFontSize(newSize);
        updateFontUI();
        savePreferences();
    });

    document.getElementById('font-size-up')?.addEventListener('click', () => {
        const newSize = Math.min(32, currentPrefs.fontSize + 2);
        currentPrefs.fontSize = newSize;
        reader.setFontSize(newSize);
        updateFontUI();
        savePreferences();
    });

    // ── Text Color ────────────────────────────────────
    const textColorPicker = document.getElementById('text-color-picker');
    const textColorValue = document.getElementById('text-color-value');
    textColorPicker?.addEventListener('input', (e) => {
        const color = e.target.value;
        currentPrefs.textColor = color;
        reader.setTextColor(color);
        if (textColorValue) textColorValue.textContent = color;
        savePreferences();
    });

    // ── Container Color ───────────────────────────────
    const containerColorPicker = document.getElementById('container-color-picker');
    const containerColorValue = document.getElementById('container-color-value');
    containerColorPicker?.addEventListener('input', (e) => {
        const color = e.target.value;
        currentPrefs.containerColor = color;
        reader.setBackgroundColor(color);
        if (containerColorValue) containerColorValue.textContent = color;
        savePreferences();
    });

    // ── Container Opacity ─────────────────────────────
    const opacitySlider = document.getElementById('container-opacity-slider');
    const opacityValue = document.getElementById('container-opacity-value');
    opacitySlider?.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        currentPrefs.containerOpacity = val;
        reader.setOpacity(val / 100);
        if (opacityValue) opacityValue.textContent = `${val}%`;
        savePreferences();
    });

    // ── Glassmorphism Toggle ──────────────────────────
    const glassToggle = document.getElementById('glass-toggle');
    const blurGroup = document.getElementById('glass-blur-group');
    glassToggle?.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        currentPrefs.glassmorphism = enabled;
        reader.setGlassmorphism(enabled);
        if (blurGroup) blurGroup.classList.toggle('hidden', !enabled);
        savePreferences();
    });

    // ── Glass Blur Slider ─────────────────────────────
    const blurSlider = document.getElementById('glass-blur-slider');
    const blurValue = document.getElementById('glass-blur-value');
    blurSlider?.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        currentPrefs.glassBlur = val;
        reader.setBlur(val);
        if (blurValue) blurValue.textContent = `${val}px`;
        savePreferences();
    });

    // ── Background Media ─────────────────────────────
    const bgPickBtn = document.getElementById('bg-media-pick');
    const bgClearBtn = document.getElementById('bg-media-clear');
    const bgMediaInfo = document.getElementById('bg-media-info');
    const bgFilename = document.getElementById('bg-media-filename');

    // ── Scrollbar Colors ─────────────────────────────
    const trackPicker = document.getElementById('scrollbar-track-picker');
    const thumbPicker = document.getElementById('scrollbar-thumb-picker');

    trackPicker?.addEventListener('input', (e) => {
        currentPrefs.scrollbarTrack = e.target.value;
        reader.setScrollbarColors(e.target.value, undefined);
        savePreferences();
    });

    thumbPicker?.addEventListener('input', (e) => {
        currentPrefs.scrollbarThumb = e.target.value;
        reader.setScrollbarColors(undefined, e.target.value);
        savePreferences();
    });

    // ── Chapter Navigation ───────────────────────────
    const chapterSelect = document.getElementById('chapter-select');
    chapterSelect?.addEventListener('change', (e) => {
        const target = e.target.value;
        if (target) {
            reader.display(target);
            // Optional: reset selection back to 'Chapters' or keep it? 
            // Keeping it shows where you are potentially, but sync is hard. 
            // Let's keep it for now.

            // Refocus reader to allow immediate keyboard nav
            document.getElementById('reader-container')?.focus();
        }
    });

    bgPickBtn?.addEventListener('click', async () => {
        if (!isTauri) return;
        try {
            const filePath = await invoke('open_media_dialog');
            if (filePath) {
                bgManager.setMedia(filePath);
                currentPrefs.bgMediaPath = filePath;
                savePreferences();

                // Show filename
                const name = filePath.split(/[\\/]/).pop();
                if (bgFilename) bgFilename.textContent = name;
                if (bgMediaInfo) bgMediaInfo.classList.remove('hidden');

                // Show audio toggle for video files
                const bgAudioGroup = document.getElementById('bg-audio-group');
                const ext = filePath.split('.').pop().toLowerCase();
                const isVideo = ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext);
                if (bgAudioGroup) bgAudioGroup.classList.toggle('hidden', !isVideo);
                if (isVideo) {
                    const bgAudioToggle = document.getElementById('bg-audio-toggle');
                    if (bgAudioToggle) bgAudioToggle.checked = !(currentPrefs.bgAudioMuted ?? true);
                }
            }
        } catch (error) {
            if (error !== 'No file selected') {
                console.error('Error selecting media:', error);
            }
        }
    });

    bgClearBtn?.addEventListener('click', () => {
        bgManager.clearMedia();
        currentPrefs.bgMediaPath = null;
        savePreferences();
        if (bgMediaInfo) bgMediaInfo.classList.add('hidden');
        // Hide audio toggle when no video
        const bgAudioGroup = document.getElementById('bg-audio-group');
        if (bgAudioGroup) bgAudioGroup.classList.add('hidden');
    });

    // Background audio mute toggle
    const bgAudioToggle = document.getElementById('bg-audio-toggle');
    const bgAudioGroup = document.getElementById('bg-audio-group');
    bgAudioToggle?.addEventListener('change', (e) => {
        const audioOn = e.target.checked;
        currentPrefs.bgAudioMuted = !audioOn;
        bgManager.setMuted(!audioOn);
        savePreferences();
    });

    // ── Background Music ─────────────────────────────
    const bgMusicPickBtn = document.getElementById('bg-music-pick');
    const bgMusicClearBtn = document.getElementById('bg-music-clear');
    const bgMusicInfo = document.getElementById('bg-music-info');
    const bgMusicFilename = document.getElementById('bg-music-filename');
    const bgMusicControls = document.getElementById('bg-music-controls');
    const bgMusicToggle = document.getElementById('bg-music-toggle');
    const bgMusicVolumeSlider = document.getElementById('bg-music-volume');
    const bgMusicVolumeValue = document.getElementById('bg-music-volume-value');

    bgMusicPickBtn?.addEventListener('click', async () => {
        if (!isTauri) return;
        try {
            const filePath = await invoke('open_audio_dialog');
            if (filePath) {
                bgManager.setMusicVolume(currentPrefs.bgMusicVolume ?? 50);
                bgManager.setMusic(filePath);
                bgManager.setMusicMuted(currentPrefs.bgMusicMuted ?? true);
                currentPrefs.bgMusicPath = filePath;
                savePreferences();

                const name = filePath.split(/[\\/]/).pop();
                if (bgMusicFilename) bgMusicFilename.textContent = name;
                if (bgMusicInfo) bgMusicInfo.classList.remove('hidden');
                if (bgMusicControls) bgMusicControls.classList.remove('hidden');

                if (bgMusicToggle) bgMusicToggle.checked = !(currentPrefs.bgMusicMuted ?? true);
                if (bgMusicVolumeSlider) bgMusicVolumeSlider.value = currentPrefs.bgMusicVolume ?? 50;
                if (bgMusicVolumeValue) bgMusicVolumeValue.textContent = `${currentPrefs.bgMusicVolume ?? 50}%`;
            }
        } catch (error) {
            if (error !== 'No file selected') {
                console.error('Error selecting audio:', error);
            }
        }
    });

    bgMusicClearBtn?.addEventListener('click', () => {
        bgManager.clearMusic();
        currentPrefs.bgMusicPath = null;
        savePreferences();
        if (bgMusicInfo) bgMusicInfo.classList.add('hidden');
        if (bgMusicControls) bgMusicControls.classList.add('hidden');
    });

    bgMusicToggle?.addEventListener('change', (e) => {
        const musicOn = e.target.checked;
        currentPrefs.bgMusicMuted = !musicOn;
        bgManager.setMusicMuted(!musicOn);
        savePreferences();
    });

    bgMusicVolumeSlider?.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        currentPrefs.bgMusicVolume = val;
        bgManager.setMusicVolume(val);
        if (bgMusicVolumeValue) bgMusicVolumeValue.textContent = `${val}%`;
        savePreferences();
    });

    // Save preset dialog
    const saveBtn = document.getElementById('save-preset-btn');
    const saveDialog = document.getElementById('save-preset-dialog');
    const saveNameInput = document.getElementById('save-preset-name');
    const saveConfirm = document.getElementById('save-preset-confirm');
    const saveCancel = document.getElementById('save-preset-cancel');

    saveBtn?.addEventListener('click', () => {
        toggleVisibility(saveDialog, true);
        saveNameInput?.focus();
    });

    saveCancel?.addEventListener('click', () => {
        toggleVisibility(saveDialog, false);
        if (saveNameInput) saveNameInput.value = '';
    });

    saveConfirm?.addEventListener('click', async () => {
        const name = saveNameInput?.value.trim();
        if (!name) {
            showToast('Please enter a preset name', 'error');
            return;
        }

        const saved = await presetManager.saveCurrentAsPreset(name, currentPrefs);
        if (saved) {
            // Re-render preset list with new preset
            renderPresetList(presetManager.getPresets());
            toggleVisibility(saveDialog, false);
            if (saveNameInput) saveNameInput.value = '';
        }
    });

    // Enter key in name input triggers save
    saveNameInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveConfirm?.click();
        }
    });
}

/**
 * Update font UI to reflect current settings
 */
function updateFontUI() {
    // Update font size display
    const sizeValue = document.getElementById('font-size-value');
    if (sizeValue) {
        sizeValue.textContent = `${currentPrefs.fontSize}px`;
    }

    // Update font family active state
    document.querySelectorAll('.font-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.font === currentPrefs.fontFamily);
    });
}

/**
 * Update reading mode UI
 */
function updateModeUI() {
    document.querySelectorAll('.mode-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === (currentPrefs.readingMode || 'paginated'));
    });
}

/**
 * Update appearance UI to reflect current settings
 */
function updateAppearanceUI() {
    const textColorPicker = document.getElementById('text-color-picker');
    const textColorValue = document.getElementById('text-color-value');
    if (textColorPicker) textColorPicker.value = currentPrefs.textColor || '#1a1a1a';
    if (textColorValue) textColorValue.textContent = currentPrefs.textColor || '#1a1a1a';

    const containerColorPicker = document.getElementById('container-color-picker');
    const containerColorValue = document.getElementById('container-color-value');
    if (containerColorPicker) containerColorPicker.value = currentPrefs.containerColor || '#FFFFFF';
    if (containerColorValue) containerColorValue.textContent = currentPrefs.containerColor || '#FFFFFF';

    const opacitySlider = document.getElementById('container-opacity-slider');
    const opacityValue = document.getElementById('container-opacity-value');
    const opacity = currentPrefs.containerOpacity ?? 95;
    if (opacitySlider) opacitySlider.value = opacity;
    if (opacityValue) opacityValue.textContent = `${opacity}%`;

    const glassToggle = document.getElementById('glass-toggle');
    const blurGroup = document.getElementById('glass-blur-group');
    if (glassToggle) glassToggle.checked = currentPrefs.glassmorphism || false;
    if (blurGroup) blurGroup.classList.toggle('hidden', !currentPrefs.glassmorphism);

    const blurSlider = document.getElementById('glass-blur-slider');
    const blurValue = document.getElementById('glass-blur-value');
    const blur = currentPrefs.glassBlur ?? 12;
    if (blurSlider) blurSlider.value = blur;
    if (blurValue) blurValue.textContent = `${blur}px`;

    const trackPicker = document.getElementById('scrollbar-track-picker');
    const thumbPicker = document.getElementById('scrollbar-thumb-picker');
    if (trackPicker) trackPicker.value = currentPrefs.scrollbarTrack || '#1a1a1a';
    if (thumbPicker) thumbPicker.value = currentPrefs.scrollbarThumb || '#4a9eff';
}

/**
 * Save current preferences to backend
 */
async function savePreferences() {
    if (!isTauri) return;
    try {
        await invoke('set_preferences', { prefs: currentPrefs });
    } catch (error) {
        console.error('Failed to save preferences:', error);
    }
}

/**
 * Handle keyboard shortcuts
 */
function handleKeyboard(e) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

    // Global shortcuts
    if (cmdOrCtrl && e.key === 'o') {
        e.preventDefault();
        openEpubBtn.click();
        return;
    }

    if (cmdOrCtrl && e.key === 'p') {
        e.preventDefault();
        toggleVisibility(presetPanel, true);
        return;
    }

    if (cmdOrCtrl && e.key === 't') {
        e.preventDefault();
        toggleToolbar();
        return;
    }

    if (e.key === '?') {
        e.preventDefault();
        toggleVisibility(shortcutOverlay);
        return;
    }

    // Handle Escape globally to close modals
    if (e.key === 'Escape') {
        e.preventDefault();

        // Priority 1: Close Shortcut Overlay
        if (!shortcutOverlay.classList.contains('hidden')) {
            toggleVisibility(shortcutOverlay, false);
            return;
        }

        // Priority 2: Close Settings Panel
        if (!presetPanel.classList.contains('hidden')) {
            // Check if save dialog is open inside settings?
            const saveDialog = document.getElementById('save-preset-dialog');
            if (saveDialog && !saveDialog.classList.contains('hidden')) {
                toggleVisibility(saveDialog, false);
                return;
            }
            toggleVisibility(presetPanel, false);
            return;
        }

        // Priority 3: Close Book (if not in modal)
        // Only if we are NOT in some other modal (already checked above)
        // and if a book is actually open? closeBook() handles that (clears reader).

        // However, we need to ensure we don't trigger closeBook if we just closed a modal? 
        // The return statements above handle that.

        // Also check if we are in library view? closeBook handles it idempotently?
        // closeBook() shows library. If already in library, it just resets title.
        closeBook();
        return;
    }

    // Reader shortcuts (when not in modal)
    const inModal = !presetPanel.classList.contains('hidden') ||
        !shortcutOverlay.classList.contains('hidden');

    if (inModal) return;

    switch (e.key) {
        case 'ArrowRight':
        case 'l':
            reader.nextPage();
            break;
        case 'ArrowLeft':
        case 'h':
            reader.prevPage();
            break;
        case 'f':
            e.preventDefault();
            toggleFullscreen();
            break;
    }
}

/**
 * Toggle Fullscreen (Tauri Window API)
 */
async function toggleFullscreen() {
    try {
        if (isTauri && appWindow) {
            const isFull = await appWindow.isFullscreen();
            await appWindow.setFullscreen(!isFull);
        } else {
            // Fallback for browser
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        }
    } catch (error) {
        console.error('Error toggling fullscreen:', error);
    }
}

/**
 * Toggle toolbar visibility
 */
function toggleToolbar() {
    const topBar = document.getElementById('top-bar');
    topBar.classList.toggle('toolbar-hidden');

    // Adjust reader container top margin or just let it expand? 
    // Since #top-bar is becoming absolute when hidden, the flex container below might shift up.
    // If we want smooth transition of content area, we might need JS intervention or different CSS.
    // But per previous plan, let's keep it simple first.
}

/**
 * Handle mouse movement to auto-show/hide toolbar
 */
function handleMouseMove(e) {
    // If panel or overlay is open, keep toolbar visible (optional)
    const inModal = !presetPanel.classList.contains('hidden') ||
        !shortcutOverlay.classList.contains('hidden');

    if (inModal) return;

    const topBar = document.getElementById('top-bar');
    const chapterSelect = document.getElementById('chapter-select');

    // If chapter selector is focused (open), keep toolbar visible
    if (document.activeElement === chapterSelect) {
        topBar.classList.remove('toolbar-hidden');
        return;
    }

    // If in library mode (library container visible), ensure toolbar is visible and do nothing else
    if (!userLibrary.classList.contains('hidden')) {
        topBar.classList.remove('toolbar-hidden');
        return;
    }

    const mouseY = e.clientY;

    if (mouseY < 80) {
        topBar.classList.remove('toolbar-hidden');
    } else {
        if (!topBar.classList.contains('toolbar-hidden')) {
            topBar.classList.add('toolbar-hidden');
        }
    }
}

// Auto-save current settings as _last_session on close
window.addEventListener('beforeunload', () => {
    presetManager.saveLastSession(currentPrefs);
});

// Start the application
init();
