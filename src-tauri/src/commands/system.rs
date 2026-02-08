use std::path::Path;
use crate::models::CommandResult;
use crate::commands::common::normalize_remote_path;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[tauri::command]
pub async fn run_executable(
    path: String,
    is_remote: bool,
) -> Result<CommandResult<String>, String> {
    if is_remote {
        let _normalized_path = normalize_remote_path(&path);
        return Ok(CommandResult {
            success: false,
            data: None,
            error: Some("Remote execution is not supported via FTP".to_string()),
        });
    }

    let result = tokio::task::spawn_blocking(move || {
        let path_obj = Path::new(&path);
        
        if !path_obj.exists() {
            return Err("File does not exist".to_string());
        }

        let extension = path_obj
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext.to_lowercase())
            .unwrap_or_default();

        let is_executable = match std::env::consts::OS {
            "windows" => {
                extension == "exe" || extension == "msi" || extension == "bat" || extension == "cmd" || extension == "html" || extension == "htm"
            },
            "linux" => {
                extension == "sh" || extension == "run" || extension == "bin" || extension == "html" || extension == "htm" ||
                path_obj.file_name().and_then(|n| n.to_str()).unwrap_or("").contains(".appimage")
            },
            "macos" => {
                extension == "app" || extension == "command" || extension == "pkg" || extension == "html" || extension == "htm" ||
                path_obj.file_name().and_then(|n| n.to_str()).unwrap_or("").contains(".app")
            },
            _ => false,
        };

        if !is_executable {
            return Err("File type is not supported for execution".to_string());
        }

        let mut cmd = if extension == "html" || extension == "htm" {
            match std::env::consts::OS {
                "windows" => {
                    let mut c = std::process::Command::new("cmd");
                    c.args(["/C", "start", ""]);
                    c.arg(&path);
                    c
                },
                "linux" => {
                    let mut c = std::process::Command::new("xdg-open");
                    c.arg(&path);
                    c
                },
                "macos" => {
                    let mut c = std::process::Command::new("open");
                    c.arg(&path);
                    c
                },
                _ => return Err("Unsupported OS for opening HTML files".to_string())
            }
        } else {
            match std::env::consts::OS {
                "windows" => {
                    let mut c = std::process::Command::new(if extension == "msi" { "msiexec" } else { &path });
                    if extension == "msi" {
                        c.arg("/i").arg(&path);
                    }
                    c
                },
                "linux" => {
                    if extension == "sh" || path_obj.file_name().and_then(|n| n.to_str()).unwrap_or("").contains(".appimage") {
                         let mut c = std::process::Command::new("sh");
                         c.arg(&path);
                         c
                    } else {
                        std::process::Command::new(&path)
                    }
                },
                "macos" => {
                    if extension == "app" {
                        let mut c = std::process::Command::new("open");
                        c.arg(&path);
                        c
                    } else if extension == "pkg" {
                        let mut c = std::process::Command::new("installer");
                        c.arg("-pkg").arg(&path).arg("-target").arg("/");
                         c
                    } else {
                        std::process::Command::new(&path)
                    }
                },
                _ => std::process::Command::new(&path),
            }
        };

        #[cfg(windows)]
        {
            if extension != "html" && extension != "htm" {
                cmd.creation_flags(0x08000000); 
            }
             if extension == "html" || extension == "htm" {
                 cmd.creation_flags(0x08000000);
             }
        }

        match cmd.spawn() {
            Ok(_) => Ok(format!("Successfully started execution of {}", path_obj.file_name().and_then(|n| n.to_str()).unwrap_or("file"))),
            Err(e) => Err(format!("Failed to execute file: {}", e)),
        }
    }).await.map_err(|e| e.to_string())?;

    match result {
        Ok(message) => Ok(CommandResult {
            success: true,
            data: Some(message),
            error: None,
        }),
        Err(error) => Ok(CommandResult {
            success: false,
            data: None,
            error: Some(error),
        }),
    }
}
