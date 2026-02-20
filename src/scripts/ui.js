/**
 * UI Helper Functions
 * Toast notifications and modal utilities
 */

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {string} type - 'success', 'error', or 'info'
 */
export function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    const container = document.getElementById('toast-container');
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Toggle visibility of an element
 * @param {HTMLElement} element - Element to toggle
 * @param {boolean} show - Optional force show/hide
 */
export function toggleVisibility(element, show = null) {
    if (show === null) {
        element.classList.toggle('hidden');
    } else {
        element.classList.toggle('hidden', !show);
    }
}

/**
 * Close modal when clicking outside
 * @param {HTMLElement} modal - Modal element
 * @param {HTMLElement} content - Content element inside modal
 */
export function setupModalClose(modal, content) {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            toggleVisibility(modal, false);
        }
    });
}
