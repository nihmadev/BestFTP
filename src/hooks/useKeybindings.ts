import { useEffect } from "react";
import { FileItem } from "../utils/api";

interface KeybindingsProps {
    activePane: 'local' | 'remote';
    selectedLocalPaths: Set<string>;
    selectedRemotePaths: Set<string>;
    localFiles: FileItem[];
    remoteFiles: FileItem[];
    setSelectedLocalPaths: (paths: Set<string>) => void;
    setSelectedRemotePaths: (paths: Set<string>) => void;
    setShowDeleteDialog: (val: { files: FileItem[], isRemote: boolean } | null) => void;
    handleFileAction: (action: any, file: FileItem, isRemote: boolean) => void;
    undoRename: () => void;
    goBack: (pane: 'local' | 'remote') => void;
    goForward: (pane: 'local' | 'remote') => void;
}

export function useKeybindings({
    activePane,
    selectedLocalPaths,
    selectedRemotePaths,
    localFiles,
    remoteFiles,
    setSelectedLocalPaths,
    setSelectedRemotePaths,
    setShowDeleteDialog,
    handleFileAction,
    undoRename,
    goBack,
    goForward
}: KeybindingsProps) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement) return;

            const isRemote = activePane === 'remote';
            const selectedPaths = isRemote ? selectedRemotePaths : selectedLocalPaths;
            const files = isRemote ? remoteFiles : localFiles;
            const selectedFiles = files.filter(f => selectedPaths.has(f.full_path));

            if (e.ctrlKey && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                const allPaths = new Set(files.map(f => f.full_path));
                if (isRemote) setSelectedRemotePaths(allPaths);
                else setSelectedLocalPaths(allPaths);
                return;
            }

            if (e.key === 'Delete') {
                if (selectedFiles.length > 0) {
                    setShowDeleteDialog({ files: selectedFiles, isRemote });
                }
                return;
            }

            if (e.key === 'F2') {
                if (selectedFiles.length === 1) {
                    handleFileAction('rename', selectedFiles[0], isRemote);
                }
                return;
            }

            if (e.key === 'F3') {
                if (selectedFiles.length === 1) {
                    handleFileAction('properties', selectedFiles[0], isRemote);
                }
                return;
            }

            if ((e.ctrlKey && e.key.toLowerCase() === 'z') || e.key === 'Insert') {
                undoRename();
                return;
            }
        };

        const handleMouseDown = (e: MouseEvent) => {
            if (e.button === 3) {
                e.preventDefault();
                goBack(activePane);
            } else if (e.button === 4) {
                e.preventDefault();
                goForward(activePane);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('mousedown', handleMouseDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('mousedown', handleMouseDown);
        };
    }, [
        activePane,
        selectedLocalPaths,
        selectedRemotePaths,
        localFiles,
        remoteFiles,
        setSelectedLocalPaths,
        setSelectedRemotePaths,
        setShowDeleteDialog,
        handleFileAction,
        undoRename,
        goBack,
        goForward
    ]);
}
