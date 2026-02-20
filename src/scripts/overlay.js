/**
 * OverlayManager
 * Manages color tint overlay layer
 */
export class OverlayManager {
    constructor() {
        this.overlay = document.getElementById('overlay-layer');
        this.currentColor = null;
        this.currentOpacity = 0;
    }

    /**
     * Set color tint overlay
     * @param {string} color - Hex color code
     * @param {number} opacity - Opacity value (0-1)
     */
    setTint(color, opacity) {
        if (!color) {
            this.clearTint();
            return;
        }

        opacity = Math.max(0, Math.min(1, opacity));
        const rgba = this.hexToRgba(color, opacity);

        this.overlay.style.background = rgba;
        this.currentColor = color;
        this.currentOpacity = opacity;
    }

    /**
     * Clear overlay tint
     */
    clearTint() {
        this.overlay.style.background = 'transparent';
        this.currentColor = null;
        this.currentOpacity = 0;
    }

    /**
     * Convert hex color to rgba
     * @param {string} hex - Hex color code
     * @param {number} opacity - Opacity value
     * @returns {string} RGBA color string
     */
    hexToRgba(hex, opacity) {
        hex = hex.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    /**
     * Get current overlay settings
     * @returns {object}
     */
    getCurrentTint() {
        return {
            color: this.currentColor,
            opacity: this.currentOpacity
        };
    }
}
