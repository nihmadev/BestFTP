use std::sync::Arc;
use tokio::sync::Mutex;
use suppaftp::AsyncFtpStream;
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};

#[derive(Clone)]
pub struct ConnectionInfo {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
}

#[derive(Default)]
pub struct FtpState {
    pub client: Arc<Mutex<Option<AsyncFtpStream>>>,
    pub current_path: Arc<Mutex<String>>,
    pub connection_info: Arc<Mutex<Option<ConnectionInfo>>>,
}

#[derive(Serialize, Clone)]
pub struct FileItem {
    pub name: String,
    pub full_path: String,
    pub size: u64,
    pub modified: Option<DateTime<Utc>>,
    pub is_directory: bool,
    pub readable_size: String,
    pub readable_modified: String,
    pub permissions: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RecentFolder {
    pub name: String,
    pub path: String,
}

#[derive(Serialize)]
pub struct CommandResult<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}
