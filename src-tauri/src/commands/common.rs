use crate::models::FtpState;
use crate::reconnect::{reconnect_with_retry, is_connection_alive};

pub fn normalize_remote_path(path: &str) -> String {
    if path.starts_with("http://") || path.starts_with("https://") || path.starts_with("ftp://") {
        if let Some(start) = path.find('/') {
            if let Some(double_slash) = path[start..].find("//") {
                return path[start + double_slash + 1..].to_string();
            } else {
                return path[start..].to_string();
            }
        }
    }
    let parts: Vec<&str> = path.split('/').collect();
    if parts.len() > 1 && parts[0].contains('.') && !parts[0].starts_with('.') {
        let mut result = String::new();
        for (i, part) in parts.iter().enumerate() {
            if i == 0 && part.contains('.') && !part.starts_with('.') {
                continue;
            }
            if !result.is_empty() {
                result.push('/');
            }
            result.push_str(part);
        }
        if result.is_empty() {
            return "/".to_string();
        }
        if !result.starts_with('/') {
            result = format!("/{}", result);
        }
        return result;
    }
    
    path.to_string()
}

pub async fn get_or_reconnect_stream(state: &FtpState) -> Result<(), String> {
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
