import { ExternalLink, Download, Edit3, Trash2, Info, FolderPlus, FilePlus, RefreshCw, Play } from "lucide-react";
import { FileItem, isExecutable, isExecutableForEditor } from "../../utils/api";
import { forwardRef, useLayoutEffect, useRef, useState, useImperativeHandle, useEffect } from "react";

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
    const [selectedIndex, setSelectedIndex] = useState(-1);

    useImperativeHandle(ref, () => menuRef.current!);
    
    const getAvailableActions = () => {
        const actions = [];
        
        if (!file) {
            actions.push('create_dir', 'create_dir_open', 'create_file', 'refresh');
        } else {
            if (!isRemote && !file.is_directory && isExecutableForEditor(file.name)) {
                // Пропускаем Open для исполняемых файлов
            } else {
                actions.push('open');
            }
            if (!isRemote && !file.is_directory && isExecutable(file.name)) {
                actions.push('run');
            }
            actions.push('download', 'rename', 'delete', 'properties');
        }
        
        return actions;
    };

    const availableActions = getAvailableActions();
    
    // Обработчик клавиатуры
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                if (selectedIndex >= 0) {
                    const action = availableActions[selectedIndex];
                    if (action) {
                        onAction(action, file || null, isRemote);
                    }
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                e.stopPropagation();
                setSelectedIndex(prev => {
                    if (prev < 0) return 0;
                    return (prev + 1) % availableActions.length;
                });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                e.stopPropagation();
                setSelectedIndex(prev => {
                    if (prev < 0) return availableActions.length - 1;
                    return prev === 0 ? availableActions.length - 1 : prev - 1;
                });
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        document.addEventListener('keydown', handleKeyDown, true);
        
        return () => {
            document.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [selectedIndex, availableActions, file, isRemote, onAction]);

    // Сбрасываем состояние при изменении меню
    useEffect(() => {
        setSelectedIndex(-1);
    }, [x, y, file, isRemote]);

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
                    <div 
                        className={`flex items-center gap-3 px-3 py-1.5 text-[13px] cursor-default transition-colors rounded-sm mx-1 ${
                            selectedIndex === 0 ? 'bg-accent text-white' : 'text-text-primary hover:bg-accent hover:text-white'
                        }`}
                        onClick={() => onAction('create_dir', null, isRemote)}
                        onMouseEnter={() => setSelectedIndex(0)}
                    >
                        <FolderPlus size={14} />
                        <span>Create directory</span>
                    </div>
                    <div 
                        className={`flex items-center gap-3 px-3 py-1.5 text-[13px] cursor-default transition-colors rounded-sm mx-1 ${
                            selectedIndex === 1 ? 'bg-accent text-white' : 'text-text-primary hover:bg-accent hover:text-white'
                        }`}
                        onClick={() => onAction('create_dir_open', null, isRemote)}
                        onMouseEnter={() => setSelectedIndex(1)}
                    >
                        <FolderPlus size={14} />
                        <span>Create and open directory</span>
                    </div>
                    <div 
                        className={`flex items-center gap-3 px-3 py-1.5 text-[13px] cursor-default transition-colors rounded-sm mx-1 ${
                            selectedIndex === 2 ? 'bg-accent text-white' : 'text-text-primary hover:bg-accent hover:text-white'
                        }`}
                        onClick={() => onAction('create_file', null, isRemote)}
                        onMouseEnter={() => setSelectedIndex(2)}
                    >
                        <FilePlus size={14} />
                        <span>Create new file</span>
                    </div>
                    <div className="h-px bg-white/10 my-1 mx-1" />
                    <div 
                        className={`flex items-center gap-3 px-3 py-1.5 text-[13px] cursor-default transition-colors rounded-sm mx-1 ${
                            selectedIndex === 3 ? 'bg-accent text-white' : 'text-text-primary hover:bg-accent hover:text-white'
                        }`}
                        onClick={() => onAction('refresh', null, isRemote)}
                        onMouseEnter={() => setSelectedIndex(3)}
                    >
                        <RefreshCw size={14} />
                        <span>Reload</span>
                    </div>
                </>
            ) : (
                <>
                    {(() => {
                        const items: React.ReactElement[] = [];
                        
                        availableActions.forEach((action, index) => {
                            if (action === 'open') {
                                items.push(
                                    <div 
                                        key="open"
                                        className={`flex items-center gap-3 px-3 py-1.5 text-[13px] cursor-default transition-colors rounded-sm mx-1 ${
                                            selectedIndex === index ? 'bg-accent text-white' : 'text-text-primary hover:bg-accent hover:text-white'
                                        }`}
                                        onClick={() => onAction('open', file, isRemote)}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                    >
                                        <ExternalLink size={14} />
                                        <span>Open</span>
                                    </div>
                                );
                            } else if (action === 'run') {
                                items.push(
                                    <div 
                                        key="run"
                                        className={`flex items-center gap-3 px-3 py-1.5 text-[13px] cursor-default transition-colors rounded-sm mx-1 ${
                                            selectedIndex === index ? 'bg-accent text-white' : 'text-accent hover:bg-accent hover:text-white'
                                        }`}
                                        onClick={() => onAction('run', file, isRemote)}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                    >
                                        <Play size={14} />
                                        <span>Run</span>
                                    </div>
                                );
                            } else if (action === 'download') {
                                items.push(
                                    <div 
                                        key="download"
                                        className={`flex items-center gap-3 px-3 py-1.5 text-[13px] cursor-default transition-colors rounded-sm mx-1 ${
                                            selectedIndex === index ? 'bg-accent text-white' : 'text-text-primary hover:bg-accent hover:text-white'
                                        }`}
                                        onClick={() => onAction('download', file, isRemote)}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                    >
                                        <Download size={14} />
                                        <span>{isRemote ? 'Download' : 'Upload'}</span>
                                    </div>
                                );
                            } else if (action === 'rename') {
                                items.push(<div key="sep1" className="h-px bg-white/10 my-1 mx-1" />);
                                items.push(
                                    <div 
                                        key="rename"
                                        className={`flex items-center gap-3 px-3 py-1.5 text-[13px] cursor-default transition-colors rounded-sm mx-1 ${
                                            selectedIndex === index ? 'bg-accent text-white' : 'text-text-primary hover:bg-accent hover:text-white'
                                        }`}
                                        onClick={() => onAction('rename', file, isRemote)}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                    >
                                        <Edit3 size={14} />
                                        <span>Rename</span>
                                    </div>
                                );
                            } else if (action === 'delete') {
                                items.push(
                                    <div 
                                        key="delete"
                                        className={`flex items-center gap-3 px-3 py-1.5 text-[13px] cursor-default transition-colors rounded-sm mx-1 ${
                                            selectedIndex === index ? 'bg-accent text-white' : 'text-red-500 hover:bg-red-500 hover:text-white'
                                        }`}
                                        onClick={() => onAction('delete', file, isRemote)}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                    >
                                        <Trash2 size={14} />
                                        <span>Delete</span>
                                    </div>
                                );
                            } else if (action === 'properties') {
                                items.push(<div key="sep2" className="h-px bg-white/10 my-1 mx-1" />);
                                items.push(
                                    <div 
                                        key="properties"
                                        className={`flex items-center gap-3 px-3 py-1.5 text-[13px] cursor-default transition-colors rounded-sm mx-1 ${
                                            selectedIndex === index ? 'bg-accent text-white' : 'text-text-primary hover:bg-accent hover:text-white'
                                        }`}
                                        onClick={() => onAction('properties', file, isRemote)}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                    >
                                        <Info size={14} />
                                        <span>Properties</span>
                                    </div>
                                );
                            }
                        });
                        
                        return items;
                    })()}
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

