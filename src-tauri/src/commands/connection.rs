use tauri::State;
use suppaftp::AsyncFtpStream;
use crate::models::{FtpState, CommandResult, ConnectionInfo, ConnectionProtocol};
use crate::sftp_ops::SftpClient;

#[tauri::command]
pub async fn connect_auto(
    state: State<'_, FtpState>,
    host: String,
    port: u16,
    username: Option<String>,
    password: Option<String>,
) -> Result<CommandResult<String>, String> {
    let user = username.unwrap_or("anonymous".to_string());
    let pass = password.unwrap_or("anonymous@".to_string());

    let protocols_to_try = match port {
        22 => vec!["sftp", "ftp"],
        21 => vec!["ftp", "sftp"],
        990 => vec!["ftp", "sftp"],
        2222 => vec!["sftp", "ftp"],
        _ => vec!["ftp", "sftp"],
    };

    for protocol in protocols_to_try {
        let connection_protocol = match protocol {
            "sftp" => ConnectionProtocol::SFTP,
            _ => ConnectionProtocol::FTP,
        };
        {
            let mut ftp_guard = state.ftp_client.lock().await;
            let mut sftp_session_guard = state.sftp_session.lock().await;
            let mut sftp_tcp_guard = state.sftp_tcp.lock().await;
            
            let _ = ftp_guard.take();
            let _ = sftp_session_guard.take();
            let _ = sftp_tcp_guard.take();
        }

        match connection_protocol {
            ConnectionProtocol::FTP => {
                let mut ftp_guard = state.ftp_client.lock().await;
                let addr = format!("{}:{}", host, port);
                
                match AsyncFtpStream::connect(addr).await {
                    Ok(mut stream) => {
                        if let Err(e) = stream.login(&user, &pass).await {
                            eprintln!("FTP login failed for {}:{}: {}", host, port, e);
                            continue;
                        }

                        let _ = stream.transfer_type(suppaftp::types::FileType::Binary).await;

                        let conn_info = ConnectionInfo {
                            host: host.clone(),
                            port,
                            username: user.clone(),
                            password: pass.clone(),
                            protocol: ConnectionProtocol::FTP,
                        };
                        
                        let mut conn_info_guard = state.connection_info.lock().await;
                        *conn_info_guard = Some(conn_info);

                        *ftp_guard = Some(stream);
                        
                        let mut path_guard = state.current_path.lock().await;
                        *path_guard = "/".to_string();

                        return Ok(CommandResult {
                            success: true,
                            data: Some(format!("FTP Connected successfully (auto-detected)")),
                            error: None,
                        });
                    },
                    Err(e) => {
                        eprintln!("FTP connection failed for {}:{}: {}", host, port, e);
                        if e.to_string().contains("invalid syntax") {
                            continue;
                        }
                        continue;
                    }
                }
            }
            ConnectionProtocol::SFTP => {
                match SftpClient::connect(&host, port, &user, &pass) {
                    Ok(_sftp_client) => {
                        let conn_info = ConnectionInfo {
                            host: host.clone(),
                            port,
                            username: user.clone(),
                            password: pass.clone(),
                            protocol: ConnectionProtocol::SFTP,
                        };
                        
                        let mut conn_info_guard = state.connection_info.lock().await;
                        *conn_info_guard = Some(conn_info);

                        let mut path_guard = state.current_path.lock().await;
                        *path_guard = "/".to_string();

                        return Ok(CommandResult {
                            success: true,
                            data: Some(format!("SFTP Connected successfully (auto-detected)")),
                            error: None,
                        });
                    },
                    Err(e) => {
                        let error_msg = e.to_string();
                        if error_msg.contains("invalid syntax") || error_msg.contains("protocol error") {
                            eprintln!("SFTP protocol error for {}:{}: {} - server may have compatibility issues", host, port, error_msg);
                        } else {
                            eprintln!("SFTP connection failed for {}:{}: {}", host, port, error_msg);
                        }
                        continue;
                    }
                }
            }
        }
    }
    Ok(CommandResult {
        success: false,
        data: None,
        error: Some(format!("Failed to connect using any protocol (tried FTP and SFTP)")),
    })
}

