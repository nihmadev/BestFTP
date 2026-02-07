use suppaftp::AsyncFtpStream;
use crate::models::ConnectionInfo;

pub async fn reconnect_with_retry(
    conn_info: &ConnectionInfo,
    max_attempts: u32,
) -> Result<AsyncFtpStream, String> {
    let mut attempt = 0;
    let mut last_error = String::new();

    while attempt < max_attempts {
        attempt += 1;
        
        if attempt > 1 {
            let delay_ms = 1000 * (2_u64.pow(attempt - 2));
            tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms.min(10000))).await;
        }

        let addr = format!("{}:{}", conn_info.host, conn_info.port);
        
        match AsyncFtpStream::connect(&addr).await {
            Ok(mut stream) => {
                match stream.login(&conn_info.username, &conn_info.password).await {
                    Ok(_) => {
                        let _ = stream.transfer_type(suppaftp::types::FileType::Binary).await;
                        return Ok(stream);
                    }
                    Err(e) => {
                        last_error = format!("Login failed on attempt {}: {}", attempt, e);
                    }
                }
            }
            Err(e) => {
                last_error = format!("Connection failed on attempt {}: {}", attempt, e);
            }
        }
    }

    Err(format!("Failed to reconnect after {} attempts. Last error: {}", max_attempts, last_error))
}

pub async fn is_connection_alive(stream: &mut AsyncFtpStream) -> bool {
    stream.noop().await.is_ok()
}
