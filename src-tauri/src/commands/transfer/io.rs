use tauri::State;
use futures_lite::io::Cursor as AsyncCursor;
use futures_lite::io::AsyncReadExt;

use crate::models::{FtpState, CommandResult, ConnectionProtocol};
use crate::commands::common::{normalize_remote_path, get_or_reconnect_stream, get_or_create_sftp_client};

#[tauri::command]
pub async fn read_text_file(
    state: State<'_, FtpState>,
    path: String,
    is_remote: bool,
) -> Result<CommandResult<String>, String> {
    if is_remote {
        let normalized_path = normalize_remote_path(&path);
        
        let conn_info_guard = state.connection_info.lock().await;
        let protocol = conn_info_guard.as_ref().map(|c| c.protocol.clone());
        drop(conn_info_guard);

        match protocol {
            Some(ConnectionProtocol::SFTP) => {
                match get_or_create_sftp_client(&state).await {
                    Ok(sftp_client) => {
                        let temp_dir = std::env::temp_dir();
                        let temp_file_path = temp_dir.join(format!("bestftp_read_{}.tmp", uuid::Uuid::new_v4()));
                        let temp_file_str = temp_file_path.to_string_lossy().to_string();

                        match sftp_client.download_file(&normalized_path, &temp_file_str) {
                            Ok(_) => {
                                let content = std::fs::read_to_string(&temp_file_path)
                                    .map_err(|e| format!("Failed to read temporary file: {}", e))?;
                                let _ = std::fs::remove_file(temp_file_path);
                                Ok(CommandResult { success: true, data: Some(content), error: None })
                            },
                            Err(e) => {
                                let _ = std::fs::remove_file(temp_file_path);
                                Ok(CommandResult { success: false, data: None, error: Some(format!("SFTP read failed: {}", e)) })
                            }
                        }
                    },
                    Err(e) => Ok(CommandResult { success: false, data: None, error: Some(format!("SFTP connection failed: {}", e)) })
                }
            },
            _ => {
                if let Err(e) = get_or_reconnect_stream(&state).await {
                    return Ok(CommandResult { success: false, data: None, error: Some(e) });
                }
                let mut client_guard = state.ftp_client.lock().await;
                if let Some(stream) = client_guard.as_mut() {
                    match stream.retr_as_stream(&normalized_path).await {
                        Ok(mut data_stream) => {
                            let mut buffer = Vec::new();
                            if let Err(e) = data_stream.read_to_end(&mut buffer).await {
                                let _ = stream.finalize_retr_stream(data_stream).await;
                                return Ok(CommandResult { success: false, data: None, error: Some(format!("Failed to read stream: {}", e)) });
                            }
                            let _ = stream.finalize_retr_stream(data_stream).await;
                            
                            let content = String::from_utf8_lossy(&buffer).to_string();
                            Ok(CommandResult { success: true, data: Some(content), error: None })
                        },
                        Err(e) => Ok(CommandResult { success: false, data: None, error: Some(format!("FTP retr failed: {}", e)) })
                    }
                } else {
                    Ok(CommandResult { success: false, data: None, error: Some("Not connected".to_string()) })
                }
            }
        }
    } else {
        match std::fs::read_to_string(path) {
            Ok(content) => Ok(CommandResult { success: true, data: Some(content), error: None }),
            Err(e) => Ok(CommandResult { success: false, data: None, error: Some(e.to_string()) }),
        }
    }
}

