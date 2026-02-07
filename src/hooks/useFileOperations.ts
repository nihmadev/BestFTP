import { useState, useCallback } from "react";
import { ftp, FileItem } from "../utils/api";

export function useFileOperations(
    localPath: string,
    remotePath: string,
    loadLocal: (path: string) => void,
    loadRemote: (path: string) => void,
    addToast: (msg: string, type?: any) => void,
    onFileOpen: (file: FileItem, isRemote: boolean) => void
) {
    const [showRenameDialog, setShowRenameDialog] = useState<{ file: FileItem, isRemote: boolean } | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState<{ files: FileItem[], isRemote: boolean } | null>(null);
    const [showCreateDialog, setShowCreateDialog] = useState<{ type: 'file' | 'directory' | 'directory_open', isRemote: boolean } | null>(null);
    const [newName, setNewName] = useState("");
    const [lastAction, setLastAction] = useState<{ type: 'rename', oldPath: string, newPath: string, isRemote: boolean } | null>(null);

    const handleConfirmCreate = useCallback(async () => {
        if (!showCreateDialog || !newName) {
            setShowCreateDialog(null);
            setNewName("");
            return;
        }

        const { type, isRemote } = showCreateDialog;
        const currentPath = isRemote ? remotePath : localPath;
        const separator = isRemote ? '/' : '\\';
        const fullPath = `${currentPath.replace(/[\\/]$/, '')}${separator}${newName}`;

        try {
            let result;
            if (type === 'file') {
                result = await ftp.createFile(fullPath, isRemote);
            } else {
                result = await ftp.createDirectory(fullPath, isRemote);
            }

            if (result.success) {
                addToast(`${type === 'file' ? 'File' : 'Directory'} created`, 'success');
                if (isRemote) {
                    await loadRemote(remotePath);
                    if (type === 'directory_open') {
                        loadRemote(fullPath);
                    }
                } else {
                    await loadLocal(localPath);
                    if (type === 'directory_open') {
                        loadLocal(fullPath);
                    }
                }
            } else {
                addToast(result.error || "Failed to create", 'error');
            }
        } catch (e) {
            addToast(String(e), 'error');
        } finally {
            setShowCreateDialog(null);
            setNewName("");
        }
    }, [showCreateDialog, newName, localPath, remotePath, loadLocal, loadRemote, addToast]);

    const handleConfirmRename = useCallback(async () => {
        if (!showRenameDialog || !newName || newName === showRenameDialog.file.name) {
            setShowRenameDialog(null);
            return;
        }

        const { file, isRemote } = showRenameDialog;
        const parentPath = file.full_path.substring(0, file.full_path.lastIndexOf(isRemote ? '/' : '\\'));
        const separator = isRemote ? '/' : '\\';
        const newPath = `${parentPath}${separator}${newName}`;

        try {
            const result = await ftp.renameFile(file.full_path, newPath, isRemote);
            if (result.success) {
                addToast(`Renamed to ${newName}`, 'success');
                setLastAction({ type: 'rename', oldPath: file.full_path, newPath: newPath, isRemote });
                if (isRemote) loadRemote(remotePath);
                else loadLocal(localPath);
            } else {
                addToast(result.error || "Failed to rename", 'error');
            }
        } catch (e) {
            addToast(String(e), 'error');
        } finally {
            setShowRenameDialog(null);
        }
    }, [showRenameDialog, newName, localPath, remotePath, loadLocal, loadRemote, addToast]);

    const handleConfirmDelete = useCallback(async () => {
        if (!showDeleteDialog) return;

        const { files, isRemote } = showDeleteDialog;
        let successCount = 0;
        let errors = [];

        for (const file of files) {
            try {
                const result = await ftp.deleteFile(file.full_path, isRemote);
                if (result.success) {
                    successCount++;
                } else {
                    errors.push(result.error);
                }
            } catch (e) {
                errors.push(String(e));
            }
        }

        if (successCount > 0) {
            addToast(`Deleted ${successCount} item(s)`, 'success');
            if (isRemote) loadRemote(remotePath);
            else loadLocal(localPath);
        }

        if (errors.length > 0) {
            addToast(`Failed to delete ${errors.length} item(s)`, 'error');
        }

        setShowDeleteDialog(null);
    }, [showDeleteDialog, localPath, remotePath, loadLocal, loadRemote, addToast]);

    const handleFileAction = useCallback(async (action: 'open' | 'download' | 'delete' | 'rename' | 'properties' | 'move', file: FileItem, isRemote: boolean) => {
        switch (action) {
            case 'open':
                if (file.is_directory) {
                    if (isRemote) loadRemote(file.full_path);
                    else loadLocal(file.full_path);
                } else {
                    onFileOpen(file, isRemote);
                }
                break;
            case 'delete':
                setShowDeleteDialog({ files: [file], isRemote });
                break;
            case 'rename':
                setNewName(file.name);
                setShowRenameDialog({ file, isRemote });
                break;
            case 'download':
                if (isRemote) {
                    const targetPath = `${localPath}${localPath.endsWith('\\') ? '' : '\\'}${file.name}`;
                    addToast(`Downloading ${file.name}...`, 'info');
                    const res = await ftp.downloadFile(file.full_path, targetPath);
                    if (res.success) {
                        addToast("Download complete", 'success');
                        loadLocal(localPath);
                    } else {
                        addToast(res.error || "Download failed", 'error');
                    }
                } else {
                    const targetPath = `${remotePath}${remotePath.endsWith('/') ? '' : '/'}${file.name}`;
                    addToast(`Uploading ${file.name}...`, 'info');
                    const res = await ftp.uploadFile(file.full_path, targetPath);
                    if (res.success) {
                        addToast("Upload complete", 'success');
                        loadRemote(remotePath);
                    } else {
                        addToast(res.error || "Upload failed", 'error');
                    }
                }
                break;
            case 'move':
                if (isRemote) {
                    const targetPath = `${localPath}${localPath.endsWith('\\') ? '' : '\\'}${file.name}`;
                    addToast(`Moving ${file.name} to local...`, 'info');
                    const res = await ftp.moveFile(file.full_path, targetPath, true);
                    if (res.success) {
                        addToast("Move complete", 'success');
                        loadRemote(remotePath);
                        loadLocal(localPath);
                    } else {
                        addToast(res.error || "Move failed", 'error');
                    }
                } else {
                    const targetPath = `${remotePath}${remotePath.endsWith('/') ? '' : '/'}${file.name}`;
                    addToast(`Moving ${file.name} to remote...`, 'info');
                    const res = await ftp.moveFile(file.full_path, targetPath, false);
                    if (res.success) {
                        addToast("Move complete", 'success');
                        loadLocal(localPath);
                        loadRemote(remotePath);
                    } else {
                        addToast(res.error || "Move failed", 'error');
                    }
                }
                break;
            case 'properties':
                addToast(`Path: ${file.full_path} | Size: ${file.readable_size}`, 'info');
                break;
        }
    }, [localPath, remotePath, loadLocal, loadRemote, addToast, onFileOpen]);

    const undoRename = useCallback(async () => {
        if (lastAction && lastAction.type === 'rename') {
            const res = await ftp.renameFile(lastAction.newPath, lastAction.oldPath, lastAction.isRemote);
            if (res.success) {
                addToast("Undo: Renamed back", 'success');
                setLastAction(null);
                if (lastAction.isRemote) loadRemote(remotePath);
                else loadLocal(localPath);
            } else {
                addToast("Undo failed", 'error');
            }
        } else {
            addToast("Nothing to undo", 'info');
        }
    }, [lastAction, localPath, remotePath, loadLocal, loadRemote, addToast]);

    return {
        showRenameDialog, setShowRenameDialog,
        showDeleteDialog, setShowDeleteDialog,
        showCreateDialog, setShowCreateDialog,
        newName, setNewName,
        handleConfirmRename,
        handleConfirmDelete,
        handleConfirmCreate,
        handleFileAction,
        undoRename,
        lastAction
    };
}
