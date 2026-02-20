/**
 * LibraryManager
 * Manages book library, persistence, and recent files
 */
import { showToast } from './ui.js';

// Tauri API - dynamic import with fallback
let invoke;
let convertFileSrc;
let isTauri = false;

try {
    const tauriCore = await import('@tauri-apps/api/core');
    invoke = tauriCore.invoke;
    convertFileSrc = tauriCore.convertFileSrc;
    isTauri = true;
} catch (e) {
    // Running in browser mode
}

export class LibraryManager {
    constructor(reader) {
        this.reader = reader;
        this.recentBooks = [];
        this.container = document.getElementById('recent-books-container');
        this.grid = document.getElementById('recent-books-grid');
        this._setupKeyboardNav();
    }

    /**
     * Initialize library
     */
    async init() {
        if (!isTauri) return;
        await this.loadRecentBooks();
        this.renderRecentBooks();
    }

    /**
     * Load recent books from backend
     */
    async loadRecentBooks() {
        try {
            this.recentBooks = await invoke('get_recent_books', { limit: 10 });
        } catch (error) {
            console.error('Failed to load recent books:', error);
            this.recentBooks = [];
        }
    }

    /**
     * Add book to library
     * @param {string} filePath - Path to EPUB file
     * @param {object} metadata - Book metadata (title, author)
     * @returns {Promise<object>} Book entry
     */
    async addBook(filePath, metadata) {
        if (!isTauri) return null;

        try {
            const book = await invoke('add_book', {
                title: metadata.title,
                author: metadata.author,
                path: filePath,
                cover: metadata.coverUrl
            });

            // Refresh recent list
            await this.loadRecentBooks();
            this.renderRecentBooks();

            return book;
        } catch (error) {
            console.error('Failed to add book to library:', error);
            return null;
        }
    }

    /**
     * Update reading progress
     * @param {string} bookId - Book ID
     * @param {string} cfi - Current location CFI
     * @param {number} percentage - Progress percentage (0-1)
     */
    async updateProgress(bookId, cfi, percentage) {
        if (!isTauri || !bookId) return;

        try {
            await invoke('update_progress', {
                bookId: bookId,
                progress: percentage,
                cfi: cfi
            });
        } catch (error) {
            console.error('Failed to update progress:', error);
        }
    }

    /**
     * Get saved progress for a book
     * @param {string} bookId - Book ID
     * @returns {Promise<string|null>} Saved CFI
     */
    async getBookProgress(bookId) {
        if (!isTauri) return null;

        try {
            return await invoke('get_book_progress', { bookId });
        } catch (error) {
            console.error('Failed to get progress:', error);
            return null;
        }
    }

    /**
     * Remove a book from the library
     * @param {string} bookId - Book ID to remove
     */
    async removeBook(bookId) {
        if (!isTauri) return;

        try {
            await invoke('remove_book', { bookId });
            showToast('Book removed from library');

            // Refresh the grid
            await this.loadRecentBooks();
            this.renderRecentBooks();
        } catch (error) {
            console.error('Failed to remove book:', error);
            showToast('Failed to remove book', 'error');
        }
    }

