use std::path::Path;
use std::process::Command as StdCommand;
use tauri::State;
use suppaftp::AsyncFtpStream;
use chrono::{DateTime, Utc};
use futures_lite::{AsyncReadExt, io::Cursor as AsyncCursor};

use crate::models::{FtpState, FileItem, RecentFolder, CommandResult, ConnectionInfo};
use crate::utils::{format_bytes, parse_ftp_list_line};
use crate::reconnect::{reconnect_with_retry, is_connection_alive};
async fn get_or_reconnect_stream(state: &FtpState) -> Result<(), String> {
    let mut client_guard = state.client.lock().await;
    if let Some(stream) = client_guard.as_mut() {
        if is_connection_alive(stream).await {
            return Ok(());
        }
        let _ = client_guard.take();
    }
    
    let conn_info_guard = state.connection_info.lock().await;
    if let Some(conn_info) = conn_info_guard.as_ref() {
        let conn_info_clone = conn_info.clone();
        drop(conn_info_guard);
        
        match reconnect_with_retry(&conn_info_clone, 3).await {
            Ok(new_stream) => {
                *client_guard = Some(new_stream);
                Ok(())
            }
            Err(e) => Err(format!("Auto-reconnect failed: {}", e))
        }
    } else {
        Err("Not connected and no connection info available".to_string())
    }
}


#[tauri::command]
pub async fn connect(
    state: State<'_, FtpState>,
    host: String,
    port: u16,
    username: Option<String>,
    password: Option<String>,
) -> Result<CommandResult<String>, String> {
    let mut client_guard = state.client.lock().await;

    if client_guard.is_some() {
        let _ = client_guard.take();
    }

    let addr = format!("{}:{}", host, port);
    
    match AsyncFtpStream::connect(addr).await {
        Ok(mut stream) => {
            let user = username.unwrap_or("anonymous".to_string());
            let pass = password.unwrap_or("anonymous@".to_string());
            
            if let Err(e) = stream.login(&user, &pass).await {
                return Ok(CommandResult {
                    success: false,
                    data: None,
                    error: Some(format!("Login failed: {}", e)),
                });
            }

            let _ = stream.transfer_type(suppaftp::types::FileType::Binary).await;

            let conn_info = ConnectionInfo {
                host: host.clone(),
                port,
                username: user,
                password: pass,
            };
            
            let mut conn_info_guard = state.connection_info.lock().await;
            *conn_info_guard = Some(conn_info);

            *client_guard = Some(stream);
            
            let mut path_guard = state.current_path.lock().await;
            *path_guard = "/".to_string();

            Ok(CommandResult {
                success: true,
                data: Some("Connected successfully".to_string()),
                error: None,
            })
        },
        Err(e) => Ok(CommandResult {
            success: false,
            data: None,
            error: Some(format!("Connection failed: {}", e)),
        })
    }
}

#[tauri::command]
pub async fn disconnect(state: State<'_, FtpState>) -> Result<(), String> {
    let mut client_guard = state.client.lock().await;
    if let Some(mut stream) = client_guard.take() {
        let _ = stream.quit().await;
    }
    Ok(())
}

