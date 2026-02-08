mod models;
mod utils;
mod commands;
mod reconnect;

use crate::models::FtpState;
use crate::commands::*;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(FtpState::default())
        .invoke_handler(tauri::generate_handler![
            connect, 
            disconnect, 
            list_remote_files,
            list_local_files,
            get_initial_local_path,
            save_last_local_path,
            get_recent_folders,
            delete_file,
            rename_file,
            upload_file,
            download_file,
            move_file,
            create_directory,
            create_file,
            read_text_file,
            write_text_file,
            read_binary_file,
            run_executable
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            
            window.eval("
                document.addEventListener('keydown', function(e) {
                    if ((e.ctrlKey && (e.key === 'f' || e.key === 'F')) || 
                        e.key === 'F3' || 
                        (e.ctrlKey && (e.key === 'h' || e.key === 'H')) || 
                        (e.ctrlKey && (e.key === 'p' || e.key === 'P')) ||
                        (e.ctrlKey && (e.key === 'g' || e.key === 'G')) ||
                        e.key === 'F12') {
                        e.preventDefault();
                        e.stopPropagation();
                        return false;
                    }
                });
                
                document.addEventListener('contextmenu', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                });
            ").unwrap();
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
