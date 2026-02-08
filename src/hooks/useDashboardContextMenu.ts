
import { useState, useRef, useEffect, useCallback } from 'react';
import { FileItem } from '../utils/api';

export const useDashboardContextMenu = (
    loadLocal: (path: string) => Promise<void>,
    loadRemote: (path: string) => Promise<void>,
    localPath: string,
    remotePath: string,
    setShowCreateDialog: (value: { type: 'file' | 'directory' | 'directory_open'; isRemote: boolean } | null) => void,
    setShowDeleteDialog: (value: { files: FileItem[]; isRemote: boolean } | null) => void,
    setShowPropertiesDialog: (file: FileItem | null) => void,
    handleFileAction: (action: "open" | "rename" | "delete" | "download" | "properties" | "run" | "move", file: FileItem, isRemote: boolean) => Promise<void>,
    selectedLocalPaths: Set<string>,
    selectedRemotePaths: Set<string>,
    localFiles: FileItem[],
    remoteFiles: FileItem[]
) => {
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        file: FileItem | null;
        isRemote: boolean;
    } | null>(null);

    const contextMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
                setContextMenu(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const onFileContextMenu = useCallback((e: React.MouseEvent, file: FileItem, isRemote: boolean) => {
        e.preventDefault();
        if (file.name === "..") return;

        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            file: file,
            isRemote: isRemote
        });
    }, []);

    const onEmptyContextMenu = useCallback((e: React.MouseEvent, isRemote: boolean) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            file: null,
            isRemote: isRemote
        });
    }, []);

    const handleAction = (action: string, file: FileItem | null, isRemote: boolean) => {
        setContextMenu(null);

        if (!file) {
            if (action === 'refresh') {
                if (isRemote) loadRemote(remotePath);
                else loadLocal(localPath);
            } else if (action === 'create_dir') {
                setShowCreateDialog({ type: 'directory', isRemote });
            } else if (action === 'create_dir_open') {
                setShowCreateDialog({ type: 'directory_open', isRemote });
            } else if (action === 'create_file') {
                setShowCreateDialog({ type: 'file', isRemote });
            }
            return;
        }

        const selectedPaths = isRemote ? selectedRemotePaths : selectedLocalPaths;
        const files = isRemote ? remoteFiles : localFiles;
        const selectedFiles = files.filter(f => selectedPaths.has(f.full_path));

        if (action === 'delete' && selectedFiles.length > 1 && selectedPaths.has(file.full_path)) {
            setShowDeleteDialog({ files: selectedFiles, isRemote });
        } else if (action === 'properties') {
            setShowPropertiesDialog(file);
        } else {
            handleFileAction(action as any, file, isRemote);
        }
    };

    return {
        contextMenu,
        contextMenuRef,
        onFileContextMenu,
        onEmptyContextMenu,
        handleAction
    }
};
