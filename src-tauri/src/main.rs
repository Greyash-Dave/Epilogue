// Prevents additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config;
mod epub;
mod library;
mod preset;
mod preferences;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .setup(|_app| {
            // Initialize library on first launch
            if let Err(e) = config::init_library() {
                eprintln!("Failed to initialize library: {}", e);
            }

            // Copy built-in presets on first run
            if let Err(e) = config::copy_builtin_presets() {
                eprintln!("Failed to copy built-in presets: {}", e);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            config::get_app_dir,
            config::init_library,
            config::copy_builtin_presets,
            epub::open_epub_dialog,
            epub::read_epub_file,
            epub::open_media_dialog,
            epub::open_audio_dialog,
            preset::list_presets,
            preset::load_preset,
            preset::list_backgrounds,
            preset::save_custom_preset,
            preset::delete_preset,
            library::add_book,
            library::get_recent_books,
            library::update_progress,
            library::get_book_progress,
            library::remove_book,
            preferences::get_preferences,
            preferences::set_preferences,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

