
import { ArrowUp, Menu, RefreshCw, Search, X } from "lucide-react";
import { Breadcrumbs } from "./Breadcrumbs";
import { FileList } from "./FileList";
import { DropOverlay } from "./DropOverlay";
import { FileItem, ftp } from "../../utils/api";
import { useState, useMemo, useEffect, useRef } from "react";

interface PaneProps {
    paneId: 'local' | 'remote';
    isActiveMobile: boolean;
    isActive: boolean;
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
    onRunExecutable: (file: FileItem, isRemote: boolean) => void;
    sidebarOpen: boolean;
    setSidebarOpen?: (open: boolean) => void;
    setMobileActivePane: (pane: 'local' | 'remote') => void;
    isDragging: boolean;
    dragTargetPane: 'local' | 'remote' | null;
}

export const Pane = ({
    paneId,
    isActiveMobile,
    isActive,
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
    onRunExecutable,
    sidebarOpen,
    setSidebarOpen,
    setMobileActivePane,
    isDragging,
    dragTargetPane,
}: PaneProps) => {
    const isRemote = paneId === 'remote';
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchResults, setSearchResults] = useState<FileItem[] | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchTimeoutRef = useRef<any>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isActive) return;
            if (e.ctrlKey && (e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'а')) {
                e.preventDefault();
                setIsSearchOpen(true);
            }
            if (e.key === 'Escape' && isSearchOpen) {
                setIsSearchOpen(false);
                setSearchQuery("");
                setSearchResults(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isActive, isSearchOpen]);

    useEffect(() => {
        if (isSearchOpen) {
            searchInputRef.current?.focus();
        }
    }, [isSearchOpen]);

    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (!searchQuery) {
            setSearchResults(null);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        searchTimeoutRef.current = setTimeout(async () => {
            try {
                // Всегда рекурсивный поиск
                const res = await ftp.searchFiles(path, searchQuery, isRemote, true);
                if (res.success && res.data) {
                    setSearchResults(res.data);
                }
            } catch (e) {
                console.error("Search failed:", e);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        };
    }, [searchQuery, path, isRemote]);

    const displayFiles = useMemo(() => {
        if (!searchQuery) return files;
        return searchResults || [];
    }, [files, searchQuery, searchResults]);

    return (
        <div 
            className={`flex-1 flex flex-col p-4 pb-6 min-w-0 min-h-0 transition-all duration-200 rounded-xl m-1
                       ${!isActiveMobile ? 'max-lg:hidden' : ''} 
                       bg-transparent`} 
            data-pane={paneId}
            onClick={onSetActive}
        >
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
                        className={`w-8 h-8 flex items-center justify-center p-0 bg-transparent border-none rounded-md text-text-primary cursor-pointer transition-colors hover:bg-subtle-secondary active:bg-subtle-tertiary ${isSearchOpen ? 'bg-subtle-secondary text-accent-primary' : ''}`}
                        onClick={() => setIsSearchOpen(!isSearchOpen)}
                        title="Search (Ctrl+F)"
                    >
                        <Search size={16} />
                    </button>
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

            {isSearchOpen && (
                <div className="mb-2 flex items-center gap-2 bg-subtle-secondary p-2 rounded-lg border border-card-default shadow-inner">
                    <Search size={14} className={`${isSearching ? 'animate-pulse text-accent-primary' : 'text-text-secondary'} ml-1`} />
                    <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search files (e.g. .ts|.tsx name)..."
                        className="flex-1 bg-transparent border-none outline-none text-sm text-text-primary"
                    />
                    <button 
                        onClick={() => { setIsSearchOpen(false); setSearchQuery(""); setSearchResults(null); }}
                        className="p-1 hover:bg-subtle-tertiary rounded-md transition-colors"
                    >
                        <X size={14} className="text-text-secondary" />
                    </button>
                </div>
            )}

            <Breadcrumbs
                path={path}
                breadcrumbs={breadcrumbs}
                isRemote={isRemote}
                onNavigate={onBreadcrumbNavigate}
                onGoHome={async () => isRemote ? onNavigate("/") : onNavigate(path.includes(":") ? path.split(":")[0] + ":/" : "/")}
            />

            <div className="relative flex-1 min-h-0 flex flex-col file-list-container-ref">
                <FileList
                    files={displayFiles}
                    loading={loading || isSearching}
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
                    onRunExecutable={onRunExecutable}
                />
                <DropOverlay
                    isActive={isDragging && dragTargetPane === paneId}
                    currentPath={path}
                />
            </div>
        </div>
    );
};