#[tauri::command]
pub async fn connect(
    state: State<'_, FtpState>,
    host: String,
    port: u16,
    username: Option<String>,
    password: Option<String>,
    protocol: Option<String>,
) -> Result<CommandResult<String>, String> {
    let protocol = protocol.unwrap_or("ftp".to_string().to_lowercase());
    let connection_protocol = match protocol.as_str() {
        "sftp" => ConnectionProtocol::SFTP,
        _ => ConnectionProtocol::FTP,
    };
    {
        let mut ftp_guard = state.ftp_client.lock().await;
        let mut sftp_session_guard = state.sftp_session.lock().await;
        let mut sftp_tcp_guard = state.sftp_tcp.lock().await;
        
        let _ = ftp_guard.take();
        let _ = sftp_session_guard.take();
        let _ = sftp_tcp_guard.take();
    }

    let user = username.unwrap_or("anonymous".to_string());
    let pass = password.unwrap_or("anonymous@".to_string());

    match connection_protocol {
        ConnectionProtocol::FTP => {
            let mut ftp_guard = state.ftp_client.lock().await;
            let addr = format!("{}:{}", host, port);
            
            match AsyncFtpStream::connect(addr).await {
                Ok(mut stream) => {
                    if let Err(e) = stream.login(&user, &pass).await {
                        return Ok(CommandResult {
                            success: false,
                            data: None,
                            error: Some(format!("FTP Login failed: {}", e)),
                        });
                    }

                    let _ = stream.transfer_type(suppaftp::types::FileType::Binary).await;

                    let conn_info = ConnectionInfo {
                        host: host.clone(),
                        port,
                        username: user,
                        password: pass,
                        protocol: ConnectionProtocol::FTP,
                    };
                    
                    let mut conn_info_guard = state.connection_info.lock().await;
                    *conn_info_guard = Some(conn_info);

                    *ftp_guard = Some(stream);
                    
                    let mut path_guard = state.current_path.lock().await;
                    *path_guard = "/".to_string();

                    Ok(CommandResult {
                        success: true,
                        data: Some("FTP Connected successfully".to_string()),
                        error: None,
                    })
                },
                Err(e) => Ok(CommandResult {
                    success: false,
                    data: None,
                    error: Some(format!("FTP Connection failed: {}", e)),
                })
            }
        }
        ConnectionProtocol::SFTP => {
            match SftpClient::connect(&host, port, &user, &pass) {
                Ok(_sftp_client) => {
                    let conn_info = ConnectionInfo {
                        host: host.clone(),
                        port,
                        username: user,
                        password: pass,
                        protocol: ConnectionProtocol::SFTP,
                    };
                    
                    let mut conn_info_guard = state.connection_info.lock().await;
                    *conn_info_guard = Some(conn_info);
                    let mut path_guard = state.current_path.lock().await;
                    *path_guard = "/".to_string();

                    Ok(CommandResult {
                        success: true,
                        data: Some("SFTP Connected successfully".to_string()),
                        error: None,
                    })
                },
                Err(e) => Ok(CommandResult {
                    success: false,
                    data: None,
                    error: Some(format!("SFTP Connection failed: {}", e)),
                })
            }
        }
    }
}

#[tauri::command]
pub async fn disconnect(state: State<'_, FtpState>) -> Result<(), String> {
    let mut ftp_guard = state.ftp_client.lock().await;
    if let Some(mut stream) = ftp_guard.take() {
        let _ = stream.quit().await;
    }
    
    let mut sftp_session_guard = state.sftp_session.lock().await;
    let mut sftp_tcp_guard = state.sftp_tcp.lock().await;
    let _ = sftp_session_guard.take();
    let _ = sftp_tcp_guard.take();
    
    let mut conn_info_guard = state.connection_info.lock().await;
    *conn_info_guard = None;
    
    Ok(())
}
