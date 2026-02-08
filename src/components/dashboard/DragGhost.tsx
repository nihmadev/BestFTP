
import { RefObject } from "react";
import { FileItem } from "../../utils/api";
import { getFileIcon, getFolderIcon } from "../../utils/fileIcons";

interface DragGhostProps {
    isDragging: boolean;
    x: number;
    y: number;
    items: FileItem[];
    label: string;
    dragGhostRef: RefObject<HTMLDivElement | null>;
}

export const DragGhost = ({ isDragging, x, y, items, label, dragGhostRef }: DragGhostProps) => {
    if (!isDragging) return null;

    return (
        <div
            ref={dragGhostRef}
            className="fixed pointer-events-none z-[10000] flex items-center bg-accent-secondary border border-accent rounded-md px-3 py-2 shadow-2xl opacity-90 transition-transform duration-0"
            style={{
                left: 0,
                top: 0,
                transform: `translate(${x + 10}px, ${y + 10}px)`,
            }}
        >
            {items.length === 1 ? (
                <>
                    <span className="flex items-center mr-2">
                        {items[0].is_directory
                            ? getFolderIcon(items[0].name, false, items[0].full_path)
                            : getFileIcon(items[0].name, items[0].full_path)
                        }
                    </span>
                    <div className="text-[13px] font-medium text-text-primary">{label}</div>
                </>
            ) : (
                <>
                    <div className="relative w-6 h-6 mr-3">
                        {items.slice(0, Math.min(3, items.length)).map((item, index) => (
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
                    <div className="text-[13px] font-medium text-text-primary">{label}</div>
                </>
            )}
        </div>
    );
};
