use tauri::{AppHandle, Emitter};
use std::time::Instant;
use std::pin::Pin;
use std::task::{Context, Poll};
use futures_lite::io::AsyncRead;
use crate::utils::format_bytes;

#[derive(Clone, serde::Serialize)]
pub struct UploadProgress {
    pub file_name: String,
    pub progress: f64,
    pub speed: String,
    pub total: u64,
    pub transferred: u64,
}

pub struct ProgressReader<R> {
    pub inner: R,
    pub app_handle: AppHandle,
    pub file_name: String,
    pub total_size: u64,
    pub bytes_read: u64,
    pub start_time: Instant,
    pub last_emit_time: Instant,
}

impl<R: AsyncRead + Unpin> AsyncRead for ProgressReader<R> {
    fn poll_read(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut [u8],
    ) -> Poll<std::io::Result<usize>> {
        let poll = Pin::new(&mut self.inner).poll_read(cx, buf);
        if let Poll::Ready(Ok(n)) = poll {
            if n > 0 {
                self.bytes_read += n as u64;
                let now = Instant::now();
                if now.duration_since(self.last_emit_time).as_millis() > 50 || self.bytes_read as usize == n { 
                    let duration = now.duration_since(self.start_time).as_secs_f64();
                    let speed_bps = if duration > 0.0 { self.bytes_read as f64 / duration } else { 0.0 };
                    let progress = if self.total_size > 0 { (self.bytes_read as f64 / self.total_size as f64) * 100.0 } else { 0.0 };
                    
                     let payload = UploadProgress {
                        file_name: self.file_name.clone(),
                        progress,
                        speed: format!("{}/s", format_bytes(speed_bps as u64)),
                        total: self.total_size,
                        transferred: self.bytes_read
                    };
                    
                    let _ = self.app_handle.emit("upload-progress", payload);
                    self.last_emit_time = now;
                }
            } else {
                 let payload = UploadProgress {
                    file_name: self.file_name.clone(),
                    progress: 100.0,
                    speed: "Done".to_string(),
                    total: self.total_size,
                    transferred: self.total_size
                };
                let _ = self.app_handle.emit("upload-progress", payload);
            }
        }
        poll
    }
}
