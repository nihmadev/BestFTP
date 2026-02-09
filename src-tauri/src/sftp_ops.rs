use ssh2::Session;
use std::net::TcpStream;
use std::path::Path;
use std::time;
use std::io::Write;
use crate::models::FileItem;
use chrono::{DateTime, Utc};
use crate::utils::format_bytes;

pub struct SftpClient {
    session: Session,
    _tcp: TcpStream,
}

impl SftpClient {
    pub fn connect(host: &str, port: u16, username: &str, password: &str) -> Result<Self, String> {
        let tcp = TcpStream::connect(format!("{}:{}", host, port))
            .map_err(|e| format!("Failed to connect to {}:{}: {}", host, port, e))?;
        tcp.set_read_timeout(Some(time::Duration::from_secs(30)))
            .map_err(|e| format!("Failed to set read timeout: {}", e))?;
        tcp.set_write_timeout(Some(time::Duration::from_secs(30)))
            .map_err(|e| format!("Failed to set write timeout: {}", e))?;

        let mut session = Session::new()
            .map_err(|e| format!("Failed to create SSH session: {}", e))?;

        session.set_tcp_stream(tcp.try_clone().map_err(|e| format!("Failed to clone TCP stream: {}", e))?);
        
        session.handshake()
            .map_err(|e| format!("SSH handshake failed: {}", e))?;

        session.userauth_password(username, password)
            .map_err(|e| format!("Authentication failed: {}", e))?;

        Ok(SftpClient { session, _tcp: tcp })
    }

    
    pub fn list_directory(&self, path: &str) -> Result<Vec<FileItem>, String> {
        let sftp = self.session.sftp()
            .map_err(|e| format!("Failed to create SFTP session: {}", e))?;

        let mut items = Vec::new();
        
        let path_obj = Path::new(path);
        match sftp.stat(path_obj) {
            Ok(stat) => {
                if !stat.is_dir() {
                    return Err(format!("Path '{}' is not a directory", path));
                }
            },
            Err(e) => {
                return Err(format!("Failed to access path '{}': {}", path, e));
            }
        }
        
        match sftp.readdir(path_obj) {
            Ok(entries) => {
                for (path, stat) in entries {
                    let name = path.file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("")
                        .to_string();

                    if name.is_empty() || name == "." || name == ".." {
                        continue;
                    }

                    let full_path = path.to_string_lossy().to_string();
                    let is_directory = stat.is_dir();
                    let size = if is_directory {
                        0
                    } else {
                        stat.size.unwrap_or(0) as u64
                    };

                    let readable_size = if is_directory {
                        "".to_string()
                    } else {
                        format_bytes(size)
                    };
                    
                    let modified = stat.mtime
                        .and_then(|m| DateTime::from_timestamp(m.try_into().unwrap(), 0));

                    let readable_modified = modified
                        .map(|dt: DateTime<Utc>| dt.format("%Y-%m-%d %H:%M").to_string())
                        .unwrap_or_default();

                    let permissions = format!("{:o}", stat.perm.unwrap_or(0));

                    items.push(FileItem {
                        name,
                        full_path,
                        size,
                        modified,
                        is_directory,
                        readable_size,
                        readable_modified,
                        permissions,
                    });
                }
                Ok(items)
            }
            Err(e) => {
                let error_msg = e.to_string();
                if error_msg.contains("invalid syntax") || error_msg.contains("protocol error") {
                    Err(format!("SFTP server protocol error: {}. The server may have compatibility issues. Try using FTP instead.", error_msg))
                } else {
                    Err(format!("Failed to list directory '{}': {}", path, error_msg))
                }
            }
        }
    }

    pub fn create_directory(&self, path: &str) -> Result<(), String> {
        let sftp = self.session.sftp()
            .map_err(|e| format!("Failed to create SFTP session: {}", e))?;

        sftp.mkdir(Path::new(path), 0o755)
            .map_err(|e| format!("Failed to create directory: {}", e))?;

        Ok(())
    }

