
import { ArrowUp, Menu, RefreshCw } from "lucide-react";
import { Breadcrumbs } from "./Breadcrumbs";
import { FileList } from "./FileList";
import { DropOverlay } from "./DropOverlay";
import { FileItem } from "../../utils/api";

interface PaneProps {
    paneId: 'local' | 'remote';
    isActiveMobile: boolean;
    title: string;
    path: string;
    breadcrumbs: string[];
    files: FileItem[];
    loading: boolean;
    selectedPaths: Set<string>;
    onNavigate: (path: string) => Promise<void>;
    onNavigateUp: () => void;
    onBreadcrumbNavigate: (index: number) => void;
    onReload: () => Promise<void>;
    onSelect: (paths: Set<string>) => void;
    onSetActive: () => void;
    columnWidths: { name: number; size: number; modified: number };
    onColumnResize: (columnName: 'name' | 'size', e: React.MouseEvent, isRemote: boolean) => void;
    onFileContextMenu: (e: React.MouseEvent, file: FileItem, isRemote: boolean) => void;
    onEmptyContextMenu: (e: React.MouseEvent, isRemote: boolean) => void;
    onMouseDown: (e: React.MouseEvent, file: FileItem, isRemote: boolean) => void;
    onFileOpen: (file: FileItem, isRemote: boolean) => void;
    sidebarOpen: boolean;
    setSidebarOpen?: (open: boolean) => void;
    setMobileActivePane: (pane: 'local' | 'remote') => void;
    isDragging: boolean;
    dragTargetPane: 'local' | 'remote' | null;
}

export const Pane = ({
    paneId,
    isActiveMobile,
    title,
    path,
    breadcrumbs,
    files,
    loading,
    selectedPaths,
    onNavigate,
    onNavigateUp,
    onBreadcrumbNavigate,
    onReload,
    onSelect,
    onSetActive,
    columnWidths,
    onColumnResize,
    onFileContextMenu,
    onEmptyContextMenu,
    onMouseDown,
    onFileOpen,
    sidebarOpen,
    setSidebarOpen,
    setMobileActivePane,
    isDragging,
    dragTargetPane,
}: PaneProps) => {
    const isRemote = paneId === 'remote';

    return (
        <div className={`flex-1 flex flex-col p-4 pb-6 min-w-0 min-h-0 ${!isActiveMobile ? 'max-lg:hidden' : ''}`} data-pane={paneId}>
            <div className="flex items-center justify-between mb-2 h-14 sm:h-auto">
                <div className="flex items-center gap-3">
                    {setSidebarOpen && (
                        <button
                            className="p-2 -ml-2 rounded-md hover:bg-subtle-secondary min-[1025px]:hidden transition-colors text-text-primary"
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                        >
                            <Menu size={20} />
                        </button>
                    )}
                    <span className="text-xl font-bold tracking-tight text-text-primary sm:text-lg">{title}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-subtle-secondary hover:bg-subtle-tertiary border border-card-default text-xs font-semibold text-text-primary transition-all active:scale-95 min-[601px]:hidden shadow-sm"
                        onClick={() => setMobileActivePane(isRemote ? 'local' : 'remote')}
                    >
                        {isRemote ? 'Local' : 'Remote'} <RefreshCw size={12} />
                    </button>
                    <button className="w-8 h-8 flex items-center justify-center p-0 bg-transparent border-none rounded-md text-text-primary cursor-pointer transition-colors hover:bg-subtle-secondary active:bg-subtle-tertiary" onClick={onNavigateUp} title="Up">
                        <ArrowUp size={16} />
                    </button>
                    <button className="w-8 h-8 flex items-center justify-center p-0 bg-transparent border-none rounded-md text-text-primary cursor-pointer transition-colors hover:bg-subtle-secondary active:bg-subtle-tertiary" onClick={onReload} title="Refresh">
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            <Breadcrumbs
                path={path}
                breadcrumbs={breadcrumbs}
                isRemote={isRemote}
                onNavigate={onBreadcrumbNavigate}
                onGoHome={async () => isRemote ? onNavigate("/") : onNavigate(path.includes(":") ? path.split(":")[0] + ":/" : "/")}
            />

            <div className="relative flex-1 min-h-0 flex flex-col file-list-container-ref">
                <FileList
                    files={files}
                    loading={loading}
                    onNavigate={onNavigate}
                    isRemote={isRemote}
                    selectedPaths={selectedPaths}
                    onSelect={onSelect}
                    onSetActive={onSetActive}
                    columnWidths={columnWidths}
                    onColumnResize={onColumnResize}
                    onFileContextMenu={onFileContextMenu}
                    onEmptyContextMenu={onEmptyContextMenu}
                    onMouseDown={onMouseDown}
                    onFileOpen={onFileOpen}
                />
                <DropOverlay
                    isActive={isDragging && dragTargetPane === paneId}
                    currentPath={path}
                />
            </div>
        </div>
    );
};
