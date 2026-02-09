use tauri::State;
use std::path::Path;
use async_recursion::async_recursion;
use ignore::WalkBuilder;
use crate::models::{FtpState, FileItem, CommandResult, ConnectionProtocol};
use crate::utils::{format_bytes, parse_ftp_list_line};
use crate::commands::common::{normalize_remote_path, get_or_reconnect_stream};
use crate::commands::common::sftp_helper::get_or_create_sftp_client;

#[tauri::command]
pub async fn search_files(
    state: State<'_, FtpState>,
    path: String,
    query: String,
    is_remote: bool,
    _recursive: bool,
) -> Result<CommandResult<Vec<FileItem>>, String> {
    if is_remote {
        search_remote(state, path, query, true).await
    } else {
        search_local(path, query, true).await
    }
}

async fn search_local(path: String, query: String, recursive: bool) -> Result<CommandResult<Vec<FileItem>>, String> {
    let result = tokio::task::spawn_blocking(move || {
        let mut items = Vec::new();
        let path_obj = Path::new(&path);
        
        if !path_obj.exists() {
            return Err("Path does not exist".to_string());
        }

        if recursive {
            let walker = WalkBuilder::new(path_obj)
                .hidden(false)
                .git_ignore(true)
                .build();

            for entry in walker.filter_map(|e| e.ok()) {
                let file_name = entry.file_name();
                let name_cow = file_name.to_string_lossy();
                let name = name_cow.as_ref();
                
                if name == ".." || name == "." { continue; }
                
                if matches_query(name, &query) {
                    let is_directory = entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false);
                    let metadata = entry.metadata().ok();
                    let size = if is_directory { 0 } else { metadata.as_ref().map(|m| m.len()).unwrap_or(0) };
                    let modified = metadata.as_ref().and_then(|m| m.modified().ok()).map(|t| t.into());
                    
                    items.push(FileItem {
                        name: name.to_string(),
                        full_path: entry.path().to_string_lossy().to_string(),
                        size,
                        modified,
                        is_directory,
                        readable_size: if is_directory { "".to_string() } else { format_bytes(size) },
                        readable_modified: modified.map(|m| m.format("%Y-%m-%d %H:%M:%S").to_string()).unwrap_or_default(),
                        permissions: "".to_string(),
                    });
                }
            }
        } else {
            if let Ok(entries) = std::fs::read_dir(path_obj) {
                for entry in entries.filter_map(|e| e.ok()) {
                    let file_name = entry.file_name();
                    let name_cow = file_name.to_string_lossy();
                    let name = name_cow.as_ref();
                    if matches_query(name, &query) {
                        if let Ok(metadata) = entry.metadata() {
                            let is_directory = metadata.is_dir();
                            let size = if is_directory { 0 } else { metadata.len() };
                            let modified = metadata.modified().ok().map(|t| t.into());
                            
                            items.push(FileItem {
                                name: name.to_string(),
                                full_path: entry.path().to_string_lossy().to_string(),
                                size,
                                modified,
                                is_directory,
                                readable_size: if is_directory { "".to_string() } else { format_bytes(size) },
                                readable_modified: modified.map(|m| m.format("%Y-%m-%d %H:%M:%S").to_string()).unwrap_or_default(),
                                permissions: "".to_string(),
                            });
                        }
                    }
                }
            }
        }
        Ok(items)
    }).await.map_err(|e| e.to_string())?;

    match result {
        Ok(items) => Ok(CommandResult { success: true, data: Some(items), error: None }),
        Err(e) => Ok(CommandResult { success: false, data: None, error: Some(e) }),
    }
}

