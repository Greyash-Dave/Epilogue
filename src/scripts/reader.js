/**
 * EpubReader
 * Wrapper around epub.js for managing EPUB reading
 */
import ePub from 'epubjs';

export class EpubReader {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.book = null;
        this.rendition = null;
        this.opacity = 0.95;
        this.backgroundColor = '#FFFFFF';
        this.textColor = '#1a1a1a';
        this.glassmorphism = false;
        this.blur = 12;
        this.scrollbarTrack = 'transparent';
        this.scrollbarThumb = 'rgba(255, 255, 255, 0.25)';
        this.metadata = null;
        this.fontFamily = 'serif';
        this.fontSize = 18;
        this.flow = 'paginated';
    }

    /**
     * Set reading flow mode
     * @param {string} flow - 'paginated' or 'scrolled'
     */
    async setFlow(flow) {
        this.flow = flow;
        if (this.book && this.rendition) {
            const location = this.rendition.currentLocation()?.start?.cfi;
            this.rendition.destroy();

            this.rendition = this.book.renderTo(this.container, this._getRenderOptions());
            this._applyIframeStyles();
            this._applyContainerMode();

            // Re-apply styles
            this.setFontFamily(this.fontFamily);
            this.setFontSize(this.fontSize);
            this.setTextColor(this.textColor);
            this.updateContainerStyle();

            await this.rendition.display(location);
        }
    }

    /**
     * Open an EPUB book from array buffer
     * @param {ArrayBuffer} arrayBuffer - EPUB file data
     * @returns {Promise<object>} Book metadata
     */
    async openBook(arrayBuffer) {
        // Clean up existing book if any
        this.destroy();

        this.book = ePub(arrayBuffer);

        // Extract metadata
        this.metadata = await this.book.loaded.metadata;
        let coverUrl = null;

        try {
            coverUrl = await this.book.coverUrl();
        } catch (e) {
            console.warn('Could not extract cover:', e);
        }

        // Render the book with current mode options
        this.rendition = this.book.renderTo(this.container, this._getRenderOptions());
        this._applyIframeStyles();
        this._applyContainerMode();

        // Apply reading styles
        this.setTextColor(this.textColor);

        await this.rendition.display();

        // Remove empty placeholder class
        this.container.classList.remove('empty');

        return {
            title: this.metadata.title || 'Unknown',
            author: this.metadata.creator || 'Unknown',
            coverUrl: coverUrl
        };
    }

    /**
     * Navigate to next page
     */
    nextPage() {
        if (this.rendition) {
            this.rendition.next();
        }
    }

    /**
     * Navigate to previous page
     */
    prevPage() {
        if (this.rendition) {
            this.rendition.prev();
        }
    }

    /**
     * Get the Table of Contents
     * @returns {Promise<Array>} List of navigation items
     */
    async getTOC() {
        if (!this.book) return [];
        const nav = await this.book.loaded.navigation;
        return nav.toc;
    }

    /**
     * Navigate to specific href or CFI
     * @param {string} target
     */
    display(target) {
        if (this.rendition) {
            this.rendition.display(target);
        }
    }

    /**
     * Set reader container opacity
     * @param {number} opacity - Opacity value (0-1.0)
     */
    setOpacity(opacity) {
        this.opacity = Math.max(0, Math.min(1, opacity));
        this.updateContainerStyle();
    }

    /**
     * Set reader background color
     * @param {string} color - Hex color code
     */
    setBackgroundColor(color) {
        this.backgroundColor = color;
        this.updateContainerStyle();
    }

    /**
     * Set text color inside the reader
     * @param {string} color - Hex color code
     */
    setTextColor(color) {
        this.textColor = color;
        if (this.rendition) {
            this.rendition.themes.override('color', color);
        }
    }

    /**
     * Enable/disable glassmorphism effect
     * @param {boolean} enabled
     */
    setGlassmorphism(enabled) {
        this.glassmorphism = enabled;
        this.updateContainerStyle();
    }

    /**
     * Set glassmorphism blur amount
     * @param {number} px - Blur in pixels (0-40)
     */
    setBlur(px) {
        this.blur = Math.max(0, Math.min(40, px));
        this.updateContainerStyle();
    }

    /**
     * Set scrollbar colors
     * @param {string} track - CSS color for scrollbar track
     * @param {string} thumb - CSS color for scrollbar thumb
     */
    setScrollbarColors(track, thumb) {
        if (track !== undefined) this.scrollbarTrack = track;
        if (thumb !== undefined) this.scrollbarThumb = thumb;

        // Apply globally so library and other views get it too
        document.documentElement.style.setProperty('--scrollbar-track', this.scrollbarTrack);
        document.documentElement.style.setProperty('--scrollbar-thumb', this.scrollbarThumb);
        // Add a slightly lighter/more opaque hover state
        let hoverThumb = this.scrollbarThumb;
        if (hoverThumb.startsWith('#') && hoverThumb.length === 7) {
            hoverThumb += 'dd'; // Hex transparency
        }
        document.documentElement.style.setProperty('--active-scrollbar-thumb', hoverThumb);

        // Update iframe styles if active
        if (this.rendition) {
            this._applyIframeStyles();
        }
    }

    /**
     * Set reading font family
     * @param {string} family - 'serif', 'sans-serif', or 'monospace'
     */
    setFontFamily(family) {
        const familyMap = {
            'serif': "Georgia, 'Times New Roman', serif",
            'sans-serif': "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            'monospace': "'Courier New', Consolas, monospace"
        };
        this.fontFamily = family;
        if (this.rendition) {
            this.rendition.themes.override('font-family', familyMap[family] || familyMap['serif']);
        }
    }

    /**
     * Set reading font size
     * @param {number} size - Font size in pixels (12-32)
     */
    setFontSize(size) {
        this.fontSize = Math.max(12, Math.min(32, size));
        if (this.rendition) {
            this.rendition.themes.fontSize(`${this.fontSize}px`);
        }
    }

    /**
     * Update container visual style (background, glassmorphism)
     */
    updateContainerStyle() {
        const hex = this.backgroundColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        this.container.style.background = `rgba(${r}, ${g}, ${b}, ${this.opacity})`;

        if (this.glassmorphism) {
            this.container.classList.add('glass');
            this.container.style.backdropFilter = `blur(${this.blur}px)`;
            this.container.style.webkitBackdropFilter = `blur(${this.blur}px)`;
        } else {
            this.container.classList.remove('glass');
            this.container.style.backdropFilter = 'none';
            this.container.style.webkitBackdropFilter = 'none';
        }
    }

    /**
     * Get current reading location
     * @returns {object|null}
     */
    getCurrentLocation() {
        if (this.rendition) {
            return this.rendition.currentLocation();
        }
        return null;
    }

    // ─── Private helpers ──────────────────────────────────────

    /**
     * Build epub.js render options based on current flow mode.
     *
     * Both modes use 'paginated' flow (CSS-column layout).
     *   - Paged   → default manager (click-to-turn, one section at a time)
     *   - Scrolled → default manager, same layout — we just let the outer
     *                container scroll freely (handled via CSS class).
     * @private
     */
    _getRenderOptions() {
        const opts = {
            width: '100%',
            height: '100%',
            spread: 'none'
        };

        if (this.flow === 'scrolled') {
            opts.flow = 'scrolled-doc';
            opts.manager = 'default';
        } else {
            opts.flow = 'paginated';
        }

        return opts;
    }

    /**
     * Inject CSS into the iframe body to ensure no internal scrollbars
     * and constrain images/SVGs to the container width.
     * @private
     */
    _applyIframeStyles() {
        if (!this.rendition) return;

        const styles = {
            "img": { "max-width": "100% !important", "height": "auto !important" },
            "svg": { "max-width": "100% !important", "height": "auto !important" },
            "table": { "max-width": "100% !important" },
            "pre": { "max-width": "100% !important", "white-space": "pre-wrap !important", "word-wrap": "break-word !important" }
        };

        if (this.flow === 'scrolled') {
            // Vertical scroll: force all content within container width
            styles.html = {
                "overflow-x": "hidden !important",
                "width": "100% !important",
                "max-width": "100% !important"
            };
            styles.body = {
                "overflow-x": "hidden !important",
                "width": "100% !important",
                "max-width": "100% !important",
                "box-sizing": "border-box !important",
                "word-wrap": "break-word !important",
                "overflow-wrap": "break-word !important"
            };
            styles["*"] = {
                "max-width": "100% !important",
                "box-sizing": "border-box !important"
            };

            // Inject scrollbar styles into iframe for internal scrolling
            styles["::-webkit-scrollbar"] = {
                "width": "8px",
                "height": "8px"
            };
            styles["::-webkit-scrollbar-track"] = {
                "background": this.scrollbarTrack || "transparent"
            };
            styles["::-webkit-scrollbar-thumb"] = {
                "background": this.scrollbarThumb || "#ccc",
                "border-radius": "4px"
            };
            styles["::-webkit-scrollbar-thumb:hover"] = {
                "background": this.scrollbarThumb ? this.scrollbarThumb + 'dd' : "#aaa" // slightly transparent on hover or fallback
            };
        } else {
            // Paged: hide all overflow (no scrollbars)
            styles.body = { "overflow": "hidden !important" };
        }

        this.rendition.themes.default(styles);
    }

    /**
     * Toggle CSS class on #reader-container for mode-specific overflow.
     * Paged mode  → overflow: hidden (epub.js manages page turns internally)
     * Scroll mode → overflow-x: auto, overflow-y: hidden (free horizontal scroll)
     * @private
     */
    _applyContainerMode() {
        if (this.flow === 'scrolled') {
            this.container.classList.add('scroll-mode');
            this.container.classList.remove('paged-mode');
        } else {
            this.container.classList.add('paged-mode');
            this.container.classList.remove('scroll-mode');
        }
    }

    /**
     * Clean up book resources
     */
    destroy() {
        if (this.rendition) {
            this.rendition.destroy();
            this.rendition = null;
        }
        if (this.book) {
            this.book.destroy();
            this.book = null;
        }
        this.container.classList.add('empty');
        this.container.classList.remove('scroll-mode', 'paged-mode');
    }
}
