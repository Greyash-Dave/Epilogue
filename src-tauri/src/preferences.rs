/**
 * User preferences management and persistence
 */
use serde::{Deserialize, Serialize};
use std::fs;

fn default_reading_mode() -> String {
    "paginated".to_string()
}
fn default_text_color() -> String {
    "#1a1a1a".to_string()
}
fn default_container_color() -> String {
    "#FFFFFF".to_string()
}
fn default_container_opacity() -> u32 {
    95
}
fn default_glass_blur() -> u32 {
    12
}
fn default_scrollbar_track() -> String {
    "transparent".to_string()
}
fn default_scrollbar_thumb() -> String {
    "rgba(255, 255, 255, 0.25)".to_string()
}
fn default_true() -> bool {
    true
}
fn default_music_volume() -> u32 {
    50
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserPreferences {
    #[serde(rename = "fontFamily")]
    pub font_family: String,
    #[serde(rename = "fontSize")]
    pub font_size: u32,
    #[serde(rename = "lastPreset")]
    pub last_preset: Option<String>,
    #[serde(rename = "readingMode", default = "default_reading_mode")]
    pub reading_mode: String,
    #[serde(rename = "textColor", default = "default_text_color")]
    pub text_color: String,
    #[serde(rename = "containerColor", default = "default_container_color")]
    pub container_color: String,
    #[serde(rename = "containerOpacity", default = "default_container_opacity")]
    pub container_opacity: u32,
    #[serde(default)]
    pub glassmorphism: bool,
    #[serde(rename = "glassBlur", default = "default_glass_blur")]
    pub glass_blur: u32,
    #[serde(rename = "bgMediaPath", default)]
    pub bg_media_path: Option<String>,
    #[serde(rename = "bgAudioMuted", default = "default_true")]
    pub bg_audio_muted: bool,
    #[serde(rename = "bgMusicPath", default)]
    pub bg_music_path: Option<String>,
    #[serde(rename = "bgMusicVolume", default = "default_music_volume")]
    pub bg_music_volume: u32,
    #[serde(rename = "bgMusicMuted", default = "default_true")]
    pub bg_music_muted: bool,
    #[serde(rename = "scrollbarTrack", default = "default_scrollbar_track")]
    pub scrollbar_track: String,
    #[serde(rename = "scrollbarThumb", default = "default_scrollbar_thumb")]
    pub scrollbar_thumb: String,
}

impl Default for UserPreferences {
    fn default() -> Self {
        Self {
            font_family: "serif".to_string(),
            font_size: 18,
            last_preset: Some("Cozy Reading".to_string()),
            reading_mode: default_reading_mode(),
            text_color: default_text_color(),
            container_color: default_container_color(),
            container_opacity: default_container_opacity(),
            glassmorphism: false,
            glass_blur: default_glass_blur(),
            bg_media_path: None,
            bg_audio_muted: true,
            bg_music_path: None,
            bg_music_volume: default_music_volume(),
            bg_music_muted: true,
            scrollbar_track: default_scrollbar_track(),
            scrollbar_thumb: default_scrollbar_thumb(),
        }
    }
}

fn preferences_path() -> Result<std::path::PathBuf, String> {
    let home_dir =
        dirs::home_dir().ok_or_else(|| "Could not determine home directory".to_string())?;
    Ok(home_dir.join(".epub-reader").join("preferences.json"))
}

/// Get user preferences
#[tauri::command]
pub fn get_preferences() -> Result<UserPreferences, String> {
    let path = preferences_path()?;

    if !path.exists() {
        return Ok(UserPreferences::default());
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read preferences: {}", e))?;

    serde_json::from_str(&content).map_err(|e| {
        eprintln!("Failed to parse preferences, using defaults: {}", e);
        // Return defaults if parse fails
        format!("Parse error: {}", e)
    }).or_else(|_| Ok(UserPreferences::default()))
}

/// Save user preferences
#[tauri::command]
pub fn set_preferences(prefs: UserPreferences) -> Result<(), String> {
    let path = preferences_path()?;

    // Validate font size range
    if prefs.font_size < 12 || prefs.font_size > 32 {
        return Err(format!("Font size must be between 12 and 32, got {}", prefs.font_size));
    }

    // Validate font family
    let valid_families = ["serif", "sans-serif", "monospace"];
    if !valid_families.contains(&prefs.font_family.as_str()) {
        return Err(format!("Invalid font family: {}", prefs.font_family));
    }

    // Validate reading mode
    let valid_modes = ["paginated", "scrolled"];
    if !valid_modes.contains(&prefs.reading_mode.as_str()) {
        return Err(format!("Invalid reading mode: {}", prefs.reading_mode));
    }

    // Ensure directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create preferences directory: {}", e))?;
    }

    let json = serde_json::to_string_pretty(&prefs)
        .map_err(|e| format!("Failed to serialize preferences: {}", e))?;

    fs::write(&path, json)
        .map_err(|e| format!("Failed to write preferences: {}", e))?;

    Ok(())
}
