/**
 * Configuration and directory management
 */
use std::fs;

/// Get the app data directory path
#[tauri::command]
pub fn get_app_dir() -> Result<String, String> {
    let home_dir =
        dirs::home_dir().ok_or_else(|| "Could not determine home directory".to_string())?;

    let app_dir = home_dir.join(".epub-reader");

    Ok(app_dir.to_string_lossy().to_string())
}

/// Initialize the library directory structure
#[tauri::command]
pub fn init_library() -> Result<(), String> {
    let app_dir = get_app_dir_path()?;

    // Create main directory
    fs::create_dir_all(&app_dir).map_err(|e| format!("Failed to create app directory: {}", e))?;

    // Create subdirectories
    let media_dir = app_dir.join("media");
    let backgrounds_dir = media_dir.join("backgrounds");
    let presets_dir = app_dir.join("presets");
    let cache_dir = app_dir.join("cache");
    let covers_dir = cache_dir.join("covers");

    fs::create_dir_all(&backgrounds_dir)
        .map_err(|e| format!("Failed to create backgrounds directory: {}", e))?;
    fs::create_dir_all(&presets_dir)
        .map_err(|e| format!("Failed to create presets directory: {}", e))?;
    fs::create_dir_all(&covers_dir)
        .map_err(|e| format!("Failed to create covers directory: {}", e))?;

    // Create library.json if it doesn't exist
    let library_path = app_dir.join("library.json");
    if !library_path.exists() {
        let default_library = r#"{
  "books": [],
  "collections": [],
  "tags": []
}"#;
        fs::write(&library_path, default_library)
            .map_err(|e| format!("Failed to create library.json: {}", e))?;
    }

    Ok(())
}

/// Copy built-in presets and backgrounds on first run
#[tauri::command]
pub fn copy_builtin_presets() -> Result<(), String> {
    let app_dir = get_app_dir_path()?;
    let presets_dir = app_dir.join("presets");
    let backgrounds_dir = app_dir.join("media").join("backgrounds");

    // Check if presets already exist (marker file)
    let marker_path = presets_dir.join(".initialized");
    if marker_path.exists() {
        return Ok(()); // Already initialized
    }

    // Embedded preset JSONs
    let cozy_reading_json = include_str!("../assets/presets/cozy-reading.json");
    let focus_mode_json = include_str!("../assets/presets/focus-mode.json");
    let night_reading_json = include_str!("../assets/presets/night-reading.json");

    // Embedded background images (SVG)
    let fireplace_svg = include_str!("../assets/presets/backgrounds/fireplace.svg");
    let gradient_svg = include_str!("../assets/presets/backgrounds/gradient.svg");
    let starry_night_svg = include_str!("../assets/presets/backgrounds/starry-night.svg");

    // Write preset JSONs
    fs::write(presets_dir.join("cozy-reading.json"), cozy_reading_json)
        .map_err(|e| format!("Failed to write cozy-reading.json: {}", e))?;
    fs::write(presets_dir.join("focus-mode.json"), focus_mode_json)
        .map_err(|e| format!("Failed to write focus-mode.json: {}", e))?;
    fs::write(presets_dir.join("night-reading.json"), night_reading_json)
        .map_err(|e| format!("Failed to write night-reading.json: {}", e))?;

    // Write background images
    fs::write(backgrounds_dir.join("fireplace.svg"), fireplace_svg)
        .map_err(|e| format!("Failed to write fireplace.svg: {}", e))?;
    fs::write(backgrounds_dir.join("gradient.svg"), gradient_svg)
        .map_err(|e| format!("Failed to write gradient.svg: {}", e))?;
    fs::write(backgrounds_dir.join("starry-night.svg"), starry_night_svg)
        .map_err(|e| format!("Failed to write starry-night.svg: {}", e))?;

    // Create marker file
    fs::write(&marker_path, "").map_err(|e| format!("Failed to create marker file: {}", e))?;

    Ok(())
}

/// Helper function to get app directory path
fn get_app_dir_path() -> Result<std::path::PathBuf, String> {
    let home_dir =
        dirs::home_dir().ok_or_else(|| "Could not determine home directory".to_string())?;

    Ok(home_dir.join(".epub-reader"))
}
