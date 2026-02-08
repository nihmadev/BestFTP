
import { useState, useEffect, useRef, useCallback } from "react";
import { listen } from '@tauri-apps/api/event';
import { ftp, FileItem } from "../utils/api";

import { useToasts } from "../hooks/useToasts";
import { useFileSystem } from "../hooks/useFileSystem";
import { useFileOperations } from "../hooks/useFileOperations";
import { useKeybindings } from "../hooks/useKeybindings";
import { useTransferQueue } from "../hooks/useTransferQueue";

import { useDashboardDragDrop } from "../hooks/useDashboardDragDrop";
import { useDashboardContextMenu } from "../hooks/useDashboardContextMenu";
import { useDashboardColumnResize } from "../hooks/useDashboardColumnResize";

import { ToastList } from "../components/dashboard/ToastList";
import { RenameDialog, DeleteDialog, CreateDialog, PropertiesDialog } from "../components/dashboard/Dialogs";
import { ContextMenu } from "../components/dashboard/ContextMenu";
import { Sidebar } from "../components/dashboard/Sidebar";
import { StatusBar } from "../components/dashboard/StatusBar";
import { EditorDialog } from "../components/dashboard/EditorDialog";
import { Pane } from "../components/dashboard/Pane";
import { DragGhost } from "../components/dashboard/DragGhost";

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
        updateProgress,
        completeTransfer,
        clearCompleted,
        simulateProgress
    } = useTransferQueue();

    const currentTransferIdRef = useRef<string | null>(null);

    useEffect(() => {
        const unlisten = listen('upload-progress', (event: any) => {
            const payload = event.payload;
            if (currentTransferIdRef.current) {
                updateProgress(currentTransferIdRef.current, payload.progress, payload.speed);
            }
        });

        return () => {
            unlisten.then(f => f());
        };
    }, [updateProgress]);

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
    } = useFileOperations(localPath, remotePath, loadLocal, loadRemote, addToast, handleFileOpen, {
        addToQueue,
        startTransfer,
        completeTransfer,
        simulateProgress,
        currentTransferIdRef
    });

    const [selectedLocalPaths, setSelectedLocalPaths] = useState<Set<string>>(new Set());
    const [selectedRemotePaths, setSelectedRemotePaths] = useState<Set<string>>(new Set());
    const [activePane, setActivePane] = useState<'local' | 'remote'>('local');

    const [showPropertiesDialog, setShowPropertiesDialog] = useState<FileItem | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [mobileActivePane, setMobileActivePane] = useState<'local' | 'remote'>('local');

    // Custom Hooks
    const { localColumnWidths, remoteColumnWidths, handleColumnResize } = useDashboardColumnResize();

    const {
        contextMenu,
        contextMenuRef,
        onFileContextMenu,
        onEmptyContextMenu,
        handleAction: handleContextMenuAction
    } = useDashboardContextMenu(
        loadLocal,
        loadRemote,
        localPath,
        remotePath,
        setShowCreateDialog,
        setShowDeleteDialog,
        setShowPropertiesDialog,
        handleFileAction,
        selectedLocalPaths,
        selectedRemotePaths,
        localFiles,
        remoteFiles
    );

    const { dragState, dragGhostRef, handleMouseDown } = useDashboardDragDrop(
        localPath,
        remotePath,
        loadLocal,
        loadRemote,
        addToast,
        selectedLocalPaths,
        selectedRemotePaths,
        localFiles,
        remoteFiles,
        {
            addToQueue,
            startTransfer,
            completeTransfer,
            simulateProgress,
            currentTransferIdRef
        }
    );

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

    const handleDisconnect = async () => {
        try {
            await ftp.disconnect();
            onLogout();
        } catch (e) {
        }
    };

    return (
        <div className="flex flex-col flex-1 min-h-0 w-full overflow-hidden bg-solid-bg select-none">
            <DragGhost
                isDragging={dragState.isDragging}
                x={dragState.x}
                y={dragState.y}
                items={dragState.items}
                label={dragState.label}
                dragGhostRef={dragGhostRef}
            />

            {contextMenu && (
                <ContextMenu
                    key={`${contextMenu.x}-${contextMenu.y}`}
                    ref={contextMenuRef}
                    x={contextMenu.x}
                    y={contextMenu.y}
                    file={contextMenu.file || undefined}
                    isRemote={contextMenu.isRemote}
                    onAction={handleContextMenuAction}
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
                    <Pane
                        paneId="local"
                        isActiveMobile={mobileActivePane === 'local'}
                        title="Local Files"
                        path={localPath}
                        breadcrumbs={localBreadcrumbs}
                        files={localFiles}
                        loading={localLoading}
                        selectedPaths={selectedLocalPaths}
                        onNavigate={loadLocal}
                        onNavigateUp={navigateLocalUp}
                        onBreadcrumbNavigate={navigateLocalBreadcrumb}
                        onReload={() => loadLocal(localPath)}
                        onSelect={setSelectedLocalPaths}
                        onSetActive={() => setActivePane('local')}
                        columnWidths={localColumnWidths}
                        onColumnResize={handleColumnResize}
                        onFileContextMenu={onFileContextMenu}
                        onEmptyContextMenu={onEmptyContextMenu}
                        onMouseDown={handleMouseDown}
                        onFileOpen={handleFileOpen}
                        sidebarOpen={sidebarOpen}
                        setSidebarOpen={setSidebarOpen}
                        setMobileActivePane={setMobileActivePane}
                        isDragging={dragState.isDragging}
                        dragTargetPane={dragState.targetPane}
                    />

                    <Pane
                        paneId="remote"
                        isActiveMobile={mobileActivePane === 'remote'}
                        title="Remote Files"
                        path={remotePath}
                        breadcrumbs={remoteBreadcrumbs}
                        files={remoteFiles}
                        loading={remoteLoading}
                        selectedPaths={selectedRemotePaths}
                        onNavigate={loadRemote}
                        onNavigateUp={navigateRemoteUp}
                        onBreadcrumbNavigate={navigateRemoteBreadcrumb}
                        onReload={() => loadRemote(remotePath)}
                        onSelect={setSelectedRemotePaths}
                        onSetActive={() => setActivePane('remote')}
                        columnWidths={remoteColumnWidths}
                        onColumnResize={handleColumnResize}
                        onFileContextMenu={onFileContextMenu}
                        onEmptyContextMenu={onEmptyContextMenu}
                        onMouseDown={handleMouseDown}
                        onFileOpen={handleFileOpen}
                        setMobileActivePane={setMobileActivePane}
                        isDragging={dragState.isDragging}
                        dragTargetPane={dragState.targetPane}
                        sidebarOpen={sidebarOpen}
                    />
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
