import { Computer, Home, ChevronRight } from "lucide-react";
import { useEffect, useRef } from "react";

interface BreadcrumbsProps {
    path: string;
    breadcrumbs: string[];
    isRemote: boolean;
    onNavigate: (index: number) => void;
    onGoHome: () => void;
}

export function Breadcrumbs({ path, breadcrumbs, isRemote, onNavigate, onGoHome }: BreadcrumbsProps) {
    const breadcrumbRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const breadcrumbBar = breadcrumbRef.current;
        if (!breadcrumbBar) return;

        const handleWheel = (e: WheelEvent) => {
            if (breadcrumbBar.scrollWidth > breadcrumbBar.clientWidth) {
                e.preventDefault();
                breadcrumbBar.scrollLeft += e.deltaY;
            }
        };

        breadcrumbBar.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            breadcrumbBar.removeEventListener('wheel', handleWheel);
        };
    }, []);

    return (
        <div className="flex items-center gap-0.5 px-2 py-1 mb-3 overflow-x-auto whitespace-nowrap text-sm min-h-[32px] rounded-sm scrollbar-hide" ref={breadcrumbRef}>
            <div
                className={`cursor-default px-1.5 py-0.5 rounded-[4px] flex items-center transition-colors hover:bg-subtle-secondary hover:text-text-primary 
                            ${(!isRemote && (path.endsWith(":/") || path.endsWith(":\\"))) || (isRemote && path === '/') ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}
                onClick={onGoHome}
            >
                {isRemote ? <Home size={16} /> : <Computer size={16} />}
            </div>
            {breadcrumbs.map((part, i) => (
                <div key={i} className="flex items-center">
                    <span className="opacity-40 m-0.5 text-[10px]"><ChevronRight size={12} /></span>
                    <div
                        className={`cursor-default px-1.5 py-0.5 rounded-[4px] transition-colors hover:bg-subtle-secondary hover:text-text-primary 
                                    ${i === breadcrumbs.length - 1 ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}
                        onClick={() => onNavigate(i)}
                    >
                        {part}
                    </div>
                </div>
            ))}
        </div>
    );
}