#[tauri::command]
pub async fn list_remote_files(state: State<'_, FtpState>, path: String) -> Result<CommandResult<Vec<FileItem>>, String> {
    if let Err(e) = get_or_reconnect_stream(&state).await {
        return Ok(CommandResult {
            success: false,
            data: None,
            error: Some(e),
        });
    }
    
    let mut client_guard = state.client.lock().await;
    
    if let Some(stream) = client_guard.as_mut() {
        match stream.mlsd(Some(&path)).await {
            Ok(files) => {
                let mut items = Vec::new();
                for file_str in files {
                    if let Some((name, size, is_directory, date_str, permissions)) = parse_ftp_list_line(&file_str) {
                         items.push(FileItem {
                            name: name.clone(),
                            full_path: if path == "/" { format!("/{}", name) } else { format!("{}/{}", path.trim_end_matches('/'), name) }, 
                            size,
                            modified: None,
                            is_directory,
                            readable_size: if is_directory { "".to_string() } else { format_bytes(size) },
                            readable_modified: date_str,
                            permissions,
                        });
                    }
                }
                
                let mut path_guard = state.current_path.lock().await;
                *path_guard = path;

                Ok(CommandResult {
                    success: true,
                    data: Some(items),
                    error: None,
                })
            },
            Err(e) => {
                drop(client_guard);
                
                if get_or_reconnect_stream(&state).await.is_ok() {
                    let mut retry_guard = state.client.lock().await;
                    if let Some(retry_stream) = retry_guard.as_mut() {
                        match retry_stream.mlsd(Some(&path)).await {
                            Ok(files) => {
                                let mut items = Vec::new();
                                for file_str in files {
                                    if let Some((name, size, is_directory, date_str, permissions)) = parse_ftp_list_line(&file_str) {
                                         items.push(FileItem {
                                            name: name.clone(),
                                            full_path: if path == "/" { format!("/{}", name) } else { format!("{}/{}", path.trim_end_matches('/'), name) }, 
                                            size,
                                            modified: None,
                                            is_directory,
                                            readable_size: if is_directory { "".to_string() } else { format_bytes(size) },
                                            readable_modified: date_str,
                                            permissions,
                                        });
                                    }
                                }
                                
                                let mut path_guard = state.current_path.lock().await;
                                *path_guard = path;

                                return Ok(CommandResult {
                                    success: true,
                                    data: Some(items),
                                    error: None,
                                });
                            },
                            Err(retry_err) => {
                                return Ok(CommandResult {
                                    success: false,
                                    data: None,
                                    error: Some(format!("Failed after reconnect: {}", retry_err)),
                                });
                            }
                        }
                    }
                }
                
                Ok(CommandResult {
                    success: false,
                    data: None,
                    error: Some(format!("Failed to list directory via MLSD: {}", e)),
                })
            }
        }
    } else {
        Ok(CommandResult {
            success: false,
            data: None,
            error: Some("Not connected".to_string()),
        })
    }
}

#[tauri::command]
pub async fn list_local_files(path: String) -> Result<CommandResult<Vec<FileItem>>, String> {
    let path_obj = Path::new(&path);
    if !path_obj.exists() {
         return Ok(CommandResult {
            success: false,
            data: None,
            error: Some("Path does not exist".to_string()),
        });
    }

    let path_clone = path.clone();
    let result = tokio::task::spawn_blocking(move || {
        let mut items = Vec::new();
        match std::fs::read_dir(&path_clone) {
            Ok(entries) => {
                for entry in entries {
                    if let Ok(entry) = entry {
                        let metadata = entry.metadata().ok();
                        let size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
                        let is_dir = metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false);
                        let modified: Option<DateTime<Utc>> = metadata
                            .and_then(|m| m.modified().ok())
                            .map(|t| t.into());
                        
                        let name = entry.file_name().to_string_lossy().to_string();
                        let full_path = entry.path().to_string_lossy().to_string();
                        
                        let permissions = if is_dir { "drwxrwxrwx".to_string() } else { "-rw-rw-rw-".to_string() };

                        items.push(FileItem {
                            name,
                            full_path,
                            size,
                            modified,
                            is_directory: is_dir,
                            readable_size: if is_dir { "".to_string() } else { format_bytes(size) },
                            readable_modified: modified.map(|d| d.format("%Y-%m-%d %H:%M").to_string()).unwrap_or_default(),
                            permissions,
                        });
                    }
                }
                Ok(items)
            },
            Err(e) => Err(format!("Failed to read local directory: {}", e))
        }
    }).await.map_err(|e| e.to_string())?;

    match result {
        Ok(items) => Ok(CommandResult {
            success: true,
            data: Some(items),
            error: None,
        }),
        Err(e) => Ok(CommandResult {
            success: false,
            data: None,
            error: Some(e),
        })
    }
}

