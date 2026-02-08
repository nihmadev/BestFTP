import { ExternalLink, Download, Edit3, Trash2, Info, FolderPlus, FilePlus, RefreshCw, Play } from "lucide-react";
import { FileItem, isExecutable } from "../../utils/api";
import { forwardRef, useLayoutEffect, useRef, useState, useImperativeHandle } from "react";

interface ContextMenuProps {
    x: number;
    y: number;
    file?: FileItem;
    isRemote: boolean;
    onAction: (action: string, file: FileItem | null, isRemote: boolean) => void;
}

export const ContextMenu = forwardRef<HTMLDivElement, ContextMenuProps>(({ x, y, file, isRemote, onAction }, ref) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [adjustedPos, setAdjustedPos] = useState({ x, y, visible: false });

    useImperativeHandle(ref, () => menuRef.current!);

    useLayoutEffect(() => {
        if (menuRef.current) {
            const menu = menuRef.current;
            const rect = menu.getBoundingClientRect();
            const { innerWidth, innerHeight } = window;

            let newX = x;
            let newY = y;

            if (x + rect.width > innerWidth) {
                newX = innerWidth - rect.width - 25;
            }

            if (y + rect.height > innerHeight) {
                newY = innerHeight - rect.height - 50;
            }

            newX = Math.max(25, newX);
            newY = Math.max(25, newY);

            setAdjustedPos({ x: newX, y: newY, visible: true });
        }
    }, [x, y]);

    const menuContent = (
        <>
            {!file ? (
                <>
                    <div className="flex items-center gap-3 px-3 py-1.5 text-[13px] text-text-primary hover:bg-accent hover:text-white cursor-default transition-colors rounded-sm mx-1" onClick={() => onAction('create_dir', null, isRemote)}>
                        <FolderPlus size={14} />
                        <span>Create directory</span>
                    </div>
                    <div className="flex items-center gap-3 px-3 py-1.5 text-[13px] text-text-primary hover:bg-accent hover:text-white cursor-default transition-colors rounded-sm mx-1" onClick={() => onAction('create_dir_open', null, isRemote)}>
                        <FolderPlus size={14} />
                        <span>Create and open directory</span>
                    </div>
                    <div className="flex items-center gap-3 px-3 py-1.5 text-[13px] text-text-primary hover:bg-accent hover:text-white cursor-default transition-colors rounded-sm mx-1" onClick={() => onAction('create_file', null, isRemote)}>
                        <FilePlus size={14} />
                        <span>Create new file</span>
                    </div>
                    <div className="h-px bg-white/10 my-1 mx-1" />
                    <div className="flex items-center gap-3 px-3 py-1.5 text-[13px] text-text-primary hover:bg-accent hover:text-white cursor-default transition-colors rounded-sm mx-1" onClick={() => onAction('refresh', null, isRemote)}>
                        <RefreshCw size={14} />
                        <span>Reload</span>
                    </div>
                </>
            ) : (
                <>
                    <div className="flex items-center gap-3 px-3 py-1.5 text-[13px] text-text-primary hover:bg-accent hover:text-white cursor-default transition-colors rounded-sm mx-1" onClick={() => onAction('open', file, isRemote)}>
                        <ExternalLink size={14} />
                        <span>Open</span>
                    </div>
                    {!isRemote && !file.is_directory && isExecutable(file.name) && (
                        <div className="flex items-center gap-3 px-3 py-1.5 text-[13px] text-accent hover:bg-accent hover:text-white cursor-default transition-colors rounded-sm mx-1" onClick={() => onAction('run', file, isRemote)}>
                            <Play size={14} />
                            <span>Run</span>
                        </div>
                    )}
                    <div className="flex items-center gap-3 px-3 py-1.5 text-[13px] text-text-primary hover:bg-accent hover:text-white cursor-default transition-colors rounded-sm mx-1" onClick={() => onAction('download', file, isRemote)}>
                        <Download size={14} />
                        <span>{isRemote ? 'Download' : 'Upload'}</span>
                    </div>
                    <div className="h-px bg-white/10 my-1 mx-1" />
                    <div className="flex items-center gap-3 px-3 py-1.5 text-[13px] text-text-primary hover:bg-accent hover:text-white cursor-default transition-colors rounded-sm mx-1" onClick={() => onAction('rename', file, isRemote)}>
                        <Edit3 size={14} />
                        <span>Rename</span>
                    </div>
                    <div className="flex items-center gap-3 px-3 py-1.5 text-[13px] text-red-500 hover:bg-red-500 hover:text-white cursor-default transition-colors rounded-sm mx-1" onClick={() => onAction('delete', file, isRemote)}>
                        <Trash2 size={14} />
                        <span>Delete</span>
                    </div>
                    <div className="h-px bg-white/10 my-1 mx-1" />
                    <div className="flex items-center gap-3 px-3 py-1.5 text-[13px] text-text-primary hover:bg-accent hover:text-white cursor-default transition-colors rounded-sm mx-1" onClick={() => onAction('properties', file, isRemote)}>
                        <Info size={14} />
                        <span>Properties</span>
                    </div>
                </>
            )}
        </>
    );

    return (
        <div
            ref={menuRef}
            className="fixed z-[9999] min-w-[210px] py-1 bg-layer-default border border-card-default rounded-md shadow-2xl backdrop-blur-md transition-opacity duration-150 ease-out"
            style={{
                left: adjustedPos.x,
                top: adjustedPos.y,
                visibility: adjustedPos.visible ? 'visible' : 'hidden',
                opacity: adjustedPos.visible ? 1 : 0
            }}
        >
            {menuContent}
        </div>
    );
});

