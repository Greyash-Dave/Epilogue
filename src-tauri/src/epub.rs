/**
 * EPUB file operations
 */
use std::fs;

/// Open native file picker dialog for EPUB files
#[tauri::command]
pub fn open_epub_dialog() -> Result<String, String> {
    use rfd::FileDialog;

    let file = FileDialog::new()
        .add_filter("EPUB Files", &["epub"])
        .pick_file();

    match file {
        Some(path) => {
            let p: std::path::PathBuf = path;
            Ok(p.to_string_lossy().to_string())
        }
        None => Err("No file selected".to_string()),
    }
}

/// Read EPUB file as byte array
#[tauri::command]
pub fn read_epub_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|e| format!("Failed to read EPUB file: {}", e))
}

/// Open native file picker dialog for background media (images & videos)
#[tauri::command]
pub fn open_media_dialog() -> Result<String, String> {
    use rfd::FileDialog;

    let file = FileDialog::new()
        .add_filter("Images", &["jpg", "jpeg", "png", "gif", "webp", "bmp"])
        .add_filter("Videos", &["mp4", "webm", "mov", "avi", "mkv"])
        .add_filter("All Media", &["jpg", "jpeg", "png", "gif", "webp", "bmp", "mp4", "webm", "mov", "avi", "mkv"])
        .pick_file();

    match file {
        Some(path) => {
            let p: std::path::PathBuf = path;
            Ok(p.to_string_lossy().to_string())
        }
        None => Err("No file selected".to_string()),
    }
}

/// Open native file picker dialog for audio files
#[tauri::command]
pub fn open_audio_dialog() -> Result<String, String> {
    use rfd::FileDialog;

    let file = FileDialog::new()
        .add_filter("Audio Files", &["mp3", "wav", "ogg", "flac", "aac", "m4a", "wma"])
        .pick_file();

    match file {
        Some(path) => {
            let p: std::path::PathBuf = path;
            Ok(p.to_string_lossy().to_string())
        }
        None => Err("No file selected".to_string()),
    }
}
