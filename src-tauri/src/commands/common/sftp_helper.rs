use crate::models::FtpState;
use crate::sftp_ops::SftpClient;
use tauri::State;
pub async fn get_or_create_sftp_client(state: &State<'_, FtpState>) -> Result<SftpClient, String> {
    {
        let sftp_session_guard = state.sftp_session.lock().await;
        let sftp_tcp_guard = state.sftp_tcp.lock().await;
        
        if sftp_session_guard.is_some() && sftp_tcp_guard.is_some() {
        }
    }

    let conn_info_guard = state.connection_info.lock().await;
    let conn_info = conn_info_guard.as_ref()
        .ok_or("No connection info available")?
        .clone();
    drop(conn_info_guard);
    SftpClient::connect(&conn_info.host, conn_info.port, &conn_info.username, &conn_info.password)
}