    /**
     * Render recent books grid
     */
    renderRecentBooks() {
        if (!this.container || !this.grid) return;

        const header = this.container.querySelector('h2');

        if (this.recentBooks.length === 0) {
            // Empty state
            if (header) header.textContent = 'Get Started';

            this.grid.innerHTML = '';
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-library-message';
            emptyState.innerHTML = `
                <div class="empty-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
                    </svg>
                </div>
                <h3>Open an EPUB to begin</h3>
                <p>Drag and drop files here or click the Open button in the toolbar</p>
                <button id="empty-open-btn" class="action-btn primary">Open File</button>
            `;

            // Center the message
            emptyState.style.gridColumn = '1 / -1';
            emptyState.style.display = 'flex';
            emptyState.style.flexDirection = 'column';
            emptyState.style.alignItems = 'center';
            emptyState.style.justifyContent = 'center';
            emptyState.style.textAlign = 'center';
            emptyState.style.color = 'var(--text-secondary)';
            emptyState.style.padding = '4rem 2rem';
            emptyState.style.gap = '1rem';

            this.grid.appendChild(emptyState);

            // Wire up the button in empty state
            const btn = emptyState.querySelector('#empty-open-btn');
            if (btn && isTauri && invoke) {
                btn.onclick = async () => {
                    await invoke('open_epub_dialog');
                };
            }
            return;
        }

        // Has books
        if (header) header.textContent = 'Continue Reading';

        this.grid.innerHTML = '';

        this.recentBooks.forEach(book => {
            const item = document.createElement('div');
            item.className = 'book-card';
            item.tabIndex = 0;

            // Cover
            const coverDiv = document.createElement('div');
            coverDiv.className = 'book-cover';

            if (book.coverPath && isTauri && convertFileSrc) {
                const src = convertFileSrc(book.coverPath);
                const img = document.createElement('img');
                img.className = 'book-cover-img';
                img.alt = book.title;
                img.src = src;
                // Fallback to placeholder on load error
                img.onerror = () => {
                    console.warn('Cover failed to load:', book.coverPath, src);
                    img.remove();
                    this.renderPlaceholder(coverDiv, book);
                };
                coverDiv.appendChild(img);
            } else {
                this.renderPlaceholder(coverDiv, book);
            }

            // Metadata
            const infoDiv = document.createElement('div');
            infoDiv.className = 'book-info';

            const title = document.createElement('h4');
            title.className = 'book-title';
            title.textContent = book.title;
            title.title = book.title;

            const author = document.createElement('p');
            author.className = 'book-author';
            author.textContent = book.author;

            const progress = document.createElement('div');
            progress.className = 'book-progress-bar';
            const progressFill = document.createElement('div');
            progressFill.className = 'book-progress-fill';
            progressFill.style.width = `${Math.round(book.progress * 100)}%`;
            progress.appendChild(progressFill);

            infoDiv.appendChild(title);
            infoDiv.appendChild(author);
            infoDiv.appendChild(progress);

            item.appendChild(coverDiv);
            item.appendChild(infoDiv);

            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'book-delete-btn';
            deleteBtn.title = 'Remove from library';
            deleteBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            `;
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeBook(book.id);
            });
            item.appendChild(deleteBtn);

            // Click handler -> Open book
            item.addEventListener('click', () => {
                const event = new CustomEvent('open-recent-book', {
                    detail: { path: book.filePath }
                });
                document.dispatchEvent(event);
            });

            this.grid.appendChild(item);
        });
    }

    /**
     * Render placeholder cover for books without cover images
     */
    renderPlaceholder(coverDiv, book) {
        coverDiv.className = 'book-cover book-cover-placeholder';
        const hue = book.title.length * 10 % 360;
        coverDiv.style.background = `linear-gradient(135deg, hsl(${hue}, 40%, 30%), hsl(${hue}, 40%, 15%))`;

        const titleInitial = document.createElement('span');
        titleInitial.className = 'book-initial';
        titleInitial.textContent = book.title.charAt(0).toUpperCase();
        coverDiv.appendChild(titleInitial);
    }

    /**
     * Focus the first book card in the grid.
     * Call this when switching to the library view.
     */
    focusFirstBook() {
        const first = this.grid?.querySelector('.book-card');
        if (first) first.focus();
    }

    /**
     * Setup keyboard navigation for the book grid.
     * Arrow keys move between cards, Enter opens the focused card.
     * @private
     */
    _setupKeyboardNav() {
        document.addEventListener('keydown', (e) => {
            // Only handle when library is visible
            if (!this.container || this.container.classList.contains('hidden')) return;

            const cards = Array.from(this.grid?.querySelectorAll('.book-card') || []);
            if (cards.length === 0) return;

            const focused = document.activeElement;
            const idx = cards.indexOf(focused);

            // If no card is focused and an arrow key is pressed, focus first card
            if (idx === -1) {
                if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                    e.preventDefault();
                    cards[0].focus();
                }
                return;
            }

            // Calculate columns in the grid for up/down navigation
            const gridStyle = window.getComputedStyle(this.grid);
            const cols = gridStyle.gridTemplateColumns.split(' ').length;

            let nextIdx = idx;

            switch (e.key) {
                case 'ArrowRight':
                    e.preventDefault();
                    nextIdx = Math.min(idx + 1, cards.length - 1);
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    nextIdx = Math.max(idx - 1, 0);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    nextIdx = Math.min(idx + cols, cards.length - 1);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    nextIdx = Math.max(idx - cols, 0);
                    break;
                case 'Enter':
                    e.preventDefault();
                    focused.click();
                    return;
                default:
                    return;
            }

            cards[nextIdx].focus();
        });
    }
}