#[tauri::command]
pub async fn write_text_file(
    state: State<'_, FtpState>,
    path: String,
    content: String,
    is_remote: bool,
) -> Result<CommandResult<()>, String> {
    if is_remote {
        let normalized_path = normalize_remote_path(&path);
        
        let conn_info_guard = state.connection_info.lock().await;
        let protocol = conn_info_guard.as_ref().map(|c| c.protocol.clone());
        drop(conn_info_guard);

        match protocol {
            Some(ConnectionProtocol::SFTP) => {
                match get_or_create_sftp_client(&state).await {
                    Ok(sftp_client) => {
                        let temp_dir = std::env::temp_dir();
                        let temp_file_path = temp_dir.join(format!("bestftp_write_{}.tmp", uuid::Uuid::new_v4()));
                        let temp_file_str = temp_file_path.to_string_lossy().to_string();

                        std::fs::write(&temp_file_path, content)
                            .map_err(|e| format!("Failed to create temporary file: {}", e))?;

                        match sftp_client.upload_file(&temp_file_str, &normalized_path) {
                            Ok(_) => {
                                let _ = std::fs::remove_file(temp_file_path);
                                Ok(CommandResult { success: true, data: None, error: None })
                            },
                            Err(e) => {
                                let _ = std::fs::remove_file(temp_file_path);
                                Ok(CommandResult { success: false, data: None, error: Some(format!("SFTP write failed: {}", e)) })
                            }
                        }
                    },
                    Err(e) => Ok(CommandResult { success: false, data: None, error: Some(format!("SFTP connection failed: {}", e)) })
                }
            },
            _ => {
                if let Err(e) = get_or_reconnect_stream(&state).await {
                    return Ok(CommandResult {
                        success: false,
                        data: None,
                        error: Some(e),
                    });
                }
                let mut client_guard = state.ftp_client.lock().await;
                if let Some(stream) = client_guard.as_mut() {
                    let mut cursor = AsyncCursor::new(content.into_bytes());
                    match stream.put_file(&normalized_path, &mut cursor).await {
                        Ok(_) => Ok(CommandResult { success: true, data: None, error: None }),
                        Err(e) => Ok(CommandResult { success: false, data: None, error: Some(e.to_string()) }),
                    }
                } else {
                    Ok(CommandResult { success: false, data: None, error: Some("Not connected".to_string()) })
                }
            }
        }
    } else {
        match std::fs::write(path, content) {
            Ok(_) => Ok(CommandResult { success: true, data: None, error: None }),
            Err(e) => Ok(CommandResult { success: false, data: None, error: Some(e.to_string()) }),
        }
    }
}

#[tauri::command]
pub async fn read_binary_file(
    state: State<'_, FtpState>,
    path: String,
    is_remote: bool,
) -> Result<CommandResult<Vec<u8>>, String> {
    if is_remote {
        let normalized_path = normalize_remote_path(&path);
        
        let conn_info_guard = state.connection_info.lock().await;
        let protocol = conn_info_guard.as_ref().map(|c| c.protocol.clone());
        drop(conn_info_guard);

        match protocol {
            Some(ConnectionProtocol::SFTP) => {
                match get_or_create_sftp_client(&state).await {
                    Ok(sftp_client) => {
                        let temp_dir = std::env::temp_dir();
                        let temp_file_path = temp_dir.join(format!("bestftp_read_bin_{}.tmp", uuid::Uuid::new_v4()));
                        let temp_file_str = temp_file_path.to_string_lossy().to_string();

                        match sftp_client.download_file(&normalized_path, &temp_file_str) {
                            Ok(_) => {
                                let data = std::fs::read(&temp_file_path)
                                    .map_err(|e| format!("Failed to read temporary file: {}", e))?;
                                let _ = std::fs::remove_file(temp_file_path);
                                Ok(CommandResult { success: true, data: Some(data), error: None })
                            },
                            Err(e) => {
                                let _ = std::fs::remove_file(temp_file_path);
                                Ok(CommandResult { success: false, data: None, error: Some(format!("SFTP read failed: {}", e)) })
                            }
                        }
                    },
                    Err(e) => Ok(CommandResult { success: false, data: None, error: Some(format!("SFTP connection failed: {}", e)) })
                }
            },
            _ => {
                if let Err(e) = get_or_reconnect_stream(&state).await {
                    return Ok(CommandResult { success: false, data: None, error: Some(e) });
                }
                let mut client_guard = state.ftp_client.lock().await;
                if let Some(stream) = client_guard.as_mut() {
                    match stream.retr_as_stream(&normalized_path).await {
                        Ok(mut data_stream) => {
                            let mut buffer = Vec::new();
                            if let Err(e) = data_stream.read_to_end(&mut buffer).await {
                                let _ = stream.finalize_retr_stream(data_stream).await;
                                return Ok(CommandResult { success: false, data: None, error: Some(format!("Failed to read stream: {}", e)) });
                            }
                            let _ = stream.finalize_retr_stream(data_stream).await;
                            
                            Ok(CommandResult { success: true, data: Some(buffer), error: None })
                        },
                        Err(e) => Ok(CommandResult { success: false, data: None, error: Some(e.to_string()) }),
                    }
                } else {
                    Ok(CommandResult { success: false, data: None, error: Some("Not connected".to_string()) })
                }
            }
        }
    } else {
        match std::fs::read(path) {
            Ok(data) => Ok(CommandResult { success: true, data: Some(data), error: None }),
            Err(e) => Ok(CommandResult { success: false, data: None, error: Some(e.to_string()) }),
        }
    }
}
