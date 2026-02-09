use tauri::{AppHandle, State, Emitter};
use std::path::Path;
use suppaftp::AsyncFtpStream;
use crate::models::{FtpState, CommandResult, ConnectionProtocol};
use crate::utils::parse_ftp_list_line;
use crate::commands::common::{normalize_remote_path, get_or_reconnect_stream};
use crate::sftp_ops::SftpClient;
use futures_lite::io::Cursor as AsyncCursor;

#[derive(Clone, serde::Serialize)]
struct DeleteProgress {
    file_name: String,
    progress: f64,
    current_item: String,
    total_items: u32,
    deleted_items: u32,
}

pub async fn count_remote_items(stream: &mut AsyncFtpStream, path: &str) -> Result<u32, String> {
    match stream.mlsd(Some(path)).await {
        Ok(files) => {
            let mut count = 1u32;
            
            for file_str in files {
                if let Some((name, _, is_directory, _, _)) = parse_ftp_list_line(&file_str) {
                    if name == "." || name == ".." { continue; }
                    
                    let full_path = format!("{}/{}", path.trim_end_matches('/'), name);
                    if is_directory {
                        count += Box::pin(count_remote_items(stream, &full_path)).await?;
                    } else {
                        count += 1;
                    }
                }
            }
            
            Ok(count)
        },
        Err(_) => {
            Ok(1)
        }
    }
}

async fn delete_remote_recursive(
    stream: &mut AsyncFtpStream, 
    path: &str,
    app: &AppHandle,
    file_name: String,
    total_items: u32,
    deleted_items: &mut u32
) -> Result<(), String> {
    match stream.mlsd(Some(path)).await {
        Ok(files) => {
            for file_str in files {
                if let Some((name, _, is_directory, _, _)) = parse_ftp_list_line(&file_str) {
                    if name == "." || name == ".." { continue; }
                    
                    let full_path = format!("{}/{}", path.trim_end_matches('/'), name);
                    if is_directory {
                        Box::pin(delete_remote_recursive(stream, &full_path, app, file_name.clone(), total_items, deleted_items)).await?;
                    } else {
                        if stream.rm(&full_path).await.is_ok() {
                            *deleted_items += 1;
                            let progress = (*deleted_items as f64 / total_items as f64) * 100.0;
                            let payload = DeleteProgress {
                                file_name: file_name.clone(),
                                progress,
                                current_item: name.clone(),
                                total_items,
                                deleted_items: *deleted_items,
                            };
                            let _ = app.emit("delete-progress", payload);
                        } else {
                            let error_msg = format!("Failed to delete file: {}", full_path);
                            eprintln!("Delete error: {}", error_msg);
                            return Err(error_msg);
                        }
                    }
                }
            }
            stream.rmdir(path).await.map_err(|e| format!("Failed to remove directory {}: {}", path, e))?;
            *deleted_items += 1;
            let progress = (*deleted_items as f64 / total_items as f64) * 100.0;
            let payload = DeleteProgress {
                file_name: file_name.clone(),
                progress,
                current_item: path.split('/').last().unwrap_or(path).to_string(),
                total_items,
                deleted_items: *deleted_items,
            };
            let _ = app.emit("delete-progress", payload);
        },
        Err(_) => {
            if stream.rm(path).await.is_ok() {
                *deleted_items += 1;
                let progress = (*deleted_items as f64 / total_items as f64) * 100.0;
                let payload = DeleteProgress {
                    file_name: file_name.clone(),
                    progress,
                    current_item: path.split('/').last().unwrap_or(path).to_string(),
                    total_items,
                    deleted_items: *deleted_items,
                };
                let _ = app.emit("delete-progress", payload);
            } else {
                let error_msg = format!("Failed to delete file: {}", path);
                eprintln!("Delete error: {}", error_msg);
                return Err(error_msg);
            }
        }
    }
    
    Ok(())
}

