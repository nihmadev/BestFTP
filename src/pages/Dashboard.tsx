import { useState, useEffect, useRef, useCallback } from "react";
import { ftp, FileItem } from "../utils/api";
import {
    ArrowUp, RefreshCw, FilePlus, Menu
} from "lucide-react";
import { getFileIcon, getFolderIcon } from "../utils/fileIcons";

import { useToasts } from "../hooks/useToasts";
import { useFileSystem } from "../hooks/useFileSystem";
import { useFileOperations } from "../hooks/useFileOperations";
import { useKeybindings } from "../hooks/useKeybindings";
import { useTransferQueue } from "../hooks/useTransferQueue";

import { ToastList } from "../components/dashboard/ToastList";
import { RenameDialog, DeleteDialog, CreateDialog, PropertiesDialog } from "../components/dashboard/Dialogs";
import { ContextMenu } from "../components/dashboard/ContextMenu";
import { Sidebar } from "../components/dashboard/Sidebar";
import { Breadcrumbs } from "../components/dashboard/Breadcrumbs";
import { FileList } from "../components/dashboard/FileList";
import { StatusBar } from "../components/dashboard/StatusBar";
import { EditorDialog } from "../components/dashboard/EditorDialog";

interface DashboardProps {
    onLogout: () => void;
}

