use chrono::{DateTime, Utc};
/**
 * Library management and persistence
 */
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Book {
    pub id: String,
    pub title: String,
    pub author: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
    #[serde(rename = "coverPath")]
    pub cover_path: Option<String>,
    #[serde(rename = "lastOpened")]
    pub last_opened: DateTime<Utc>,
    pub progress: f32,
    pub cfi: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct Library {
    pub books: Vec<Book>,
}

/// Add a book to the library
#[tauri::command]
pub fn add_book(
    title: String,
    author: String,
    path: String,
    _cover: Option<String>,
) -> Result<Book, String> {
    let home_dir =
        dirs::home_dir().ok_or_else(|| "Could not determine home directory".to_string())?;

    let app_dir = home_dir.join(".epub-reader");
    let library_path = app_dir.join("library.json");
    let covers_dir = app_dir.join("covers");

    // Ensure covers directory exists
    if !covers_dir.exists() {
        fs::create_dir_all(&covers_dir)
            .map_err(|e| format!("Failed to create covers directory: {}", e))?;
    }

    // Create unique ID from path hash
    let id = format!("{:x}", md5::compute(path.as_bytes()));

    // Attempt to extract cover image from EPUB
    let mut cover_path: Option<String> = None;
    match epub::doc::EpubDoc::new(&path) {
        Ok(mut doc) => {
            eprintln!("Opened EPUB for cover extraction: {}", path);
            
            let mut cover_data: Option<(Vec<u8>, String)> = None;
            
            // Strategy 1: get_cover() (uses <meta name="cover"> tag)
            if let Some((data, mime)) = doc.get_cover() {
                eprintln!("Strategy 1 - get_cover() succeeded, mime: {}, size: {} bytes", mime, data.len());
                cover_data = Some((data, mime));
            } else {
                eprintln!("Strategy 1 - get_cover() returned None");
            }
            
            // Strategy 2: get_cover_id() then get_resource()
            if cover_data.is_none() {
                if let Some(cover_id) = doc.get_cover_id() {
                    eprintln!("Strategy 2 - get_cover_id() returned: '{}'", cover_id);
                    if let Some((data, mime)) = doc.get_resource(&cover_id) {
                        eprintln!("Strategy 2 - get_resource('{}') succeeded, mime: {}, size: {}", cover_id, mime, data.len());
                        cover_data = Some((data, mime));
                    }
                } else {
                    eprintln!("Strategy 2 - get_cover_id() returned None");
                }
            }
            
            // Strategy 3: Try common cover resource IDs
            if cover_data.is_none() {
                let common_ids = ["cover-image", "cover", "Cover", "CoverImage", "coverimage"];
                for cid in &common_ids {
                    if let Some((data, mime)) = doc.get_resource(cid) {
                        eprintln!("Strategy 3 - Found cover with id '{}', mime: {}, size: {}", cid, mime, data.len());
                        cover_data = Some((data, mime));
                        break;
                    }
                }
            }
            
            // Strategy 4: Scan all resources for first image
            if cover_data.is_none() {
                eprintln!("Strategy 4 - Scanning all resources for images...");
                let resource_ids: Vec<String> = doc.resources.keys().cloned().collect();
                for rid in &resource_ids {
                    if let Some(mime) = doc.get_resource_mime(rid) {
                        if mime.starts_with("image/") {
                            eprintln!("Strategy 4 - Found image resource '{}', mime: {}", rid, mime);
                            if let Some((data, mime)) = doc.get_resource(rid) {
                                cover_data = Some((data, mime));
                                break;
                            }
                        }
                    }
                }
            }
            
            // Save cover if we found one
            if let Some((data, mime)) = cover_data {
                let ext = match mime.as_str() {
                    "image/jpeg" => "jpg",
                    "image/png" => "png",
                    "image/gif" => "gif",
                    "image/webp" => "webp",
                    _ => "jpg", // Default fallback
                };
                
                let cover_filename = format!("{}.{}", id, ext);
                let cover_file_path = covers_dir.join(&cover_filename);
                
                match fs::write(&cover_file_path, &data) {
                    Ok(_) => {
                        eprintln!("Cover saved: {}", cover_file_path.display());
                        cover_path = Some(cover_file_path.to_string_lossy().to_string());
                    }
                    Err(e) => {
                        eprintln!("Failed to write cover: {}", e);
                    }
                }

            } else {
                eprintln!("No cover image found in EPUB: {}", path);
            }
        }
        Err(e) => {
            eprintln!("Failed to open EPUB for cover extraction: {:?}", e);
        }
    }

    // Load existing library
    let mut library = if library_path.exists() {
        let content = fs::read_to_string(&library_path)
            .map_err(|e| format!("Failed to read library: {}", e))?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        Library::default()
    };

    // Check if book already exists
    if let Some(idx) = library.books.iter().position(|b| b.id == id) {
        library.books[idx].last_opened = Utc::now();
        // Update cover if we extracted one
        if cover_path.is_some() {
            library.books[idx].cover_path = cover_path;
        }
        let book = library.books[idx].clone();
        save_library(&library, &library_path)?;
        return Ok(book);
    }

    // Create new book entry
    let book = Book {
        id: id.clone(),
        title,
        author,
        file_path: path,
        cover_path,
        last_opened: Utc::now(),
        progress: 0.0,
        cfi: None,
    };

    library.books.push(book.clone());
    save_library(&library, &library_path)?;

    Ok(book)
}

/// Get recently opened books
#[tauri::command]
pub fn get_recent_books(limit: usize) -> Result<Vec<Book>, String> {
    let home_dir =
        dirs::home_dir().ok_or_else(|| "Could not determine home directory".to_string())?;

    let library_path = home_dir.join(".epub-reader").join("library.json");

    if !library_path.exists() {
        return Ok(Vec::new());
    }

    let content =
        fs::read_to_string(&library_path).map_err(|e| format!("Failed to read library: {}", e))?;

    let mut library: Library =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse library: {}", e))?;

    // Sort by last_opened descending
    library
        .books
        .sort_by(|a, b| b.last_opened.cmp(&a.last_opened));

    Ok(library.books.into_iter().take(limit).collect())
}

/// Update reading progress
#[tauri::command]
pub fn update_progress(book_id: String, progress: f32, cfi: String) -> Result<(), String> {
    let home_dir =
        dirs::home_dir().ok_or_else(|| "Could not determine home directory".to_string())?;

    let library_path = home_dir.join(".epub-reader").join("library.json");

    let content =
        fs::read_to_string(&library_path).map_err(|e| format!("Failed to read library: {}", e))?;

    let mut library: Library =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse library: {}", e))?;

    if let Some(book) = library.books.iter_mut().find(|b| b.id == book_id) {
        book.progress = progress;
        book.cfi = Some(cfi);
        book.last_opened = Utc::now();
        save_library(&library, &library_path)?;
    }

    Ok(())
}

/// Get last saved progress for a book
#[tauri::command]
pub fn get_book_progress(book_id: String) -> Result<Option<String>, String> {
    let home_dir =
        dirs::home_dir().ok_or_else(|| "Could not determine home directory".to_string())?;

    let library_path = home_dir.join(".epub-reader").join("library.json");

    if !library_path.exists() {
        return Ok(None);
    }

    let content =
        fs::read_to_string(&library_path).map_err(|e| format!("Failed to read library: {}", e))?;

    let library: Library =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse library: {}", e))?;

    if let Some(book) = library.books.iter().find(|b| b.id == book_id) {
        return Ok(book.cfi.clone());
    }

    Ok(None)
}

/// Remove a book from the library
#[tauri::command]
pub fn remove_book(book_id: String) -> Result<(), String> {
    let home_dir =
        dirs::home_dir().ok_or_else(|| "Could not determine home directory".to_string())?;

    let app_dir = home_dir.join(".epub-reader");
    let library_path = app_dir.join("library.json");

    if !library_path.exists() {
        return Err("Library not found".to_string());
    }

    let content =
        fs::read_to_string(&library_path).map_err(|e| format!("Failed to read library: {}", e))?;

    let mut library: Library =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse library: {}", e))?;

    // Find and remove the book
    let original_len = library.books.len();
    
    // Delete cover file if it exists
    if let Some(book) = library.books.iter().find(|b| b.id == book_id) {
        if let Some(ref cover) = book.cover_path {
            let _ = fs::remove_file(cover);
        }
    }

    library.books.retain(|b| b.id != book_id);

    if library.books.len() == original_len {
        return Err(format!("Book with id '{}' not found", book_id));
    }

    save_library(&library, &library_path)?;
    Ok(())
}

fn save_library(library: &Library, path: &Path) -> Result<(), String> {
    let json = serde_json::to_string_pretty(library)
        .map_err(|e| format!("Failed to serialize library: {}", e))?;

    fs::write(path, json).map_err(|e| format!("Failed to save library: {}", e))?;

    Ok(())
}