#[tauri::command]
pub async fn delete_file(
    app: AppHandle,
    state: State<'_, FtpState>,
    path: String,
    is_remote: bool,
) -> Result<CommandResult<()>, String> {
    if is_remote {
        let normalized_path = normalize_remote_path(&path);
        eprintln!("Attempting to delete remote file: {} -> {}", path, normalized_path);
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
                            let path_obj = Path::new(&normalized_path);
                            let result = if path_obj.is_dir() {
                                match sftp_client.remove_directory(&normalized_path) {
                                    Ok(_) => Ok(()),
                                    Err(e) => Err(format!("Failed to remove SFTP directory: {}", e))
                                }
                            } else {
                                match sftp_client.remove_file(&normalized_path) {
                                    Ok(_) => Ok(()),
                                    Err(e) => Err(format!("Failed to remove SFTP file: {}", e))
                                }
                            };
                            
                            match result {
                                Ok(_) => {
                                    eprintln!("SFTP Delete successful for: {}", normalized_path);
                                    Ok(CommandResult { success: true, data: None, error: None })
                                },
                                Err(e) => {
                                    eprintln!("SFTP Delete failed for {}: {}", normalized_path, e);
                                    Ok(CommandResult {
                                        success: false,
                                        data: None,
                                        error: Some(e),
                                    })
                                }
                            }
                        },
                        Err(e) => {
                            Ok(CommandResult {
                                success: false,
                                data: None,
                                error: Some(format!("Failed to connect SFTP for deletion: {}", e)),
                            })
                        }
                    }
                } else {
                    Ok(CommandResult { success: false, data: None, error: Some("No connection info available".to_string()) })
                }
            }
            Some(ConnectionProtocol::FTP) | None => {
                if let Err(e) = get_or_reconnect_stream(&state).await {
                    eprintln!("Reconnect failed: {}", e);
                    return Ok(CommandResult {
                        success: false,
                        data: None,
                        error: Some(e),
                    });
                }
                
                let mut client_guard = state.ftp_client.lock().await;
                if let Some(stream) = client_guard.as_mut() {
                    let total_items = match count_remote_items(stream, &normalized_path).await {
                        Ok(count) => count,
                        Err(e) => {
                            return Ok(CommandResult {
                                success: false,
                                data: None,
                                error: Some(format!("Failed to count items: {}", e)),
                            });
                        }
                    };

                    let file_name = normalized_path.split('/').last().unwrap_or("unknown").to_string();
                    let mut deleted_items = 0u32;

                    match delete_remote_recursive(stream, &normalized_path, &app, file_name.clone(), total_items, &mut deleted_items).await {
                        Ok(_) => {
                            eprintln!("Delete successful for: {}", normalized_path);
                            Ok(CommandResult { success: true, data: None, error: None })
                        },
                        Err(e) => {
                            eprintln!("Delete failed for {}: {}", normalized_path, e);
                            drop(client_guard);
                            
                            if get_or_reconnect_stream(&state).await.is_ok() {
                                let mut retry_guard = state.ftp_client.lock().await;
                                if let Some(retry_stream) = retry_guard.as_mut() {
                                    let mut retry_deleted_items = 0u32;
                                    match delete_remote_recursive(retry_stream, &normalized_path, &app, file_name.clone(), total_items, &mut retry_deleted_items).await {
                                        Ok(_) => {
                                            return Ok(CommandResult { success: true, data: None, error: None });
                                        },
                                        Err(retry_err) => {
                                            return Ok(CommandResult {
                                                success: false,
                                                data: None,
                                                error: Some(format!("Failed to delete after reconnect: {}", retry_err)),
                                            });
                                        }
                                    }
                                }
                            }
                            
                            Ok(CommandResult {
                                success: false,
                                data: None,
                                error: Some(format!("Failed to delete remote item: {}", e)),
                            })
                        },
                    }
                } else {
                    Ok(CommandResult { success: false, data: None, error: Some("Not connected".to_string()) })
                }
            }
        }
    } else {
        let result = tokio::task::spawn_blocking(move || {
            let path_obj = Path::new(&path);
            if path_obj.is_dir() {
                std::fs::remove_dir_all(path_obj)
            } else {
                std::fs::remove_file(path_obj)
            }
        }).await.map_err(|e| e.to_string())?;

        match result {
            Ok(_) => Ok(CommandResult { success: true, data: None, error: None }),
            Err(e) => Ok(CommandResult { success: false, data: None, error: Some(format!("Failed to delete local item: {}", e)) }),
        }
    }
}

