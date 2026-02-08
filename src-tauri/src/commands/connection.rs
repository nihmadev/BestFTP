use tauri::State;
use suppaftp::AsyncFtpStream;
use crate::models::{FtpState, CommandResult, ConnectionInfo};

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
