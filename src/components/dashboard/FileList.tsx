import React, { useMemo, useRef, useCallback, useEffect } from "react";
import { FileItem } from "../../utils/api";
import { getFileIcon, getFolderIcon } from "../../utils/fileIcons";
import { Loader2 } from "lucide-react";

interface FileListProps {
    files: FileItem[];
    loading: boolean;
    onNavigate: (path: string) => void;
    isRemote: boolean;
    selectedPaths: Set<string>;
    onSelect: (paths: Set<string>) => void;
    onSetActive: () => void;
    columnWidths: { name: number, size: number, modified: number };
    onColumnResize: (columnName: 'name' | 'size', e: React.MouseEvent, isRemote: boolean) => void;
    onFileContextMenu: (e: React.MouseEvent, file: FileItem, isRemote: boolean) => void;
    onEmptyContextMenu: (e: React.MouseEvent, isRemote: boolean) => void;
    onMouseDown: (e: React.MouseEvent, file: FileItem, isRemote: boolean) => void;
    onFileOpen: (file: FileItem, isRemote: boolean) => void;
}

const FileRow = React.memo(({
    file,
    isSelected,
    gridStyle,
    onMouseDown,
    onClick,
    onDoubleClick,
    onContextMenu
}: {
    file: FileItem;
    isSelected: boolean;
    gridStyle: React.CSSProperties;
    onMouseDown: (e: React.MouseEvent) => void;
    onClick: (e: React.MouseEvent) => void;
    onDoubleClick: (e: React.MouseEvent) => void;
    onContextMenu: (e: React.MouseEvent) => void;
}) => {
    return (
        <div
            data-path={file.full_path}
            data-is-dir={file.is_directory}
            data-is-parent={file.name === ".."}
            className={`grid h-9 border-b border-card-default/30 cursor-default text-[13px] text-text-primary items-center hover:bg-subtle-secondary active:bg-subtle-tertiary transition-colors relative
                       ${isSelected ? 'bg-accent/10 hover:bg-accent/15' : ''}`}
            style={gridStyle}
            onMouseDown={onMouseDown}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onContextMenu={onContextMenu}
        >
            {isSelected && (
                <div className="absolute left-0 top-1 bottom-1 w-[3px] bg-accent rounded-r-sm z-10" />
            )}
            <div className="flex items-center justify-center p-0 opacity-90">
                {file.is_directory
                    ? getFolderIcon(file.name, false, file.full_path)
                    : getFileIcon(file.name, file.full_path)
                }
            </div>
            <div className="px-3 pl-0 truncate" title={file.name}>{file.name}</div>
            <div className="px-3 truncate text-text-secondary">{file.readable_size}</div>
            <div className="px-3 truncate text-text-secondary">{file.readable_modified}</div>
        </div>
    );
});