#[tauri::command]
pub async fn rename_file(
    state: State<'_, FtpState>,
    old_path: String,
    new_path: String,
    is_remote: bool,
) -> Result<CommandResult<()>, String> {
    if is_remote {
        let normalized_old_path = normalize_remote_path(&old_path);
        let normalized_new_path = normalize_remote_path(&new_path);
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
                            match sftp_client.rename_file(&normalized_old_path, &normalized_new_path) {
                                Ok(_) => Ok(CommandResult { success: true, data: None, error: None }),
                                Err(e) => Ok(CommandResult {
                                    success: false,
                                    data: None,
                                    error: Some(format!("Failed to rename SFTP item: {}", e)),
                                })
                            }
                        },
                        Err(e) => {
                            Ok(CommandResult {
                                success: false,
                                data: None,
                                error: Some(format!("Failed to connect SFTP for rename: {}", e)),
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
                    match stream.rename(&normalized_old_path, &normalized_new_path).await {
                        Ok(_) => Ok(CommandResult { success: true, data: None, error: None }),
                        Err(e) => {
                            drop(client_guard);
                            
                            if get_or_reconnect_stream(&state).await.is_ok() {
                                let mut retry_guard = state.ftp_client.lock().await;
                                if let Some(retry_stream) = retry_guard.as_mut() {
                                    match retry_stream.rename(&normalized_old_path, &normalized_new_path).await {
                                        Ok(_) => {
                                            return Ok(CommandResult { success: true, data: None, error: None });
                                        },
                                        Err(retry_err) => {
                                            return Ok(CommandResult {
                                                success: false,
                                                data: None,
                                                error: Some(format!("Failed to rename after reconnect: {}", retry_err)),
                                            });
                                        }
                                    }
                                }
                            }
                            
                            Ok(CommandResult {
                                success: false,
                                data: None,
                                error: Some(format!("Failed to rename remote item: {}", e)),
                            })
                        }
                    }
                } else {
                    Ok(CommandResult { success: false, data: None, error: Some("Not connected".to_string()) })
                }
            }
        }
    } else {
        let result = tokio::task::spawn_blocking(move || {
            std::fs::rename(old_path, new_path)
        }).await.map_err(|e| e.to_string())?;

        match result {
            Ok(_) => Ok(CommandResult { success: true, data: None, error: None }),
            Err(e) => Ok(CommandResult { success: false, data: None, error: Some(format!("Failed to rename local item: {}", e)) }),
        }
    }
}