    pub fn remove_file(&self, path: &str) -> Result<(), String> {
        let sftp = self.session.sftp()
            .map_err(|e| format!("Failed to create SFTP session: {}", e))?;

        sftp.unlink(Path::new(path))
            .map_err(|e| format!("Failed to remove file: {}", e))?;

        Ok(())
    }

    pub fn remove_directory(&self, path: &str) -> Result<(), String> {
        let sftp = self.session.sftp()
            .map_err(|e| format!("Failed to create SFTP session: {}", e))?;

        sftp.rmdir(Path::new(path))
            .map_err(|e| format!("Failed to remove directory: {}", e))?;

        Ok(())
    }

    pub fn rename_file(&self, src: &str, dst: &str) -> Result<(), String> {
        let sftp = self.session.sftp()
            .map_err(|e| format!("Failed to create SFTP session: {}", e))?;

        sftp.rename(Path::new(src), Path::new(dst), None)
            .map_err(|e| format!("Failed to rename file: {}", e))?;

        Ok(())
    }

    pub fn upload_file(&self, local_path: &str, remote_path: &str) -> Result<(), String> {
        let sftp = self.session.sftp()
            .map_err(|e| format!("Failed to create SFTP session: {}", e))?;

        let mut local_file = std::fs::File::open(local_path)
            .map_err(|e| format!("Failed to open local file: {}", e))?;

        let mut remote_file = sftp.create(Path::new(remote_path))
            .map_err(|e| format!("Failed to create remote file: {}", e))?;

        std::io::copy(&mut local_file, &mut remote_file)
            .map_err(|e| format!("Failed to copy file content: {}", e))?;

        Ok(())
    }

    pub fn download_file(&self, remote_path: &str, local_path: &str) -> Result<(), String> {
        let sftp = self.session.sftp()
            .map_err(|e| format!("Failed to create SFTP session: {}", e))?;

        let remote_path_obj = Path::new(remote_path);
        match sftp.stat(remote_path_obj) {
            Ok(stat) => {
                if stat.is_dir() {
                    return Err(format!("Path '{}' is a directory, not a file", remote_path));
                }
            },
            Err(e) => {
                return Err(format!("Remote file '{}' does not exist or cannot be accessed: {}", remote_path, e));
            }
        }

        let mut remote_file = sftp.open(remote_path_obj)
            .map_err(|e| {
                let error_msg = e.to_string();
                if error_msg.contains("invalid syntax") || error_msg.contains("protocol error") {
                    format!("SFTP server protocol error while opening file '{}': {}. The server may have compatibility issues.", remote_path, error_msg)
                } else {
                    format!("Failed to open remote file '{}': {}", remote_path, error_msg)
                }
            })?;

        let mut local_file = std::fs::File::create(local_path)
            .map_err(|e| format!("Failed to create local file '{}': {}", local_path, e))?;

        use std::io::Read;
        let mut buffer = [0; 8192];
        
        loop {
            match remote_file.read(&mut buffer) {
                Ok(0) => break,
                Ok(bytes_read) => {
                    local_file.write_all(&buffer[..bytes_read])
                        .map_err(|e| format!("Failed to write to local file: {}", e))?;
                }
                Err(e) => {
                    let error_msg = e.to_string();
                    if error_msg.contains("invalid syntax") || error_msg.contains("protocol error") {
                        return Err(format!("SFTP server protocol error during file read: {}. The server may have compatibility issues.", error_msg));
                    } else {
                        return Err(format!("Failed to read from remote file: {}", error_msg));
                    }
                }
            }
        }

        Ok(())
    }

    pub fn create_empty_file(&self, path: &str) -> Result<(), String> {
        let sftp = self.session.sftp()
            .map_err(|e| format!("Failed to create SFTP session: {}", e))?;

        let mut file = sftp.create(Path::new(path))
            .map_err(|e| format!("Failed to create remote file: {}", e))?;
        use std::io::Write;
        file.write_all(b"")
            .map_err(|e| format!("Failed to write empty content: {}", e))?;

        Ok(())
    }
}