export const FileList = React.memo(({
    files,
    loading,
    onNavigate,
    isRemote,
    selectedPaths,
    onSelect,
    onSetActive,
    columnWidths,
    onColumnResize,
    onFileContextMenu,
    onEmptyContextMenu,
    onMouseDown,
    onFileOpen
}: FileListProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const selectedPathsRef = useRef(selectedPaths);

    useEffect(() => {
        selectedPathsRef.current = selectedPaths;
    }, [selectedPaths]);

    const gridStyle = useMemo(() => ({
        gridTemplateColumns: `32px ${columnWidths.name}fr ${columnWidths.size}fr ${columnWidths.modified}fr`
    }), [columnWidths]);

    const sortedFiles = useMemo(() => {
        return [...files].sort((a, b) => {
            if (a.name === "..") return -1;
            if (b.name === "..") return 1;
            if (a.is_directory && !b.is_directory) return -1;
            if (!a.is_directory && b.is_directory) return 1;
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
        });
    }, [files]);

    const handleNavigate = useCallback((file: FileItem) => {
        if (file.is_directory) {
            if (file.name === "..") {
                const currentPath = file.full_path;
                const lastSlash = Math.max(currentPath.lastIndexOf('/'), currentPath.lastIndexOf('\\'));

                if (lastSlash <= 0) {
                    if (currentPath.includes(':') && (currentPath.endsWith(":/") || currentPath.endsWith(":\\"))) {
                        return; // Already at root
                    }
                }

                let parent = currentPath.substring(0, lastSlash);
                const separator = isRemote ? '/' : (currentPath.includes('\\') ? '\\' : '/');
                if (currentPath.includes(':') && parent.length === 2 && parent.endsWith(':')) {
                    parent += separator;
                }
                if (!parent && isRemote) parent = "/";

                if (parent && parent !== currentPath) {
                    onNavigate(parent);
                }
            } else {
                onNavigate(file.full_path);
            }
        } else {
            onFileOpen(file, isRemote);
        }
    }, [isRemote, onNavigate, onFileOpen]);

    const handleItemMouseDown = useCallback((e: React.MouseEvent, file: FileItem) => {
        if (e.button !== 0) return; // Left click only

        onSetActive();
        containerRef.current?.focus();

        if (file.name === "..") {
            onMouseDown(e, file, isRemote);
            return;
        }

        const currentSelected = selectedPathsRef.current;
        const newSelected = new Set(currentSelected);

        if (e.ctrlKey) {
            if (newSelected.has(file.full_path)) {
                newSelected.delete(file.full_path);
            } else {
                newSelected.add(file.full_path);
            }
            onSelect(newSelected);
        } else {
            // If already part of selection, don't deselect yet - might be drag start
            if (!currentSelected.has(file.full_path)) {
                onSelect(new Set([file.full_path]));
            }
        }

        onMouseDown(e, file, isRemote);
    }, [onSetActive, onSelect, onMouseDown, isRemote]);

    const handleItemClick = useCallback((e: React.MouseEvent, file: FileItem) => {
        e.stopPropagation();

        // If we didn't use CTRL and it was already selected, 
        // we might have skipped deselection in onMouseDown (for drag).
        // Since no drag happened (this is click), we deselect others now.
        if (!e.ctrlKey && selectedPathsRef.current.size > 1 && selectedPathsRef.current.has(file.full_path)) {
            onSelect(new Set([file.full_path]));
        }
    }, [onSelect]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (loading || sortedFiles.length === 0) return;

        const currentSelected = Array.from(selectedPaths);
        const lastSelectedPath = currentSelected[currentSelected.length - 1];

        let currentIndex = -1;
        if (lastSelectedPath !== undefined) {
            for (let i = 0; i < sortedFiles.length; i++) {
                if (sortedFiles[i].full_path === lastSelectedPath) {
                    currentIndex = i;
                    break;
                }
            }
        }

        const scrollIntoView = (path: string, name: string) => {
            requestAnimationFrame(() => {
                const element = containerRef.current?.querySelector(`[data-path="${path.replace(/\\/g, '\\\\')}"]${name === '..' ? ':first-child' : ''}`);
                if (element) {
                    element.scrollIntoView({ block: 'nearest' });
                }
            });
        };

        const updateSelection = (index: number) => {
            const file = sortedFiles[index];
            if (file) {
                onSelect(new Set([file.full_path]));
                scrollIntoView(file.full_path, file.name);
            }
        };

        if (e.key === "ArrowDown") {
            e.preventDefault();
            const nextIndex = Math.min(currentIndex + 1, sortedFiles.length - 1);
            if (nextIndex >= 0) updateSelection(nextIndex);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            const prevIndex = Math.max(currentIndex - 1, 0);
            if (prevIndex >= 0) updateSelection(prevIndex);
        } else if (e.key === "Enter") {
            if (currentIndex >= 0) {
                e.preventDefault();
                handleNavigate(sortedFiles[currentIndex]);
            }
        }
    };

    return (
        <div
            ref={containerRef}
            className="flex-1 overflow-y-auto border border-card-default/50 rounded-lg bg-control-secondary/30 relative z-[1] outline-none shadow-sm"
            data-is-remote={isRemote}
            tabIndex={0}
            onFocus={onSetActive}
            onKeyDown={handleKeyDown}
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onSetActive();
                    onSelect(new Set());
                }
            }}
            onContextMenu={(e) => {
                if (e.target === e.currentTarget) {
                    onEmptyContextMenu(e, isRemote);
                }
            }}
        >
            <div className="grid bg-layer-default border-b border-card-default sticky top-0 z-10 h-9 items-center shadow-sm" style={gridStyle}>
                <div className="col-span-2 px-3 pl-[44px] flex items-center justify-start h-full border-r border-card-default/50 relative hover:bg-subtle-secondary group text-text-primary transition-colors">
                    <div className="flex-1 text-[11px] font-bold truncate uppercase tracking-widest opacity-60">Name</div>
                    <div
                        className="absolute right-0 top-1.5 bottom-1.5 w-[1px] bg-card-default cursor-col-resize hover:w-0.5 hover:bg-accent group-hover:block transition-all"
                        onMouseDown={(e) => onColumnResize('name', e, isRemote)}
                    ></div>
                </div>
                <div className="px-3 flex items-center justify-start h-full border-r border-card-default/50 relative hover:bg-subtle-secondary group text-text-primary transition-colors">
                    <div className="flex-1 text-[11px] font-bold truncate uppercase tracking-widest opacity-60">Size</div>
                    <div
                        className="absolute right-0 top-1.5 bottom-1.5 w-[1px] bg-card-default cursor-col-resize hover:w-0.5 hover:bg-accent group-hover:block transition-all"
                        onMouseDown={(e) => onColumnResize('size', e, isRemote)}
                    ></div>
                </div>
                <div className="px-3 flex items-center justify-start h-full text-text-primary transition-colors hover:bg-subtle-secondary group">
                    <div className="flex-1 text-[11px] font-bold truncate uppercase tracking-widest opacity-60">Modified</div>
                </div>
            </div>

            {loading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-solid-bg/20 z-[5]">
                    <Loader2 size={56} className="animate-spin text-accent" />
                    <div className="text-[13px] font-medium text-text-tertiary">Please wait a moment...</div>
                </div>
            ) : (
                <div className="flex flex-col">
                    {sortedFiles.map((file) => (
                        <FileRow
                            key={file.name === ".." ? "parent-dir" : file.full_path}
                            file={file}
                            isSelected={selectedPaths.has(file.full_path)}
                            gridStyle={gridStyle}
                            onMouseDown={(e) => handleItemMouseDown(e, file)}
                            onClick={(e) => handleItemClick(e, file)}
                            onDoubleClick={(e) => {
                                e.stopPropagation();
                                handleNavigate(file);
                            }}
                            onContextMenu={(e) => onFileContextMenu(e, file, isRemote)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
});