#[tauri::command]
pub async fn create_directory(
    state: State<'_, FtpState>,
    path: String,
    is_remote: bool,
) -> Result<CommandResult<()>, String> {
    if is_remote {
        let normalized_path = normalize_remote_path(&path);
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
                            match sftp_client.create_directory(&normalized_path) {
                                Ok(_) => Ok(CommandResult { success: true, data: None, error: None }),
                                Err(e) => Ok(CommandResult {
                                    success: false,
                                    data: None,
                                    error: Some(format!("Failed to create SFTP directory: {}", e)),
                                })
                            }
                        },
                        Err(e) => {
                            Ok(CommandResult {
                                success: false,
                                data: None,
                                error: Some(format!("Failed to connect SFTP for directory creation: {}", e)),
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
                    match stream.mkdir(&normalized_path).await {
                        Ok(_) => Ok(CommandResult { success: true, data: None, error: None }),
                        Err(e) => {
                            drop(client_guard);
                            
                            if get_or_reconnect_stream(&state).await.is_ok() {
                                let mut retry_guard = state.ftp_client.lock().await;
                                if let Some(retry_stream) = retry_guard.as_mut() {
                                    match retry_stream.mkdir(&normalized_path).await {
                                        Ok(_) => {
                                            return Ok(CommandResult { success: true, data: None, error: None });
                                        },
                                        Err(retry_err) => {
                                            return Ok(CommandResult {
                                                success: false,
                                                data: None,
                                                error: Some(format!("Failed to create directory after reconnect: {}", retry_err)),
                                            });
                                        }
                                    }
                                }
                            }
                            
                            Ok(CommandResult {
                                success: false,
                                data: None,
                                error: Some(format!("Failed to create remote directory: {}", e)),
                            })
                        },
                    }
                } else {
                    Ok(CommandResult { success: false, data: None, error: Some("Not connected".to_string()) })
                }
            }
        }
    } else {
        let result = tokio::task::spawn_blocking(move || {
            std::fs::create_dir_all(path)
        }).await.map_err(|e| e.to_string())?;

        match result {
            Ok(_) => Ok(CommandResult { success: true, data: None, error: None }),
            Err(e) => Ok(CommandResult { success: false, data: None, error: Some(format!("Failed to create local directory: {}", e)) }),
        }
    }
}

#[tauri::command]
pub async fn create_file(
    state: State<'_, FtpState>,
    path: String,
    is_remote: bool,
) -> Result<CommandResult<()>, String> {
    if is_remote {
        let normalized_path = normalize_remote_path(&path);    
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
                            match sftp_client.create_empty_file(&normalized_path) {
                                Ok(_) => Ok(CommandResult { success: true, data: None, error: None }),
                                Err(e) => Ok(CommandResult {
                                    success: false,
                                    data: None,
                                    error: Some(format!("Failed to create SFTP file: {}", e)),
                                })
                            }
                        },
                        Err(e) => {
                            Ok(CommandResult {
                                success: false,
                                data: None,
                                error: Some(format!("Failed to connect SFTP for file creation: {}", e)),
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
                    let mut cursor = AsyncCursor::new(Vec::new());
                    match stream.put_file(&normalized_path, &mut cursor).await {
                        Ok(_) => Ok(CommandResult { success: true, data: None, error: None }),
                        Err(e) => {
                            drop(client_guard);
                            
                            if get_or_reconnect_stream(&state).await.is_ok() {
                                let mut retry_guard = state.ftp_client.lock().await;
                                if let Some(retry_stream) = retry_guard.as_mut() {
                                    let mut retry_cursor = AsyncCursor::new(Vec::new());
                                    match retry_stream.put_file(&normalized_path, &mut retry_cursor).await {
                                        Ok(_) => {
                                            return Ok(CommandResult { success: true, data: None, error: None });
                                        },
                                        Err(retry_err) => {
                                            return Ok(CommandResult {
                                                success: false,
                                                data: None,
                                                error: Some(format!("Failed to create file after reconnect: {}", retry_err)),
                                            });
                                        }
                                    }
                                }
                            }
                            
                            Ok(CommandResult {
                                success: false,
                                data: None,
                                error: Some(format!("Failed to create remote file: {}", e)),
                            })
                        },
                    }
                } else {
                    Ok(CommandResult { success: false, data: None, error: Some("Not connected".to_string()) })
                }
            }
        }
    } else {
        let result = tokio::task::spawn_blocking(move || {
            std::fs::File::create(path).map(|_| ())
        }).await.map_err(|e| e.to_string())?;

        match result {
            Ok(_) => Ok(CommandResult { success: true, data: None, error: None }),
            Err(e) => Ok(CommandResult { success: false, data: None, error: Some(format!("Failed to create local file: {}", e)) }),
        }
    }
}