export function Dashboard({ onLogout }: DashboardProps) {
    const { toasts, addToast } = useToasts();

    const {
        localPath, remotePath,
        localFiles, remoteFiles,
        recentFolders,
        localLoading, remoteLoading,
        localBreadcrumbs, remoteBreadcrumbs,
        loadLocal, loadRemote,
        navigateLocalUp, navigateRemoteUp,
        navigateLocalBreadcrumb, navigateRemoteBreadcrumb,
        goBack, goForward
    } = useFileSystem(addToast);

    const [editingFile, setEditingFile] = useState<{
        file: FileItem;
        isRemote: boolean;
    } | null>(null);

    const handleFileOpen = useCallback((file: FileItem, isRemote: boolean) => {
        const ext = file.name.split(".").pop()?.toLowerCase();
        const audioExtensions = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma', 'opus'];

        if (ext && audioExtensions.includes(ext)) {
            return;
        }

        setEditingFile({ file, isRemote });
    }, []);

    const {
        currentTransfer,
        queuedCount,
        successCount,
        failedCount,
        addToQueue,
        startTransfer,
        simulateProgress,
        completeTransfer,
        clearCompleted
    } = useTransferQueue();

    const {
        showRenameDialog, setShowRenameDialog,
        showDeleteDialog, setShowDeleteDialog,
        showCreateDialog, setShowCreateDialog,
        newName, setNewName,
        handleConfirmRename,
        handleConfirmDelete,
        handleConfirmCreate,
        handleFileAction,
        undoRename
    } = useFileOperations(localPath, remotePath, loadLocal, loadRemote, addToast, handleFileOpen);

    const [selectedLocalPaths, setSelectedLocalPaths] = useState<Set<string>>(new Set());
    const [selectedRemotePaths, setSelectedRemotePaths] = useState<Set<string>>(new Set());
    const [activePane, setActivePane] = useState<'local' | 'remote'>('local');

    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        file: FileItem | null;
        isRemote: boolean;
    } | null>(null);

    const contextMenuRef = useRef<HTMLDivElement>(null);
    const dragGhostRef = useRef<HTMLDivElement>(null);

    const [localColumnWidths, setLocalColumnWidths] = useState({
        name: 2,
        size: 1,
        modified: 1.2
    });

    const [remoteColumnWidths, setRemoteColumnWidths] = useState({
        name: 2,
        size: 1,
        modified: 1.2
    });

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [mobileActivePane, setMobileActivePane] = useState<'local' | 'remote'>('local');
    const [showPropertiesDialog, setShowPropertiesDialog] = useState<FileItem | null>(null);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setSidebarOpen(false);
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, []);

    useKeybindings({
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
    });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
                setContextMenu(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleColumnResize = useCallback((columnName: 'name' | 'size', e: React.MouseEvent, isRemote: boolean) => {
        e.preventDefault();
        const startX = e.clientX;
        const currentWidths = isRemote ? remoteColumnWidths : localColumnWidths;
        const startWidths = { ...currentWidths };

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const container = (e.currentTarget as HTMLElement).closest('.file-list-container-ref');
            const containerWidth = container?.clientWidth || 800;
            const pixelToFr = 10 / containerWidth;

            const deltaFr = deltaX * pixelToFr;
            const setWidths = isRemote ? setRemoteColumnWidths : setLocalColumnWidths;

            if (columnName === 'name') {
                setWidths({
                    ...startWidths,
                    name: Math.max(0.5, startWidths.name + deltaFr),
                    size: Math.max(0.5, startWidths.size - deltaFr)
                });
            } else {
                setWidths({
                    ...startWidths,
                    size: Math.max(0.5, startWidths.size + deltaFr),
                    modified: Math.max(0.5, startWidths.modified - deltaFr)
                });
            }
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [remoteColumnWidths, localColumnWidths]);

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

    const handleDisconnect = async () => {
        try {
            await ftp.disconnect();
            onLogout();
        } catch (e) {
        }
    };

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
    useEffect(() => {
        dragStateRef.current = dragState;
    }, [dragState]);

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
                const stopProgress = simulateProgress(id);

                if (isRemoteSource === isRemoteDest) {
                    const res = await ftp.renameFile(sourceFullPath, destFullPath, isRemoteSource);
                    stopProgress();
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
                        stopProgress();
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
                        stopProgress();
                        if (res.success) {
                            successCount++;
                            completeTransfer(id, true);
                            addToast(`Uploaded ${fileName}`, 'success');
                        } else {
                            failCount++;
                            completeTransfer(id, false, res.error || undefined);
                            addToast(`Failed to upload ${fileName}: ${res.error}`, 'error');
                        }
                    }
                }

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

    const DropOverlay = ({ isActive, currentPath }: { isActive: boolean, currentPath: string }) => (
        <div className={`absolute inset-0 bg-accent/10 border-2 border-dashed border-accent flex flex-col items-center justify-center p-5 z-20 pointer-events-none transition-opacity duration-200 
                        ${isActive ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex flex-col items-center gap-3 scale-anim animate-in fade-in zoom-in duration-300">
                <span className="text-accent animate-bounce">
                    <FilePlus size={48} />
                </span>
                <div className="text-lg font-semibold text-text-primary">Drop here to move/copy</div>
                <div className="text-xs text-text-secondary opacity-80">to {currentPath}</div>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col flex-1 min-h-0 w-full overflow-hidden bg-solid-bg select-none">
            {dragState.isDragging && (
                <div
                    ref={dragGhostRef}
                    className="fixed pointer-events-none z-[10000] flex items-center bg-accent-secondary border border-accent rounded-md px-3 py-2 shadow-2xl opacity-90 transition-transform duration-0"
                    style={{
                        left: 0,
                        top: 0,
                        transform: `translate(${dragState.x + 10}px, ${dragState.y + 10}px)`,
                    }}
                >
                    {dragState.items.length === 1 ? (
                        <>
                            <span className="flex items-center mr-2">
                                {dragState.items[0].is_directory
                                    ? getFolderIcon(dragState.items[0].name, false, dragState.items[0].full_path)
                                    : getFileIcon(dragState.items[0].name, dragState.items[0].full_path)
                                }
                            </span>
                            <div className="text-[13px] font-medium text-text-primary">{dragState.label}</div>
                        </>
                    ) : (
                        <>
                            <div className="relative w-6 h-6 mr-3">
                                {dragState.items.slice(0, Math.min(3, dragState.items.length)).map((item, index) => (
                                    <div
                                        key={item.full_path}
                                        className="absolute"
                                        style={{
                                            left: index * 4,
                                            top: index * 2,
                                            zIndex: 3 - index,
                                            opacity: 1 - index * 0.15
                                        }}
                                    >
                                        {item.is_directory
                                            ? getFolderIcon(item.name, false, item.full_path)
                                            : getFileIcon(item.name, item.full_path)
                                        }
                                    </div>
                                ))}
                            </div>
                            <div className="text-[13px] font-medium text-text-primary">{dragState.label}</div>
                        </>
                    )}
                </div>
            )}

            {contextMenu && (
                <ContextMenu
                    key={`${contextMenu.x}-${contextMenu.y}`}
                    ref={contextMenuRef}
                    x={contextMenu.x}
                    y={contextMenu.y}
                    file={contextMenu.file || undefined}
                    isRemote={contextMenu.isRemote}
                    onAction={(action, file, isRemote) => {
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
                    }}
                />
            )}

            <ToastList toasts={toasts} />

            {showRenameDialog && (
                <RenameDialog
                    newName={newName}
                    setNewName={setNewName}
                    onConfirm={handleConfirmRename}
                    onCancel={() => setShowRenameDialog(null)}
                />
            )}

            {showCreateDialog && (
                <CreateDialog
                    title={showCreateDialog.type === 'file' ? 'Create File' : 'Create Directory'}
                    name={newName}
                    setName={setNewName}
                    onConfirm={handleConfirmCreate}
                    onCancel={() => setShowCreateDialog(null)}
                />
            )}

            {showDeleteDialog && (
                <DeleteDialog
                    files={showDeleteDialog.files}
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setShowDeleteDialog(null)}
                />
            )}

            {editingFile && (
                <EditorDialog
                    file={editingFile.file}
                    isRemote={editingFile.isRemote}
                    onClose={() => setEditingFile(null)}
                    addToast={addToast}
                    onSaveSuccess={() => {
                        if (editingFile.isRemote) loadRemote(remotePath);
                        else loadLocal(localPath);
                    }}
                />
            )}

            {showPropertiesDialog && (
                <PropertiesDialog
                    file={showPropertiesDialog}
                    onClose={() => setShowPropertiesDialog(null)}
                />
            )}

            <div className="flex-1 flex flex-row min-h-0 relative">
                <div
                    className={`fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[999] transition-opacity duration-300 lg:hidden ${sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                    onClick={() => setSidebarOpen(false)}
                ></div>

                <Sidebar
                    recentFolders={recentFolders}
                    onDisconnect={handleDisconnect}
                    onLoadLocal={loadLocal}
                    onItemClick={() => setSidebarOpen(false)}
                    className={sidebarOpen ? 'open' : ''}
                />

                <div className="flex-1 flex flex-col lg:flex-row min-w-0">
                    <div className={`flex-1 flex flex-col p-4 pb-6 min-w-0 min-h-0 ${mobileActivePane !== 'local' ? 'max-lg:hidden' : ''}`} data-pane="local">
                        <div className="flex items-center justify-between mb-2 h-14 sm:h-auto">
                            <div className="flex items-center gap-3">
                                <button
                                    className="p-2 -ml-2 rounded-md hover:bg-subtle-secondary min-[1025px]:hidden transition-colors text-text-primary"
                                    onClick={() => setSidebarOpen(!sidebarOpen)}
                                >
                                    <Menu size={20} />
                                </button>
                                <span className="text-xl font-bold tracking-tight text-text-primary sm:text-lg">Local Files</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-subtle-secondary hover:bg-subtle-tertiary border border-card-default text-xs font-semibold text-text-primary transition-all active:scale-95 min-[601px]:hidden shadow-sm"
                                    onClick={() => setMobileActivePane('remote')}
                                >
                                    Remote <RefreshCw size={12} />
                                </button>
                                <button className="w-8 h-8 flex items-center justify-center p-0 bg-transparent border-none rounded-md text-text-primary cursor-pointer transition-colors hover:bg-subtle-secondary active:bg-subtle-tertiary" onClick={navigateLocalUp} title="Up">
                                    <ArrowUp size={16} />
                                </button>
                                <button className="w-8 h-8 flex items-center justify-center p-0 bg-transparent border-none rounded-md text-text-primary cursor-pointer transition-colors hover:bg-subtle-secondary active:bg-subtle-tertiary" onClick={() => loadLocal(localPath)} title="Refresh">
                                    <RefreshCw size={16} />
                                </button>
                            </div>
                        </div>

                        <Breadcrumbs
                            path={localPath}
                            breadcrumbs={localBreadcrumbs}
                            isRemote={false}
                            onNavigate={navigateLocalBreadcrumb}
                            onGoHome={async () => loadLocal(localPath.includes(":") ? localPath.split(":")[0] + ":/" : "/")}
                        />

                        <div className="relative flex-1 min-h-0 flex flex-col file-list-container-ref">
                            <FileList
                                files={localFiles}
                                loading={localLoading}
                                onNavigate={loadLocal}
                                isRemote={false}
                                selectedPaths={selectedLocalPaths}
                                onSelect={setSelectedLocalPaths}
                                onSetActive={useCallback(() => setActivePane('local'), [])}
                                columnWidths={localColumnWidths}
                                onColumnResize={handleColumnResize}
                                onFileContextMenu={onFileContextMenu}
                                onEmptyContextMenu={onEmptyContextMenu}
                                onMouseDown={handleMouseDown}
                                onFileOpen={handleFileOpen}
                            />
                            <DropOverlay
                                isActive={dragState.isDragging && dragState.targetPane === 'local'}
                                currentPath={localPath}
                            />
                        </div>
                    </div>

                    <div className={`flex-1 flex flex-col p-4 pb-6 min-w-0 min-h-0 ${mobileActivePane !== 'remote' ? 'max-lg:hidden' : ''}`} data-pane="remote">
                        <div className="flex items-center justify-between mb-2 h-14 sm:h-auto">
                            <div className="flex items-center gap-3">
                                <button
                                    className="p-2 -ml-2 rounded-md hover:bg-subtle-secondary min-[1025px]:hidden transition-colors text-text-primary"
                                    onClick={() => setSidebarOpen(!sidebarOpen)}
                                >
                                    <Menu size={20} />
                                </button>
                                <span className="text-xl font-bold tracking-tight text-text-primary sm:text-lg">Remote Files</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-subtle-secondary hover:bg-subtle-tertiary border border-card-default text-xs font-semibold text-text-primary transition-all active:scale-95 min-[601px]:hidden shadow-sm"
                                    onClick={() => setMobileActivePane('local')}
                                >
                                    Local <RefreshCw size={12} />
                                </button>
                                <button className="w-8 h-8 flex items-center justify-center p-0 bg-transparent border-none rounded-md text-text-primary cursor-pointer transition-colors hover:bg-subtle-secondary active:bg-subtle-tertiary" onClick={navigateRemoteUp} title="Up">
                                    <ArrowUp size={16} />
                                </button>
                                <button className="w-8 h-8 flex items-center justify-center p-0 bg-transparent border-none rounded-md text-text-primary cursor-pointer transition-colors hover:bg-subtle-secondary active:bg-subtle-tertiary" onClick={() => loadRemote(remotePath)} title="Refresh">
                                    <RefreshCw size={16} />
                                </button>
                            </div>
                        </div>

                        <Breadcrumbs
                            path={remotePath}
                            breadcrumbs={remoteBreadcrumbs}
                            isRemote={true}
                            onNavigate={navigateRemoteBreadcrumb}
                            onGoHome={() => loadRemote("/")}
                        />

                        <div className="relative flex-1 min-h-0 flex flex-col file-list-container-ref">
                            <FileList
                                files={remoteFiles}
                                loading={remoteLoading}
                                onNavigate={loadRemote}
                                isRemote={true}
                                selectedPaths={selectedRemotePaths}
                                onSelect={setSelectedRemotePaths}
                                onSetActive={useCallback(() => setActivePane('remote'), [])}
                                columnWidths={remoteColumnWidths}
                                onColumnResize={handleColumnResize}
                                onFileContextMenu={onFileContextMenu}
                                onEmptyContextMenu={onEmptyContextMenu}
                                onMouseDown={handleMouseDown}
                                onFileOpen={handleFileOpen}
                            />
                            <DropOverlay
                                isActive={dragState.isDragging && dragState.targetPane === 'remote'}
                                currentPath={remotePath}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <StatusBar
                queuedCount={queuedCount}
                successCount={successCount}
                failedCount={failedCount}
                currentTransfer={currentTransfer}
                onClearCompleted={clearCompleted}
            />
        </div>
    );
}
