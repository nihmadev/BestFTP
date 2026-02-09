import { useEffect, useRef } from "react";
import { FileItem } from "../utils/api";

interface KeybindingsProps {
    activePane: 'local' | 'remote';
    setActivePane: (pane: 'local' | 'remote') => void;
    selectedLocalPaths: Set<string>;
    selectedRemotePaths: Set<string>;
    localFiles: FileItem[];
    remoteFiles: FileItem[];
    setSelectedLocalPaths: (paths: Set<string>) => void;
    setSelectedRemotePaths: (paths: Set<string>) => void;
    setShowDeleteDialog: (val: { files: FileItem[], isRemote: boolean } | null) => void;
    setShowCreateDialog: (val: { type: 'file' | 'directory' | 'directory_open', isRemote: boolean } | null) => void;
    handleFileAction: (action: any, file: FileItem, isRemote: boolean) => void;
    handleFileOpen: (file: FileItem, isRemote: boolean) => void;
    undoRename: () => void;
    goBack: (pane: 'local' | 'remote') => void;
    goForward: (pane: 'local' | 'remote') => void;
    loadLocal: (path: string) => void;
    loadRemote: (path: string) => void;
    localPath: string;
    remotePath: string;
    navigateLocalUp: () => void;
    navigateRemoteUp: () => void;
    onDisconnect: () => void;
    toggleSidebar: () => void;
    addToast: (msg: string, type?: any) => void;
}

