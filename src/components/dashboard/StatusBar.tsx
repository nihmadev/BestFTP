import { Clock, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface StatusBarProps {
    queuedCount: number;
    successCount: number;
    failedCount: number;
    currentTransfer: {
        fileName: string;
        progress: number;
        speed: string;
    } | null;
    onClearCompleted: () => void;
}

export function StatusBar({
    queuedCount,
    successCount,
    failedCount,
    currentTransfer,
    onClearCompleted
}: StatusBarProps) {
    const [visibleTransfer, setVisibleTransfer] = useState(currentTransfer);
    const [showProgress, setShowProgress] = useState(false);

    useEffect(() => {
        if (currentTransfer && currentTransfer.progress >= 0) {
            setVisibleTransfer(currentTransfer);
            setShowProgress(true);
        } else if (!currentTransfer && visibleTransfer) {
            const timer = setTimeout(() => {
                setShowProgress(false);
                setTimeout(() => {
                    setVisibleTransfer(null);
                }, 300); 
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [currentTransfer, visibleTransfer]);

    return (
        <div className="flex items-center gap-5 h-8 px-4 bg-layer-default border-t border-card-default sm:gap-3 sm:px-2 flex-shrink-0">
            <div className="flex items-center gap-5 sm:gap-3 flex-shrink-0">
                <div 
                    className="flex items-center gap-1.5 cursor-pointer hover:bg-subtle-secondary rounded px-2 py-1 transition-colors"
                    onClick={onClearCompleted}
                    title="Click to clear completed"
                >
                    <Clock size={14} className="opacity-60 text-text-primary" />
                    <span className="text-[13px] opacity-60 text-text-primary hidden sm:inline">Queue:</span>
                    <span className="text-[13px] font-semibold text-text-primary">{queuedCount}</span>
                </div>

                <div 
                    className="flex items-center gap-1.5 text-green-400 cursor-pointer hover:bg-subtle-secondary rounded px-2 py-1 transition-colors"
                    onClick={onClearCompleted}
                    title="Click to clear completed"
                >
                    <CheckCircle2 size={14} className="opacity-100" />
                    <span className="text-[13px] opacity-60 text-text-primary hidden sm:inline">Success:</span>
                    <span className="text-[13px] font-semibold">{successCount}</span>
                </div>

                <div 
                    className="flex items-center gap-1.5 text-red-400 cursor-pointer hover:bg-subtle-secondary rounded px-2 py-1 transition-colors"
                    onClick={onClearCompleted}
                    title="Click to clear completed"
                >
                    <XCircle size={14} className="opacity-100" />
                    <span className="text-[13px] opacity-60 text-text-primary hidden sm:inline">Failed:</span>
                    <span className="text-[13px] font-semibold">{failedCount}</span>
                </div>
            </div>

            {showProgress && visibleTransfer && (
                <div className="flex-1 min-w-0 mx-5 sm:mx-3 flex items-center gap-3">
                    {visibleTransfer.fileName.includes('Deleting') && (
                        <Trash2 size={14} className="text-text-primary opacity-60 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full transition-[width] duration-300 rounded-full bg-gradient-to-r from-teal-500 to-teal-400"
                                style={{ 
                                    width: `${Math.max(0, Math.min(100, visibleTransfer.progress))}%`,
                                    minWidth: visibleTransfer.progress > 0 ? '2px' : '0%'
                                }}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[13px] whitespace-nowrap overflow-hidden text-ellipsis text-text-primary opacity-80">
                            {visibleTransfer.fileName.includes('Deleting') 
                                ? visibleTransfer.fileName.replace('Deleting ', '').trim()
                                : visibleTransfer.fileName
                            }
                        </span>
                        <span className="text-[13px] font-medium text-text-primary opacity-60 hidden sm:block">
                            {visibleTransfer.speed}
                        </span>
                    </div>
                </div>
            )}

            </div>
    );
}