async fn search_remote(state: State<'_, FtpState>, path: String, query: String, recursive: bool) -> Result<CommandResult<Vec<FileItem>>, String> {
    let normalized_path = normalize_remote_path(&path);
    let conn_info_guard = state.connection_info.lock().await;
    let protocol = conn_info_guard.as_ref().map(|c| c.protocol.clone());
    drop(conn_info_guard);

    match protocol {
        Some(ConnectionProtocol::SFTP) => {
            match get_or_create_sftp_client(&state).await {
                Ok(sftp_client) => {
                    let mut items = Vec::new();
                    if recursive {
                        search_sftp_recursive(&sftp_client, &normalized_path, &query, &mut items)?;
                    } else {
                        match sftp_client.list_directory(&normalized_path) {
                            Ok(remote_items) => {
                                for item in remote_items {
                                    if matches_query(&item.name, &query) {
                                        items.push(item);
                                    }
                                }
                            },
                            Err(e) => return Ok(CommandResult { success: false, data: None, error: Some(e.to_string()) }),
                        }
                    }
                    Ok(CommandResult { success: true, data: Some(items), error: None })
                },
                Err(e) => Ok(CommandResult { success: false, data: None, error: Some(e) }),
            }
        }
        Some(ConnectionProtocol::FTP) | None => {
            if let Err(e) = get_or_reconnect_stream(&state).await {
                return Ok(CommandResult { success: false, data: None, error: Some(e) });
            }
            
            let mut items = Vec::new();
            if recursive {
                search_ftp_recursive(&state, normalized_path, &query, &mut items).await?;
            } else {
                let mut client_guard = state.ftp_client.lock().await;
                if let Some(stream) = client_guard.as_mut() {
                    match stream.mlsd(Some(&normalized_path)).await {
                        Ok(files) => {
                            for file_str in &files {
                                if let Some((name, size, is_directory, date_str, permissions)) = parse_ftp_list_line(file_str) {
                                    if matches_query(&name, &query) {
                                        let full_path = if normalized_path == "/" { format!("/{}", name) } else { format!("{}/{}", normalized_path.trim_end_matches('/'), name) };
                                        items.push(FileItem {
                                            name,
                                            full_path,
                                            size: if is_directory { 0 } else { size },
                                            modified: None,
                                            is_directory,
                                            readable_size: if is_directory { "".to_string() } else { format_bytes(size) },
                                            readable_modified: date_str,
                                            permissions,
                                        });
                                    }
                                }
                            }
                        },
                        Err(e) => return Ok(CommandResult { success: false, data: None, error: Some(e.to_string()) }),
                    }
                }
            }
            Ok(CommandResult { success: true, data: Some(items), error: None })
        }
    }
}

fn search_sftp_recursive(client: &crate::sftp_ops::SftpClient, path: &str, query: &str, items: &mut Vec<FileItem>) -> Result<(), String> {
    let remote_items = client.list_directory(path).map_err(|e| e.to_string())?;
    for item in remote_items {
        if matches_query(&item.name, query) {
            items.push(item.clone());
        }
        if item.is_directory && item.name != "." && item.name != ".." {
            if !item.name.starts_with('.') || query.starts_with('.') {
                let _ = search_sftp_recursive(client, &item.full_path, query, items);
            }
        }
    }
    Ok(())
}

#[async_recursion]
async fn search_ftp_recursive(state: &State<'_, FtpState>, path: String, query: &str, items: &mut Vec<FileItem>) -> Result<(), String> {
    let mut client_guard = state.ftp_client.lock().await;
    let files = if let Some(stream) = client_guard.as_mut() {
        stream.mlsd(Some(&path)).await.map_err(|e| e.to_string())?
    } else {
        return Err("Not connected".to_string());
    };
    drop(client_guard);

    for file_str in &files {
        if let Some((name, size, is_directory, date_str, permissions)) = parse_ftp_list_line(file_str) {
            if name == "." || name == ".." { continue; }
            
            let full_path = if path == "/" { format!("/{}", name) } else { format!("{}/{}", path.trim_end_matches('/'), name) };
            
            if matches_query(&name, query) {
                items.push(FileItem {
                    name: name.clone(),
                    full_path: full_path.clone(),
                    size: if is_directory { 0 } else { size },
                    modified: None,
                    is_directory,
                    readable_size: if is_directory { "".to_string() } else { format_bytes(size) },
                    readable_modified: date_str,
                    permissions,
                });
            }
            
            if is_directory {
                if !name.starts_with('.') || query.starts_with('.') {
                    let _ = search_ftp_recursive(state, full_path, query, items).await;
                }
            }
        }
    }
    Ok(())
}

fn matches_query(name: &str, query: &str) -> bool {
    if query.is_empty() { return true; }
    if name == ".git" || name == "node_modules" || name == "target" || name == "dist" || name == ".DS_Store" {
        return false;
    }
    
    let name_lower = name.to_lowercase();
    let query_lower = query.to_lowercase();
    let and_groups: Vec<&str> = query_lower.split_whitespace().collect();
    
    if and_groups.is_empty() { return true; }
    
    and_groups.iter().all(|group| {
        let or_options: Vec<&str> = group.split(|c| c == '|' || c == ',').filter(|s| !s.is_empty()).collect();
        
        or_options.iter().any(|option| {
            let trimmed = option.trim();
            if trimmed.is_empty() { return false; }
            if trimmed.starts_with('.') {
                name_lower.ends_with(trimmed)
            } else {
                name_lower.contains(trimmed)
            }
        })
    })
}