export function useKeybindings({
    activePane,
    setActivePane,
    selectedLocalPaths,
    selectedRemotePaths,
    localFiles,
    remoteFiles,
    setSelectedLocalPaths,
    setSelectedRemotePaths,
    setShowDeleteDialog,
    setShowCreateDialog,
    handleFileAction,
    handleFileOpen,
    undoRename,
    goBack,
    goForward,
    loadLocal,
    loadRemote,
    localPath,
    remotePath,
    navigateLocalUp,
    navigateRemoteUp,
    onDisconnect,
    toggleSidebar,
    addToast
}: KeybindingsProps) {
    const clipboardRef = useRef<{ files: FileItem[], isRemote: boolean } | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            const isRemote = activePane === 'remote';
            const selectedPaths = isRemote ? selectedRemotePaths : selectedLocalPaths;
            const files = isRemote ? remoteFiles : localFiles;
            const setSelectedPaths = isRemote ? setSelectedRemotePaths : setSelectedLocalPaths;
            
            const selectedFiles = files.filter(f => selectedPaths.has(f.full_path));
            if (e.key === 'Tab') {
                e.preventDefault();
                setActivePane(isRemote ? 'local' : 'remote');
                return;
            }
            if (e.altKey && e.key === '1') {
                e.preventDefault();
                setActivePane('local');
                return;
            }
            if (e.altKey && e.key === '2') {
                e.preventDefault();
                setActivePane('remote');
                return;
            }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (files.length === 0) return;

                let currentIndex = -1;
                if (selectedPaths.size > 0) {
                    const selectedArray = Array.from(selectedPaths);
                    const lastSelectedPath = selectedArray[selectedArray.length - 1];
                    currentIndex = files.findIndex(f => f.full_path === lastSelectedPath);
                }

                let nextIndex = 0;
                if (e.key === 'ArrowDown') {
                    nextIndex = currentIndex + 1;
                    if (nextIndex >= files.length) nextIndex = files.length - 1;
                } else {
                    nextIndex = currentIndex - 1;
                    if (nextIndex < 0) nextIndex = 0;
                }

                const nextFile = files[nextIndex];
                if (nextFile) {
                    if (e.shiftKey) {
                        const newSelected = new Set(selectedPaths);
                        newSelected.add(nextFile.full_path);
                        setSelectedPaths(newSelected);
                    } else {
                        setSelectedPaths(new Set([nextFile.full_path]));
                    }
                    
                    const element = document.querySelector(`[data-path="${CSS.escape(nextFile.full_path)}"]`);
                    if (element) {
                        element.scrollIntoView({ block: 'nearest' });
                    }
                }
                return;
            }
            if (e.key === ' ') {
                e.preventDefault();
                if (selectedFiles.length === 1) {
                    const file = selectedFiles[0];
                    if (file.name === "..") return;

                    const newSelected = new Set(selectedPaths);
                    if (newSelected.has(file.full_path)) {
                        newSelected.delete(file.full_path);
                    } else {
                        newSelected.add(file.full_path);
                    }
                    setSelectedPaths(newSelected);
                }
                return;
            }
            if (e.key === 'PageUp' || e.key === 'PageDown') {
                e.preventDefault();
                if (files.length === 0) return;

                let currentIndex = -1;
                if (selectedPaths.size > 0) {
                    const selectedArray = Array.from(selectedPaths);
                    const lastSelectedPath = selectedArray[selectedArray.length - 1];
                    currentIndex = files.findIndex(f => f.full_path === lastSelectedPath);
                }

                const pageSize = 10;
                let nextIndex = 0;
                if (e.key === 'PageDown') {
                    nextIndex = Math.min(currentIndex + pageSize, files.length - 1);
                } else {
                    nextIndex = Math.max(currentIndex - pageSize, 0);
                }

                const nextFile = files[nextIndex];
                if (nextFile) {
                    setSelectedPaths(new Set([nextFile.full_path]));
                    document.querySelector(`[data-path="${CSS.escape(nextFile.full_path)}"]`)?.scrollIntoView({ block: 'nearest' });
                }
                return;
            }
            if (e.key === 'Home') {
                e.preventDefault();
                if (files.length > 0) {
                    setSelectedPaths(new Set([files[0].full_path]));
                    document.querySelector(`[data-path="${CSS.escape(files[0].full_path)}"]`)?.scrollIntoView({ block: 'nearest' });
                }
                return;
            }
            if (e.key === 'End') {
                e.preventDefault();
                if (files.length > 0) {
                    const lastFile = files[files.length - 1];
                    setSelectedPaths(new Set([lastFile.full_path]));
                    document.querySelector(`[data-path="${CSS.escape(lastFile.full_path)}"]`)?.scrollIntoView({ block: 'nearest' });
                }
                return;
            }
            if (e.key === 'Enter') {
                if (selectedFiles.length === 1) {
                    const file = selectedFiles[0];
                    if (file.is_directory) {
                        if (file.name === "..") {
                            if (isRemote) navigateRemoteUp();
                            else navigateLocalUp();
                        } else {
                            if (isRemote) loadRemote(file.full_path);
                            else loadLocal(file.full_path);
                        }
                    } else {
                        handleFileOpen(file, isRemote);
                    }
                }
                return;
            }
            if (e.key === 'Backspace') {
                e.preventDefault();
                if (isRemote) navigateRemoteUp();
                else navigateLocalUp();
                return;
            }
            if (e.key === 'F5') {
                e.preventDefault();
                if (e.ctrlKey) {
                    if (isRemote) loadRemote(remotePath);
                    else loadLocal(localPath);
                } else {
                    if (selectedFiles.length > 0) {
                        selectedFiles.forEach(file => handleFileAction('download', file, isRemote));
                    } else {
                        if (isRemote) loadRemote(remotePath);
                        else loadLocal(localPath);
                    }
                }
                return;
            }
            if (e.key === 'F6') {
                e.preventDefault();
                if (selectedFiles.length > 0) {
                    selectedFiles.forEach(file => handleFileAction('move', file, isRemote));
                }
                return;
            }
            if (e.key === 'F7') {
                e.preventDefault();
                setShowCreateDialog({ type: 'directory', isRemote });
                return;
            }
             if (e.key === 'F8' || e.key === 'Delete') {
                  if (selectedFiles.length > 0) {
                      setShowDeleteDialog({ files: selectedFiles, isRemote });
                  }
                  return;
              }
              if (e.ctrlKey && (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'с')) {
                  if (selectedFiles.length > 0) {
                      e.preventDefault();
                      clipboardRef.current = { files: selectedFiles, isRemote };
                      addToast(`Copied ${selectedFiles.length} item(s) to internal clipboard`, 'info');
                  }
                  return;
              }
              if (e.ctrlKey && (e.key.toLowerCase() === 'v' || e.key.toLowerCase() === 'м')) {
                  if (clipboardRef.current) {
                      e.preventDefault();
                      const { files: cbFiles, isRemote: cbIsRemote } = clipboardRef.current;
                      if (cbIsRemote !== isRemote) {
                          cbFiles.forEach(file => handleFileAction('download', file, cbIsRemote));
                          addToast(`Starting transfer of ${cbFiles.length} item(s)`, 'info');
                      } else {
                          cbFiles.forEach(file => {
                             // const separator = isRemote ? '/' : '\\';
                             // const parentPath = file.full_path.substring(0, file.full_path.lastIndexOf(separator));
                             // const targetPath = `${parentPath}${separator}Copy_of_${file.name}`;
                              
                              if (!isRemote) {
                                  handleFileAction('copy_local', file, false);
                              } else {
                                  addToast("Copying files within remote server is not supported by FTP protocol", 'warning');
                              }
                          });
                      }
                  }
                  return;
              }
              if (e.ctrlKey && (e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 'ф' || e.code === 'KeyA')) {
                  e.preventDefault();
                  const allPaths = new Set(files.filter(f => f.name !== "..").map(f => f.full_path));
                  setSelectedPaths(allPaths);
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
              if (e.ctrlKey && (e.key.toLowerCase() === 'r' || e.key.toLowerCase() === 'к')) {
                  e.preventDefault();
                  if (isRemote) loadRemote(remotePath);
                  else loadLocal(localPath);
                  return;
              }
            if ((e.ctrlKey && e.key.toLowerCase() === 'z') || e.key === 'Insert') {
                undoRename();
                return;
            }
            if (e.altKey && e.key === 'ArrowLeft') {
                e.preventDefault();
                goBack(activePane);
                return;
            }
            if (e.altKey && e.key === 'ArrowRight') {
                e.preventDefault();
                goForward(activePane);
                return;
            }
            if (e.ctrlKey && (e.key.toLowerCase() === 'b' || e.key.toLowerCase() === 'и')) {
                e.preventDefault();
                toggleSidebar();
                return;
            }
            if (e.ctrlKey && (e.key.toLowerCase() === 'd' || e.key.toLowerCase() === 'в')) {
                e.preventDefault();
                onDisconnect();
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
        setActivePane,
        selectedLocalPaths,
        selectedRemotePaths,
        localFiles,
        remoteFiles,
        setSelectedLocalPaths,
        setSelectedRemotePaths,
        setShowDeleteDialog,
        setShowCreateDialog,
        handleFileAction,
        handleFileOpen,
        undoRename,
        goBack,
        goForward,
        loadLocal,
        loadRemote,
        localPath,
        remotePath,
        navigateLocalUp,
        navigateRemoteUp,
        onDisconnect,
        toggleSidebar
    ]);
}
