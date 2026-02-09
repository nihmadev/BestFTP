use tauri::{AppHandle, State};
use std::path::Path;
use std::time::Instant;
use futures_lite::io::Cursor as AsyncCursor;
use suppaftp::AsyncFtpStream;
use crate::models::{FtpState, CommandResult, ConnectionProtocol};
use super::progress::ProgressReader;
use crate::commands::common::{normalize_remote_path, get_or_reconnect_stream};
use crate::sftp_ops::SftpClient;

pub async fn upload_recursive(
    stream: &mut AsyncFtpStream,
    local_path: &Path,
    remote_path: &str,
    app: &AppHandle,
) -> Result<(), String> {
    if local_path.is_dir() {
        let _ = stream.mkdir(remote_path).await;
        let entries = std::fs::read_dir(local_path).map_err(|e| e.to_string())?;
        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let entry_path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();
            let next_remote_path = format!("{}/{}", remote_path.trim_end_matches('/'), file_name);
            Box::pin(upload_recursive(stream, &entry_path, &next_remote_path, app)).await?;
        }
    } else {
        let file_content = std::fs::read(local_path).map_err(|e| {
            e.to_string()
        })?;
        
        let total_size = file_content.len() as u64;
        let file_name = local_path.file_name().unwrap_or_default().to_string_lossy().to_string();
        let cursor = AsyncCursor::new(file_content);
        
        let mut progress_reader = ProgressReader {
            inner: cursor,
            app_handle: app.clone(),
            file_name,
            total_size,
            bytes_read: 0,
            start_time: Instant::now(),
            last_emit_time: Instant::now(),
        };

        match stream.put_file(remote_path, &mut progress_reader).await {
            Ok(_) => {
                Ok(())
            }
            Err(e) => {
                Err(e.to_string())
            }
        }?;
    }
    Ok(())
}

#[tauri::command]
pub async fn upload_file(
    app: AppHandle,
    state: State<'_, FtpState>,
    local_path: String,
    remote_path: String,
) -> Result<CommandResult<()>, String> {
    let normalized_remote_path = normalize_remote_path(&remote_path);
    let conn_info_guard = state.connection_info.lock().await;
    let protocol = conn_info_guard.as_ref().map(|c| c.protocol.clone());
    drop(conn_info_guard);
    
    match protocol {
        Some(ConnectionProtocol::SFTP) => {
            let conn_info = state.connection_info.lock().await;
            if let Some(ref conn) = *conn_info {
                let host = conn.host.clone();
                let port = conn.port;
                let username = conn.username.clone();
                let password = conn.password.clone();
                drop(conn_info);
                
                match SftpClient::connect(&host, port, &username, &password) {
                    Ok(sftp_client) => {
                        match sftp_client.upload_file(&local_path, &normalized_remote_path) {
                            Ok(_) => Ok(CommandResult { success: true, data: None, error: None }),
                            Err(e) => Ok(CommandResult {
                                success: false,
                                data: None,
                                error: Some(format!("Failed to upload via SFTP: {}", e)),
                            })
                        }
                    },
                    Err(e) => {
                        Ok(CommandResult {
                            success: false,
                            data: None,
                            error: Some(format!("Failed to connect SFTP for upload: {}", e)),
                        })
                    }
                }
            } else {
                Ok(CommandResult { success: false, data: None, error: Some("No connection info available".to_string()) })
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
                match upload_recursive(stream, Path::new(&local_path), &normalized_remote_path, &app).await {
                    Ok(_) => Ok(CommandResult { success: true, data: None, error: None }),
                    Err(e) => {
                        drop(client_guard);
                        
                        if get_or_reconnect_stream(&state).await.is_ok() {
                            let mut retry_guard = state.ftp_client.lock().await;
                            if let Some(retry_stream) = retry_guard.as_mut() {
                                match upload_recursive(retry_stream, Path::new(&local_path), &normalized_remote_path, &app).await {
                                    Ok(_) => {
                                        return Ok(CommandResult { success: true, data: None, error: None });
                                    },
                                    Err(retry_err) => {
                                        return Ok(CommandResult {
                                            success: false,
                                            data: None,
                                            error: Some(format!("Failed to upload after reconnect: {}", retry_err)),
                                        });
                                    }
                                }
                            }
                        }
                        
                        Ok(CommandResult {
                            success: false,
                            data: None,
                            error: Some(format!("Failed to upload: {}", e)),
                        })
                    }
                }
            } else {
                Ok(CommandResult { success: false, data: None, error: Some("Not connected".to_string()) })
            }
        }
    }
}
