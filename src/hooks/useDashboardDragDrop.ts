
import { useState, useRef, useEffect, useCallback } from 'react';
import { ftp, FileItem } from '../utils/api';

interface TransferActions {
    addToQueue: (name: string) => string;
    startTransfer: (id: string) => void;
    completeTransfer: (id: string, success: boolean, error?: string) => void;
    simulateProgress: (id: string, duration?: number) => () => void;
    currentTransferIdRef: React.MutableRefObject<string | null>;
}

export const useDashboardDragDrop = (
    localPath: string,
    remotePath: string,
    loadLocal: (path: string) => Promise<void>,
    loadRemote: (path: string) => Promise<void>,
    addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void,
    selectedLocalPaths: Set<string>,
    selectedRemotePaths: Set<string>,
    localFiles: FileItem[],
    remoteFiles: FileItem[],
    transferActions: TransferActions
) => {
    const [dragState, setDragState] = useState<{
        isDragging: boolean;
        items: FileItem[];
        paths: string[];
        isRemote: boolean;
        sourcePath: string;
        x: number;
        y: number;
        label: string;
        targetPane: 'local' | 'remote' | null;
        targetFolder: string | null;
    }>({
        isDragging: false,
        items: [],
        paths: [],
        isRemote: false,
        sourcePath: "",
        x: 0,
        y: 0,
        label: "",
        targetPane: null,
        targetFolder: null
    });

    const dragStateRef = useRef(dragState);
    const dragGhostRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        dragStateRef.current = dragState;
    }, [dragState]);

    const {
        addToQueue,
        startTransfer,
        completeTransfer,
        simulateProgress,
        currentTransferIdRef
    } = transferActions;

    const processCustomDrop = async (isRemoteDest: boolean, targetFolderPath: string | null, paths: string[], isRemoteSource: boolean) => {
        let destBaseDir = isRemoteDest ? remotePath : localPath;
        if (targetFolderPath) {
            destBaseDir = targetFolderPath;
        }
        const separatorDest = isRemoteDest ? '/' : '\\';
        const separatorSource = isRemoteSource ? '/' : '\\';

        let successCount = 0;
        let failCount = 0;

        const transferIds = paths.map(sourceFullPath => {
            const fileName = sourceFullPath.split(separatorSource).pop() || "";
            return { id: addToQueue(fileName), fileName, sourceFullPath };
        });

        for (let i = 0; i < transferIds.length; i++) {
            const { id, fileName, sourceFullPath } = transferIds[i];
            const destFullPath = `${destBaseDir.replace(/[\\/]$/, '')}${separatorDest}${fileName}`;

            if (sourceFullPath === destFullPath) {
                completeTransfer(id, false, 'Source and destination are the same');
                continue;
            }

            try {
                startTransfer(id);
                currentTransferIdRef.current = id;
                const stopSimulation = simulateProgress(id, 3000);

                if (isRemoteSource === isRemoteDest) {
                    const res = await ftp.renameFile(sourceFullPath, destFullPath, isRemoteSource);
                    stopSimulation();

                    if (res.success) {
                        successCount++;
                        completeTransfer(id, true);
                        addToast(`Moved ${fileName}`, 'success');
                    } else {
                        failCount++;
                        completeTransfer(id, false, res.error || undefined);
                        addToast(`Failed to move ${fileName}: ${res.error}`, 'error');
                    }
                } else {
                    if (isRemoteSource && !isRemoteDest) {
                        const res = await ftp.downloadFile(sourceFullPath, destFullPath);
                        stopSimulation();

                        if (res.success) {
                            successCount++;
                            completeTransfer(id, true);
                            addToast(`Downloaded ${fileName}`, 'success');
                        } else {
                            failCount++;
                            completeTransfer(id, false, res.error || undefined);
                            addToast(`Failed to download ${fileName}: ${res.error}`, 'error');
                        }
                    } else {
                        const res = await ftp.uploadFile(sourceFullPath, destFullPath);
                        stopSimulation();

                        if (res.success) {
                            successCount++;
                            completeTransfer(id, true);
                        } else {
                            failCount++;
                            completeTransfer(id, false, res.error || undefined);
                            addToast(`Failed to upload ${fileName}: ${res.error}`, 'error');
                        }
                    }
                }
                currentTransferIdRef.current = null;

                if (i < transferIds.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } catch (error) {
                failCount++;
                completeTransfer(id, false, String(error));
                addToast(`Error processing ${fileName}: ${error}`, 'error');
            }
        }

        if (paths.length > 1) {
            addToast(`Completed: ${successCount} succeeded, ${failCount} failed`, successCount > 0 ? 'success' : 'error');
        }

        try {
            if (isRemoteSource !== isRemoteDest) {
                await Promise.all([
                    loadLocal(localPath),
                    loadRemote(remotePath)
                ]);
            } else {
                if (isRemoteSource) await loadRemote(remotePath);
                else await loadLocal(localPath);
            }

            await new Promise(resolve => setTimeout(resolve, 500));

            const remoteCheck = await ftp.listRemoteFiles(remotePath);

            if (isRemoteDest && remoteCheck.success && remoteCheck.data) {
                const uploadedFileNames = paths.map(p => {
                    const sep = isRemoteSource ? '/' : '\\';
                    return p.split(sep).pop() || "";
                });

                const foundFiles = remoteCheck.data.filter((f: any) =>
                    uploadedFileNames.includes(f.name)
                );

                if (foundFiles.length === 0) {
                    addToast("⚠️ Files uploaded but not visible. They might be hidden or in a restricted location.", 'warning');
                }
            }
        } catch (error) {
        }
    };

    useEffect(() => {
        let rafId: number | null = null;
        let lastDragOverElement: Element | null = null;

        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (!dragStateRef.current.isDragging) return;

            if (dragGhostRef.current) {
                dragGhostRef.current.style.transform = `translate(${e.clientX + 10}px, ${e.clientY + 10}px)`;
            }

            if (rafId !== null) return;

            rafId = requestAnimationFrame(() => {
                rafId = null;

                const elementUnderCursor = document.elementFromPoint(e.clientX, e.clientY);
                const pane = elementUnderCursor?.closest('[data-pane]');

                let targetPane: 'local' | 'remote' | null = null;
                if (pane) {
                    const paneValue = pane.getAttribute('data-pane');
                    targetPane = paneValue === 'remote' ? 'remote' : 'local';
                }

                let targetFolder: string | null = null;
                const fileItem = elementUnderCursor?.closest('[data-path]');

                if (lastDragOverElement && lastDragOverElement !== fileItem) {
                    lastDragOverElement.classList.remove('bg-accent-tertiary');
                    lastDragOverElement = null;
                }

                if (fileItem) {
                    const isDir = fileItem.getAttribute('data-is-dir') === 'true';
                    const isParent = fileItem.getAttribute('data-is-parent') === 'true';
                    const path = fileItem.getAttribute('data-path');
                    if (isDir && !isParent && path) {
                        targetFolder = path;
                        fileItem.classList.add('bg-accent-tertiary');
                        lastDragOverElement = fileItem;
                    }
                }

                const current = dragStateRef.current;
                if (targetPane !== current.targetPane || targetFolder !== current.targetFolder) {
                    setDragState(prev => ({
                        ...prev,
                        targetPane,
                        targetFolder
                    }));
                }
            });
        };

        const handleGlobalMouseUp = async () => {
            if (!dragStateRef.current.isDragging) return;

            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }

            document.querySelectorAll('.bg-accent-tertiary').forEach(el => el.classList.remove('bg-accent-tertiary'));
            lastDragOverElement = null;

            const { targetPane, targetFolder, paths, isRemote: isRemoteSource } = dragStateRef.current;

            setDragState({
                isDragging: false,
                items: [],
                paths: [],
                isRemote: false,
                sourcePath: "",
                x: 0,
                y: 0,
                label: "",
                targetPane: null,
                targetFolder: null
            });

            if (targetPane) {
                const isRemoteDest = targetPane === 'remote';

                try {
                    await processCustomDrop(isRemoteDest, targetFolder, paths, isRemoteSource);
                } catch (err) {
                    addToast("Drop operation failed", 'error');
                }
            }
        };

        const handleEscapeKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && dragStateRef.current.isDragging) {
                if (rafId !== null) {
                    cancelAnimationFrame(rafId);
                    rafId = null;
                }
                document.querySelectorAll('.bg-accent-tertiary').forEach(el => el.classList.remove('bg-accent-tertiary'));
                lastDragOverElement = null;

                setDragState({
                    isDragging: false,
                    items: [],
                    paths: [],
                    isRemote: false,
                    sourcePath: "",
                    x: 0,
                    y: 0,
                    label: "",
                    targetPane: null,
                    targetFolder: null
                });
            }
        };

        if (dragState.isDragging) {
            window.addEventListener('mousemove', handleGlobalMouseMove);
            window.addEventListener('mouseup', handleGlobalMouseUp);
            window.addEventListener('keydown', handleEscapeKey);
        }

        return () => {
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
            }
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
            window.removeEventListener('keydown', handleEscapeKey);
            document.querySelectorAll('.bg-accent-tertiary').forEach(el => el.classList.remove('bg-accent-tertiary'));
        };
    }, [dragState.isDragging]);

    const handleMouseDown = useCallback((e: React.MouseEvent, file: FileItem, isRemote: boolean) => {
        if (e.button !== 0) return;

        if (dragStateRef.current.isDragging) return;

        if (file.name === "..") return;

        const startX = e.clientX;
        const startY = e.clientY;
        let dragStarted = false;

        const handleInitialMouseMove = (moveEvent: MouseEvent) => {
            if (dragStarted) return;

            const dist = Math.sqrt(Math.pow(moveEvent.clientX - startX, 2) + Math.pow(moveEvent.clientY - startY, 2));
            if (dist > 5) {
                dragStarted = true;
                document.removeEventListener('mousemove', handleInitialMouseMove);
                document.removeEventListener('mouseup', handleInitialMouseUp);

                const selectedPaths = isRemote ? selectedRemotePaths : selectedLocalPaths;
                const sourceFiles = isRemote ? remoteFiles : localFiles;

                let pathsToDrag: string[];
                let itemsToDrag: FileItem[];

                if (selectedPaths.has(file.full_path)) {
                    pathsToDrag = Array.from(selectedPaths);
                    itemsToDrag = sourceFiles.filter(f => selectedPaths.has(f.full_path));
                } else {
                    pathsToDrag = [file.full_path];
                    itemsToDrag = [file];
                }

                const label = itemsToDrag.length > 1 ? `${itemsToDrag.length} items` : file.name;

                setDragState({
                    isDragging: true,
                    items: itemsToDrag,
                    paths: pathsToDrag,
                    isRemote: isRemote,
                    sourcePath: isRemote ? remotePath : localPath,
                    x: moveEvent.clientX,
                    y: moveEvent.clientY,
                    label: label,
                    targetPane: null,
                    targetFolder: null
                });
            }
        };

        const handleInitialMouseUp = () => {
            document.removeEventListener('mousemove', handleInitialMouseMove);
            document.removeEventListener('mouseup', handleInitialMouseUp);
        };

        document.addEventListener('mousemove', handleInitialMouseMove);
        document.addEventListener('mouseup', handleInitialMouseUp);
    }, [selectedRemotePaths, selectedLocalPaths, remoteFiles, localFiles, remotePath, localPath]);

    return {
        dragState,
        dragGhostRef,
        handleMouseDown
    };
};
