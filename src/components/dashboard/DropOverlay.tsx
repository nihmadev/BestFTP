
import { ArrowDown } from "lucide-react";

interface DropOverlayProps {
    isActive: boolean;
    currentPath: string;
}

export const DropOverlay = ({ isActive, currentPath }: DropOverlayProps) => (
    <div className={`absolute inset-0 bg-accent/10 border-2 border-dashed border-accent flex flex-col items-center justify-center p-5 z-20 pointer-events-none transition-opacity duration-200 
                    ${isActive ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex flex-col items-center gap-3 scale-anim animate-in fade-in zoom-in duration-300">
            <span className="text-accent">
                <ArrowDown size={48} />
            </span>
            <div className="text-lg font-semibold text-text-primary">Drop here to move/copy</div>
            <div className="text-xs text-text-secondary opacity-80">to {currentPath}</div>
        </div>
    </div>
);
