use tauri::State;
use std::path::Path;
use chrono::{DateTime, Utc};
use crate::models::{FtpState, FileItem, RecentFolder, CommandResult, ConnectionProtocol};
use crate::utils::{format_bytes, parse_ftp_list_line};
use crate::commands::common::{normalize_remote_path, get_or_reconnect_stream};
use crate::commands::common::sftp_helper::get_or_create_sftp_client;


#[tauri::command]
pub async fn list_remote_files(state: State<'_, FtpState>, path: String) -> Result<CommandResult<Vec<FileItem>>, String> {
    let normalized_path = normalize_remote_path(&path);
    let conn_info_guard = state.connection_info.lock().await;
    let protocol = conn_info_guard.as_ref().map(|c| c.protocol.clone());
    drop(conn_info_guard);
    
    match protocol {
        Some(ConnectionProtocol::SFTP) => {
            match get_or_create_sftp_client(&state).await {
                Ok(sftp_client) => {
                    match sftp_client.list_directory(&normalized_path) {
                        Ok(items) => {
                            let mut path_guard = state.current_path.lock().await;
                            *path_guard = normalized_path;

                            Ok(CommandResult {
                                success: true,
                                data: Some(items),
                                error: None,
                            })
                        },
                        Err(e) => {
                            Ok(CommandResult {
                                success: false,
                                data: None,
                                error: Some(format!("Failed to list SFTP directory: {}", e)),
                            })
                        }
                    }
                },
                Err(e) => {
                    Ok(CommandResult {
                        success: false,
                        data: None,
                        error: Some(format!("Failed to connect SFTP for listing: {}", e)),
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
                match stream.mlsd(Some(&normalized_path)).await {
                    Ok(files) => {
                        let mut items = Vec::new();
                        for file_str in &files {
                            if let Some((name, size, is_directory, date_str, permissions)) = parse_ftp_list_line(file_str) {
                                 let full_path = if normalized_path == "/" { format!("/{}", name) } else { format!("{}/{}", normalized_path.trim_end_matches('/'), name) };
                                 let size = if is_directory {
                                     0
                                 } else {
                                     size
                                 };

                                 let readable_size = if is_directory {
                                     "".to_string()
                                 } else {
                                     format_bytes(size)
                                 };

                                 items.push(FileItem {
                                    name: name.clone(),
                                    full_path, 
                                    size,
                                    modified: None,
                                    is_directory,
                                    readable_size,
                                    readable_modified: date_str,
                                    permissions,
                                });
                            }
                        }
                        
                        let mut path_guard = state.current_path.lock().await;
                        *path_guard = normalized_path;

                        Ok(CommandResult {
                            success: true,
                            data: Some(items),
                            error: None,
                        })
                    },
                    Err(e) => {
                        drop(client_guard);
                        
                        if get_or_reconnect_stream(&state).await.is_ok() {
                            let mut retry_guard = state.ftp_client.lock().await;
                            if let Some(retry_stream) = retry_guard.as_mut() {
                                match retry_stream.mlsd(Some(&normalized_path)).await {
                                    Ok(files) => {
                                        let mut items = Vec::new();
                                        for file_str in &files {
                                            if let Some((name, size, is_directory, date_str, permissions)) = parse_ftp_list_line(file_str) {
                                                 let full_path = if normalized_path == "/" { format!("/{}", name) } else { format!("{}/{}", normalized_path.trim_end_matches('/'), name) };
                                                 let size = if is_directory {
                                                     0
                                                 } else {
                                                     size
                                                 };

                                                 let readable_size = if is_directory {
                                                     "".to_string()
                                                 } else {
                                                     format_bytes(size)
                                                 };

                                                 items.push(FileItem {
                                                    name: name.clone(),
                                                    full_path, 
                                                    size,
                                                    modified: None,
                                                    is_directory,
                                                    readable_size,
                                                    readable_modified: date_str,
                                                    permissions,
                                                });
                                            }
                                        }
                                        
                                        let mut path_guard = state.current_path.lock().await;
                                        *path_guard = normalized_path;

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
                        let is_dir = metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false);
                        let name = entry.file_name().to_string_lossy().to_string();
                        let full_path = entry.path().to_string_lossy().to_string();

                        let size = if is_dir {
                            0
                        } else {
                            let s = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
                            s
                        };
                        
                        let readable_size = if is_dir {
                            "".to_string()
                        } else {
                            format_bytes(size)
                        };

                        let modified: Option<DateTime<Utc>> = metadata
                            .and_then(|m| m.modified().ok())
                            .map(|t| t.into());
                        
                        let permissions = if is_dir { "drwxrwxrwx".to_string() } else { "-rw-rw-rw-".to_string() };

                        items.push(FileItem {
                            name,
                            full_path,
                            size,
                            modified,
                            is_directory: is_dir,
                            readable_size,
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

#[tauri::command]
pub async fn get_recent_folders() -> Result<CommandResult<Vec<RecentFolder>>, String> {
    let result = tokio::task::spawn_blocking(move || {
        let mut recent = Vec::new();

        #[cfg(target_os = "windows")]
        {
            let mut cmd = std::process::Command::new("powershell");
            cmd.arg("-NoProfile")
               .arg("-WindowStyle")
               .arg("Hidden")
               .arg("-Command")
               .arg("$sh = New-Object -ComObject WScript.Shell; Get-ChildItem \"$env:APPDATA\\Microsoft\\Windows\\Recent\" -Filter *.lnk | ForEach-Object { try { $target = $sh.CreateShortcut($_.FullName).TargetPath; if (Test-Path $target -PathType Container) { $target } } catch {} } | Select-Object -Unique | Select-Object -First 15");
            
            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                cmd.creation_flags(0x08000000);
            }
            
            let output = cmd.output();

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