async fn delete_remote_recursive(stream: &mut AsyncFtpStream, path: &str) -> Result<(), String> {
    if stream.rm(path).await.is_ok() {
        return Ok(());
    }

    let files = stream.mlsd(Some(path)).await.map_err(|e| format!("MLSD failed during deletion: {}", e))?;
    
    for file_str in files {
        if let Some((name, _, is_directory, _, _)) = parse_ftp_list_line(&file_str) {
            if name == "." || name == ".." { continue; }
            
            let full_path = format!("{}/{}", path.trim_end_matches('/'), name);
            if is_directory {
                Box::pin(delete_remote_recursive(stream, &full_path)).await?;
            } else {
                stream.rm(&full_path).await.map_err(|e| e.to_string())?;
            }
        }
    }

    stream.rmdir(path).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn delete_file(
    state: State<'_, FtpState>,
    path: String,
    is_remote: bool,
) -> Result<CommandResult<()>, String> {
    if is_remote {
        if let Err(e) = get_or_reconnect_stream(&state).await {
            return Ok(CommandResult {
                success: false,
                data: None,
                error: Some(e),
            });
        }
        
        let mut client_guard = state.client.lock().await;
        if let Some(stream) = client_guard.as_mut() {
            match delete_remote_recursive(stream, &path).await {
                Ok(_) => Ok(CommandResult { success: true, data: None, error: None }),
                Err(e) => {
                    drop(client_guard);
                    
                    if get_or_reconnect_stream(&state).await.is_ok() {
                        let mut retry_guard = state.client.lock().await;
                        if let Some(retry_stream) = retry_guard.as_mut() {
                            match delete_remote_recursive(retry_stream, &path).await {
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
        if let Err(e) = get_or_reconnect_stream(&state).await {
            return Ok(CommandResult {
                success: false,
                data: None,
                error: Some(e),
            });
        }
        
        let mut client_guard = state.client.lock().await;
        if let Some(stream) = client_guard.as_mut() {
            match stream.rename(&old_path, &new_path).await {
                Ok(_) => Ok(CommandResult { success: true, data: None, error: None }),
                Err(e) => {
                    drop(client_guard);
                    
                    if get_or_reconnect_stream(&state).await.is_ok() {
                        let mut retry_guard = state.client.lock().await;
                        if let Some(retry_stream) = retry_guard.as_mut() {
                            match retry_stream.rename(&old_path, &new_path).await {
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

async fn upload_recursive(
    stream: &mut AsyncFtpStream,
    local_path: &Path,
    remote_path: &str,
) -> Result<(), String> {
    if local_path.is_dir() {
        let _ = stream.mkdir(remote_path).await;
        let entries = std::fs::read_dir(local_path).map_err(|e| e.to_string())?;
        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let entry_path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();
            let next_remote_path = format!("{}/{}", remote_path.trim_end_matches('/'), file_name);
            Box::pin(upload_recursive(stream, &entry_path, &next_remote_path)).await?;
        }
    } else {
        let file_content = std::fs::read(local_path).map_err(|e| {
            e.to_string()
        })?;
        
        let mut cursor = AsyncCursor::new(file_content);
        match stream.put_file(remote_path, &mut cursor).await {
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
    state: State<'_, FtpState>,
    local_path: String,
    remote_path: String,
) -> Result<CommandResult<()>, String> {
    if let Err(e) = get_or_reconnect_stream(&state).await {
        return Ok(CommandResult {
            success: false,
            data: None,
            error: Some(e),
        });
    }
    
    let mut client_guard = state.client.lock().await;
    if let Some(stream) = client_guard.as_mut() {
        match upload_recursive(stream, Path::new(&local_path), &remote_path).await {
            Ok(_) => Ok(CommandResult { success: true, data: None, error: None }),
            Err(e) => {
                drop(client_guard);
                
                if get_or_reconnect_stream(&state).await.is_ok() {
                    let mut retry_guard = state.client.lock().await;
                    if let Some(retry_stream) = retry_guard.as_mut() {
                        match upload_recursive(retry_stream, Path::new(&local_path), &remote_path).await {
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

async fn download_recursive(
    stream: &mut AsyncFtpStream,
    remote_path: &str,
    local_path: &Path,
) -> Result<(), String> {
    let listing = stream.mlsd(Some(remote_path)).await;
    
    match listing {
        Ok(files) => {
            let _ = std::fs::create_dir_all(local_path);
            
            for file_str in files {
                if let Some((name, _, is_directory, _, _)) = parse_ftp_list_line(&file_str) {
                    if name == "." || name == ".." { continue; }
                    
                    let next_remote_path = format!("{}/{}", remote_path.trim_end_matches('/'), name);
                    let next_local_path = local_path.join(&name);
                    
                    if is_directory {
                        Box::pin(download_recursive(stream, &next_remote_path, &next_local_path)).await?;
                    } else {
                        let mut data_stream = stream.retr_as_stream(&next_remote_path).await.map_err(|e| e.to_string())?;
                        let mut buffer = Vec::new();
                        data_stream.read_to_end(&mut buffer).await.map_err(|e| e.to_string())?;
                        let _ = stream.finalize_retr_stream(data_stream).await;
                        std::fs::write(next_local_path, buffer).map_err(|e| e.to_string())?;
                    }
                }
            }
        },
        Err(_) => {
            let mut data_stream = stream.retr_as_stream(remote_path).await.map_err(|e| e.to_string())?;
            let mut buffer = Vec::new();
            data_stream.read_to_end(&mut buffer).await.map_err(|e| e.to_string())?;
            let _ = stream.finalize_retr_stream(data_stream).await;
            
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
    state: State<'_, FtpState>,
    remote_path: String,
    local_path: String,
) -> Result<CommandResult<()>, String> {
    if let Err(e) = get_or_reconnect_stream(&state).await {
        return Ok(CommandResult {
            success: false,
            data: None,
            error: Some(e),
        });
    }
    
    let mut client_guard = state.client.lock().await;
    if let Some(stream) = client_guard.as_mut() {
        match download_recursive(stream, &remote_path, Path::new(&local_path)).await {
            Ok(_) => Ok(CommandResult { success: true, data: None, error: None }),
            Err(e) => {
                drop(client_guard);
                
                if get_or_reconnect_stream(&state).await.is_ok() {
                    let mut retry_guard = state.client.lock().await;
                    if let Some(retry_stream) = retry_guard.as_mut() {
                        match download_recursive(retry_stream, &remote_path, Path::new(&local_path)).await {
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

#[tauri::command]
pub async fn create_directory(
    state: State<'_, FtpState>,
    path: String,
    is_remote: bool,
) -> Result<CommandResult<()>, String> {
    if is_remote {
        if let Err(e) = get_or_reconnect_stream(&state).await {
            return Ok(CommandResult {
                success: false,
                data: None,
                error: Some(e),
            });
        }
        
        let mut client_guard = state.client.lock().await;
        if let Some(stream) = client_guard.as_mut() {
            match stream.mkdir(&path).await {
                Ok(_) => Ok(CommandResult { success: true, data: None, error: None }),
                Err(e) => {
                    drop(client_guard);
                    
                    if get_or_reconnect_stream(&state).await.is_ok() {
                        let mut retry_guard = state.client.lock().await;
                        if let Some(retry_stream) = retry_guard.as_mut() {
                            match retry_stream.mkdir(&path).await {
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
        if let Err(e) = get_or_reconnect_stream(&state).await {
            return Ok(CommandResult {
                success: false,
                data: None,
                error: Some(e),
            });
        }
        
        let mut client_guard = state.client.lock().await;
        if let Some(stream) = client_guard.as_mut() {
            let mut cursor = AsyncCursor::new(Vec::new());
            match stream.put_file(&path, &mut cursor).await {
                Ok(_) => Ok(CommandResult { success: true, data: None, error: None }),
                Err(e) => {
                    drop(client_guard);
                    
                    if get_or_reconnect_stream(&state).await.is_ok() {
                        let mut retry_guard = state.client.lock().await;
                        if let Some(retry_stream) = retry_guard.as_mut() {
                            let mut retry_cursor = AsyncCursor::new(Vec::new());
                            match retry_stream.put_file(&path, &mut retry_cursor).await {
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

#[tauri::command]
pub fn save_last_local_path(app_handle: tauri::AppHandle, path: String) -> Result<(), String> {
    use tauri::Manager;
    if let Ok(config_dir) = app_handle.path().app_config_dir() {
        let _ = std::fs::create_dir_all(&config_dir);
        let config_path = config_dir.join("last_path.txt");
        let _ = std::fs::write(config_path, path);
    }
    Ok(())
}

#[tauri::command]
pub fn get_initial_local_path(app_handle: tauri::AppHandle) -> String {
    use tauri::Manager;
    
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

#[tauri::command]
pub async fn get_recent_folders() -> Result<CommandResult<Vec<RecentFolder>>, String> {
    let result = tokio::task::spawn_blocking(move || {
        let mut recent = Vec::new();

        #[cfg(target_os = "windows")]
        {
            let output = StdCommand::new("powershell")
                .arg("-NoProfile")
                .arg("-Command")
                .arg("$sh = New-Object -ComObject WScript.Shell; Get-ChildItem \"$env:APPDATA\\Microsoft\\Windows\\Recent\" -Filter *.lnk | ForEach-Object { try { $target = $sh.CreateShortcut($_.FullName).TargetPath; if (Test-Path $target -PathType Container) { $target } } catch {} } | Select-Object -Unique | Select-Object -First 15")
                .output();

            if let Ok(output) = output {
                let stdout = String::from_utf8_lossy(&output.stdout);
                for line in stdout.lines() {
                    let path = line.trim();
                    if !path.is_empty() {
                        let name = Path::new(path)
                            .file_name()
                            .map(|n| n.to_string_lossy().to_string())
                            .unwrap_or_else(|| path.to_string());
                        recent.push(RecentFolder {
                            name,
                            path: path.to_string(),
                        });
                    }
                }
            }
        }

        #[cfg(target_os = "linux")]
        {
            if let Some(home) = dirs::home_dir() {
                let xbel_path = home.join(".local/share/recently-used.xbel");
                if xbel_path.exists() {
                    if let Ok(content) = std::fs::read_to_string(xbel_path) {
                        for line in content.lines() {
                            if line.contains("href=\"file://") && line.contains("added=\"") {
                                if let Some(start) = line.find("href=\"file://") {
                                    let sub = &line[start + 13..];
                                    if let Some(end) = sub.find('\"') {
                                        let mut path = sub[..end].to_string();
                                        path = path.replace("%20", " ");
                                        let path_obj = Path::new(&path);
                                        if path_obj.is_dir() {
                                            let name = path_obj.file_name()
                                                .map(|n| n.to_string_lossy().to_string())
                                                .unwrap_or_else(|| path.clone());
                                            recent.push(RecentFolder { name, path });
                                        }
                                    }
                                }
                            }
                            if recent.len() >= 15 { break; }
                        }
                    }
                }
            }
        }

        #[cfg(target_os = "macos")]
        {
            if let Some(home) = dirs::home_dir() {
                recent.push(RecentFolder { name: "Downloads".to_string(), path: home.join("Downloads").to_string_lossy().to_string() });
                recent.push(RecentFolder { name: "Documents".to_string(), path: home.join("Documents").to_string_lossy().to_string() });
                recent.push(RecentFolder { name: "Desktop".to_string(), path: home.join("Desktop").to_string_lossy().to_string() });
            }
        }

        if recent.is_empty() {
            if let Some(home) = dirs::home_dir() {
                let common = vec!["Downloads", "Documents", "Pictures", "Videos", "Desktop"];
                for folder in common {
                    let p = home.join(folder);
                    if p.exists() {
                        recent.push(RecentFolder {
                            name: folder.to_string(),
                            path: p.to_string_lossy().to_string(),
                        });
                    }
                }
            }
        }

        recent
    }).await.map_err(|e| e.to_string())?;

    Ok(CommandResult {
        success: true,
        data: Some(result),
        error: None,
    })
}

#[tauri::command]
pub async fn read_text_file(
    state: State<'_, FtpState>,
    path: String,
    is_remote: bool,
) -> Result<CommandResult<String>, String> {
    if is_remote {
        if let Err(e) = get_or_reconnect_stream(&state).await {
            return Ok(CommandResult { success: false, data: None, error: Some(e) });
        }
        let mut client_guard = state.client.lock().await;
        if let Some(stream) = client_guard.as_mut() {
            match stream.retr_as_stream(&path).await {
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
        if let Err(e) = get_or_reconnect_stream(&state).await {
            return Ok(CommandResult { success: false, data: None, error: Some(e) });
        }
        let mut client_guard = state.client.lock().await;
        if let Some(stream) = client_guard.as_mut() {
            let mut cursor = AsyncCursor::new(content.into_bytes());
            match stream.put_file(&path, &mut cursor).await {
                Ok(_) => Ok(CommandResult { success: true, data: None, error: None }),
                Err(e) => Ok(CommandResult { success: false, data: None, error: Some(e.to_string()) }),
            }
        } else {
            Ok(CommandResult { success: false, data: None, error: Some("Not connected".to_string()) })
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
        if let Err(e) = get_or_reconnect_stream(&state).await {
            return Ok(CommandResult { success: false, data: None, error: Some(e) });
        }
        let mut client_guard = state.client.lock().await;
        if let Some(stream) = client_guard.as_mut() {
            match stream.retr_as_stream(&path).await {
                Ok(mut data_stream) => {
                    let mut buffer = Vec::new();
                    if let Err(e) = data_stream.read_to_end(&mut buffer).await {
                        let _ = stream.finalize_retr_stream(data_stream).await;
                        return Ok(CommandResult { success: false, data: None, error: Some(format!("Failed to read binary stream: {}", e)) });
                    }
                    let _ = stream.finalize_retr_stream(data_stream).await;
                    Ok(CommandResult { success: true, data: Some(buffer), error: None })
                },
                Err(e) => Ok(CommandResult { success: false, data: None, error: Some(format!("FTP binary retr failed: {}", e)) })
            }
        } else {
            Ok(CommandResult { success: false, data: None, error: Some("Not connected".to_string()) })
        }
    } else {
        match std::fs::read(path) {
            Ok(buffer) => Ok(CommandResult { success: true, data: Some(buffer), error: None }),
            Err(e) => Ok(CommandResult { success: false, data: None, error: Some(e.to_string()) }),
        }
    }
}
