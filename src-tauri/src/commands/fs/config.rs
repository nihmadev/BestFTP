use std::path::Path;
use tauri::Manager;

#[tauri::command]
pub fn save_last_local_path(app_handle: tauri::AppHandle, path: String) -> Result<(), String> {
    if let Ok(config_dir) = app_handle.path().app_config_dir() {
        let _ = std::fs::create_dir_all(&config_dir);
        let config_path = config_dir.join("last_path.txt");
        let _ = std::fs::write(config_path, path);
    }
    Ok(())
}

#[tauri::command]
pub fn get_initial_local_path(app_handle: tauri::AppHandle) -> String {
    if let Ok(config_dir) = app_handle.path().app_config_dir() {
        let config_path = config_dir.join("last_path.txt");
        if let Ok(saved_path) = std::fs::read_to_string(config_path) {
            let path = saved_path.trim();
            if !path.is_empty() && Path::new(path).exists() {
                return path.to_string();
            }
        }
    }
    dirs::document_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| dirs::home_dir().map(|p| p.to_string_lossy().to_string()).unwrap_or_else(|| "/".to_string()))
}
