use tauri::{AppHandle, State};
use std::path::Path;
use std::time::Instant;

use suppaftp::AsyncFtpStream;
use futures_lite::io::AsyncReadExt;

use crate::models::{FtpState, CommandResult, ConnectionProtocol};
use crate::utils::parse_ftp_list_line;
use super::progress::ProgressReader;
use crate::commands::common::{normalize_remote_path, get_or_reconnect_stream};
use crate::commands::common::sftp_helper::get_or_create_sftp_client;

pub async fn download_recursive(
    stream: &mut AsyncFtpStream,
    remote_path: &str,
    local_path: &Path,
    app: &AppHandle,
) -> Result<(), String> {
    let listing = stream.mlsd(Some(remote_path)).await;
    
    match listing {
        Ok(files) => {
            let _ = std::fs::create_dir_all(local_path);
            
            for file_str in files {
                if let Some((name, size, is_directory, _, _)) = parse_ftp_list_line(&file_str) {
                    if name == "." || name == ".." { continue; }
                    
                    let next_remote_path = format!("{}/{}", remote_path.trim_end_matches('/'), name);
                    let next_local_path = local_path.join(&name);
                    
                    if is_directory {
                        Box::pin(download_recursive(stream, &next_remote_path, &next_local_path, app)).await?;
                    } else {
                        let data_stream = stream.retr_as_stream(&next_remote_path).await.map_err(|e| e.to_string())?;
                        let mut progress_reader = ProgressReader {
                            inner: data_stream,
                            app_handle: app.clone(),
                            file_name: name.clone(),
                            total_size: size as u64,
                            bytes_read: 0,
                            start_time: Instant::now(),
                            last_emit_time: Instant::now(),
                        };
                        
                        let mut buffer = Vec::new();
                        progress_reader.read_to_end(&mut buffer).await.map_err(|e| e.to_string())?;
                        
                        if let Some(parent) = next_local_path.parent() {
                            let _ = std::fs::create_dir_all(parent);
                        }
                        std::fs::write(next_local_path, buffer).map_err(|e| e.to_string())?;
                    }
                }
            }
        },
        Err(_) => {
            let data_stream = stream.retr_as_stream(remote_path).await.map_err(|e| e.to_string())?;
            let total_size = stream.size(remote_path).await.unwrap_or(0);
            let file_name = Path::new(remote_path).file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string();
            
            let mut progress_reader = ProgressReader {
                inner: data_stream,
                app_handle: app.clone(),
                file_name,
                total_size: total_size as u64,
                bytes_read: 0,
                start_time: Instant::now(),
                last_emit_time: Instant::now(),
            };
            
            let mut buffer = Vec::new();
            progress_reader.read_to_end(&mut buffer).await.map_err(|e| e.to_string())?;
            
            if let Some(parent) = local_path.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            std::fs::write(local_path, buffer).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn download_file(
    app: AppHandle,
    state: State<'_, FtpState>,
    remote_path: String,
    local_path: String,
) -> Result<CommandResult<()>, String> {
    let normalized_remote_path = normalize_remote_path(&remote_path);
    let conn_info_guard = state.connection_info.lock().await;
    let protocol = conn_info_guard.as_ref().map(|c| c.protocol.clone());
    drop(conn_info_guard);
    
    match protocol {
        Some(ConnectionProtocol::SFTP) => {
            match get_or_create_sftp_client(&state).await {
                Ok(sftp_client) => {
                    match sftp_client.download_file(&normalized_remote_path, &local_path) {
                        Ok(_) => Ok(CommandResult { success: true, data: None, error: None }),
                        Err(e) => Ok(CommandResult {
                            success: false,
                            data: None,
                            error: Some(format!("Failed to download via SFTP: {}", e)),
                        })
                    }
                },
                Err(e) => {
                    Ok(CommandResult {
                        success: false,
                        data: None,
                        error: Some(format!("Failed to connect SFTP for download: {}", e)),
                    })
                }
            }
        }
        Some(ConnectionProtocol::FTP) | None => {
            if let Err(e) = get_or_reconnect_stream(&state).await {
                return Ok(CommandResult {
                    success: false,
                    data: None,
                    error: Some(e),
                });
            }
            
            let mut client_guard = state.ftp_client.lock().await;
            if let Some(stream) = client_guard.as_mut() {
                match download_recursive(stream, &normalized_remote_path, Path::new(&local_path), &app).await {
                    Ok(_) => Ok(CommandResult { success: true, data: None, error: None }),
                    Err(e) => {
                        drop(client_guard);
                        
                        if get_or_reconnect_stream(&state).await.is_ok() {
                            let mut retry_guard = state.ftp_client.lock().await;
                            if let Some(retry_stream) = retry_guard.as_mut() {
                                match download_recursive(retry_stream, &normalized_remote_path, Path::new(&local_path), &app).await {
                                    Ok(_) => {
                                        return Ok(CommandResult { success: true, data: None, error: None });
                                    },
                                    Err(retry_err) => {
                                        return Ok(CommandResult {
                                            success: false,
                                            data: None,
                                            error: Some(format!("Failed to download after reconnect: {}", retry_err)),
                                        });
                                    }
                                }
                            }
                        }
                        
                        Ok(CommandResult {
                            success: false,
                            data: None,
                            error: Some(format!("Failed to download: {}", e)),
                        })
                    }
                }
            } else {
                Ok(CommandResult { success: false, data: None, error: Some("Not connected".to_string()) })
            }
        }
    }
}
