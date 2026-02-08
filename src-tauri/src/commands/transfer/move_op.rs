use tauri::{AppHandle, State};
use std::path::Path;

use crate::models::{FtpState, CommandResult};
use crate::commands::common::{normalize_remote_path, get_or_reconnect_stream};
use crate::commands::fs::delete_file;
use super::upload::upload_recursive;
use super::download::download_recursive;

#[tauri::command]
pub async fn move_file(
    app: AppHandle,
    state: State<'_, FtpState>,
    source_path: String,
    dest_path: String,
    is_remote_source: bool,
) -> Result<CommandResult<()>, String> {
    if is_remote_source {
        let normalized_source_path = normalize_remote_path(&source_path);
        
        if let Err(e) = get_or_reconnect_stream(&state).await {
            return Ok(CommandResult {
                success: false,
                data: None,
                error: Some(e),
            });
        }
        
        let mut client_guard = state.client.lock().await;
        if let Some(stream) = client_guard.as_mut() {
            match download_recursive(stream, &normalized_source_path, Path::new(&dest_path), &app).await {
                Ok(_) => {
                    drop(client_guard);
                    match delete_file(app, state.clone(), source_path, true).await {
                        Ok(_) => Ok(CommandResult { success: true, data: None, error: None }),
                        Err(e) => Ok(CommandResult { 
                            success: false, 
                            data: None, 
                            error: Some(format!("File downloaded but failed to delete remote: {}", e)) 
                        }),
                    }
                },
                Err(e) => Ok(CommandResult {
                    success: false,
                    data: None,
                    error: Some(format!("Failed to download file during move: {}", e)),
                }),
            }
        } else {
            Ok(CommandResult { success: false, data: None, error: Some("Not connected".to_string()) })
        }
    } else {
        let normalized_dest_path = normalize_remote_path(&dest_path);
        
        if let Err(e) = get_or_reconnect_stream(&state).await {
            return Ok(CommandResult {
                success: false,
                data: None,
                error: Some(e),
            });
        }
        
        let mut client_guard = state.client.lock().await;
        if let Some(stream) = client_guard.as_mut() {
            match upload_recursive(stream, Path::new(&source_path), &normalized_dest_path, &app).await {
                Ok(_) => {
                    drop(client_guard);
                    let result = tokio::task::spawn_blocking(move || {
                        let path_obj = Path::new(&source_path);
                        if path_obj.is_dir() {
                            std::fs::remove_dir_all(path_obj)
                        } else {
                            std::fs::remove_file(path_obj)
                        }
                    }).await.map_err(|e| e.to_string())?;

                    match result {
                        Ok(_) => Ok(CommandResult { success: true, data: None, error: None }),
                        Err(e) => Ok(CommandResult { 
                            success: false, 
                            data: None, 
                            error: Some(format!("File uploaded but failed to delete local: {}", e)) 
                        }),
                    }
                },
                Err(e) => Ok(CommandResult {
                    success: false,
                    data: None,
                    error: Some(format!("Failed to upload file during move: {}", e)),
                }),
            }
        } else {
            Ok(CommandResult { success: false, data: None, error: Some("Not connected".to_string()) })
        }
    }
}
