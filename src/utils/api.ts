import { invoke } from "@tauri-apps/api/core";

export interface FileItem {
    name: string;
    full_path: string;
    size: number;
    modified: string | null;
    is_directory: boolean;
    readable_size: string;
    readable_modified: string;
    permissions: string;
}

export interface CommandResult<T> {
    success: boolean;
    data: T | null;
    error: string | null;
}

export interface RecentFolder {
    name: string;
    path: string;
}

export const ftp = {
    connect: (host: string, port: number, username?: string, password?: string) =>
        invoke<CommandResult<string>>("connect", { host, port, username, password }),

    disconnect: () => invoke<void>("disconnect"),

    listRemoteFiles: (path: string) =>
        invoke<CommandResult<FileItem[]>>("list_remote_files", { path }),

    listLocalFiles: (path: string) =>
        invoke<CommandResult<FileItem[]>>("list_local_files", { path }),

    getInitialLocalPath: () => invoke<string>("get_initial_local_path"),

    saveLastLocalPath: (path: string) => invoke<void>("save_last_local_path", { path }),

    getRecentFolders: () => invoke<CommandResult<RecentFolder[]>>("get_recent_folders"),

    deleteFile: (path: string, isRemote: boolean) =>
        invoke<CommandResult<void>>("delete_file", { path, isRemote }),

    renameFile: (oldPath: string, newPath: string, isRemote: boolean) =>
        invoke<CommandResult<void>>("rename_file", { oldPath, newPath, isRemote }),

    uploadFile: (localPath: string, remotePath: string) =>
        invoke<CommandResult<void>>("upload_file", { localPath, remotePath }),

    downloadFile: (remotePath: string, localPath: string) =>
        invoke<CommandResult<void>>("download_file", { remotePath, localPath }),

    moveFile: (sourcePath: string, destPath: string, isRemoteSource: boolean) =>
        invoke<CommandResult<void>>("move_file", { sourcePath, destPath, isRemoteSource }),

    createDirectory: (path: string, isRemote: boolean) =>
        invoke<CommandResult<void>>("create_directory", { path, isRemote }),

    createFile: (path: string, isRemote: boolean) =>
        invoke<CommandResult<void>>("create_file", { path, isRemote }),

    readTextFile: (path: string, isRemote: boolean) =>
        invoke<CommandResult<string>>("read_text_file", { path, isRemote }),

    writeTextFile: (path: string, content: string, isRemote: boolean) =>
        invoke<CommandResult<void>>("write_text_file", { path, content, isRemote }),

    readBinaryFile: (path: string, isRemote: boolean) =>
        invoke<CommandResult<number[]>>("read_binary_file", { path, isRemote }),
};
