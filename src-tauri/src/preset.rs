/**
 * Preset management and validation
 */
use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Preset {
    pub version: String,
    pub name: String,
    pub author: Option<String>,
    pub description: Option<String>,
    pub background: BackgroundConfig,
    pub overlay: OverlayConfig,
    pub reader: ReaderConfig,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BackgroundConfig {
    #[serde(rename = "type")]
    pub bg_type: String,
    pub path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OverlayConfig {
    pub color: String,
    pub opacity: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReaderConfig {
    pub opacity: f32,
    #[serde(rename = "backgroundColor")]
    pub background_color: String,

    // Extended settings (all optional for backward compatibility with old presets)
    #[serde(rename = "textColor", default)]
    pub text_color: Option<String>,
    #[serde(rename = "fontFamily", default)]
    pub font_family: Option<String>,
    #[serde(rename = "fontSize", default)]
    pub font_size: Option<u32>,
    #[serde(rename = "readingMode", default)]
    pub reading_mode: Option<String>,
    #[serde(default)]
    pub glassmorphism: Option<bool>,
    #[serde(rename = "glassBlur", default)]
    pub glass_blur: Option<u32>,
    #[serde(rename = "scrollbarTrack", default)]
    pub scrollbar_track: Option<String>,
    #[serde(rename = "scrollbarThumb", default)]
    pub scrollbar_thumb: Option<String>,
}

/// Validate preset structure (relaxed — only checks version)
pub fn validate_preset(preset: &Preset) -> Result<(), String> {
    if preset.version != "1.0" && preset.version != "2.0" {
        return Err(format!("Unsupported schema version: {}", preset.version));
    }
    Ok(())
}

/// List all available presets
#[tauri::command]
pub fn list_presets() -> Result<Vec<String>, String> {
    let home_dir =
        dirs::home_dir().ok_or_else(|| "Could not determine home directory".to_string())?;

    let presets_dir = home_dir.join(".epub-reader").join("presets");

    if !presets_dir.exists() {
        return Ok(Vec::new());
    }

    let mut presets = Vec::new();

    let entries = fs::read_dir(&presets_dir)
        .map_err(|e| format!("Failed to read presets directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
            if let Some(name) = path.file_stem().and_then(|s| s.to_str()) {
                presets.push(name.to_string());
            }
        }
    }

    Ok(presets)
}

/// Load a preset by name (with relaxed validation)
#[tauri::command]
pub fn load_preset(preset_name: String) -> Result<Preset, String> {
    let home_dir =
        dirs::home_dir().ok_or_else(|| "Could not determine home directory".to_string())?;

    let preset_path = home_dir
        .join(".epub-reader")
        .join("presets")
        .join(format!("{}.json", preset_name));

    if !preset_path.exists() {
        return Err(format!("Preset '{}' not found", preset_name));
    }

    let json_content = fs::read_to_string(&preset_path)
        .map_err(|e| format!("Failed to read preset file: {}", e))?;

    let preset: Preset = serde_json::from_str(&json_content)
        .map_err(|e| format!("Failed to parse preset JSON: {}", e))?;

    validate_preset(&preset)?;

    Ok(preset)
}

/// List all available background images
#[tauri::command]
pub fn list_backgrounds() -> Result<Vec<String>, String> {
    let home_dir =
        dirs::home_dir().ok_or_else(|| "Could not determine home directory".to_string())?;

    let backgrounds_dir = home_dir
        .join(".epub-reader")
        .join("media")
        .join("backgrounds");

    if !backgrounds_dir.exists() {
        return Ok(Vec::new());
    }

    let mut backgrounds = Vec::new();
    let valid_extensions = ["jpg", "jpeg", "png", "webp", "svg"];

    let entries = fs::read_dir(&backgrounds_dir)
        .map_err(|e| format!("Failed to read backgrounds directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.is_file() {
            if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
                if valid_extensions.contains(&ext.to_lowercase().as_str()) {
                    backgrounds.push(path.to_string_lossy().to_string());
                }
            }
        }
    }

    Ok(backgrounds)
}

/// Save a custom user preset
#[tauri::command]
pub fn save_custom_preset(name: String, preset_json: String) -> Result<Preset, String> {
    let mut preset: Preset = serde_json::from_str(&preset_json)
        .map_err(|e| format!("Failed to parse preset JSON: {}", e))?;

    preset.name = name.clone();

    validate_preset(&preset)?;

    let home_dir =
        dirs::home_dir().ok_or_else(|| "Could not determine home directory".to_string())?;
    let presets_dir = home_dir.join(".epub-reader").join("presets");

    fs::create_dir_all(&presets_dir)
        .map_err(|e| format!("Failed to create presets directory: {}", e))?;

    let preset_path = presets_dir.join(format!("{}.json", name));

    let json = serde_json::to_string_pretty(&preset)
        .map_err(|e| format!("Failed to serialize preset: {}", e))?;

    fs::write(&preset_path, json)
        .map_err(|e| format!("Failed to write preset file: {}", e))?;

    Ok(preset)
}

/// Delete a user-created preset
#[tauri::command]
pub fn delete_preset(name: String) -> Result<(), String> {
    let home_dir =
        dirs::home_dir().ok_or_else(|| "Could not determine home directory".to_string())?;

    let preset_path = home_dir
        .join(".epub-reader")
        .join("presets")
        .join(format!("{}.json", name));

    if !preset_path.exists() {
        return Err(format!("Preset '{}' not found", name));
    }

    fs::remove_file(&preset_path)
        .map_err(|e| format!("Failed to delete preset: {}", e))?;

    Ok(())
}
