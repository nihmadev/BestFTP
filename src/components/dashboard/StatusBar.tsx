import { Clock, CheckCircle2, XCircle } from 'lucide-react';

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
    return (
        <div className="flex items-center gap-5 h-8 px-4 bg-layer-default border-t border-card-default sm:gap-3 sm:px-2 flex-shrink-0">
            <div className="flex items-center gap-5 sm:gap-3 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                    <Clock size={14} className="opacity-60 text-text-primary" />
                    <span className="text-[13px] opacity-60 text-text-primary hidden sm:inline">Queue:</span>
                    <span className="text-[13px] font-semibold text-text-primary">{queuedCount}</span>
                </div>

                <div className="flex items-center gap-1.5 text-green-400">
                    <CheckCircle2 size={14} className="opacity-100" />
                    <span className="text-[13px] opacity-60 text-text-primary hidden sm:inline">Success:</span>
                    <span className="text-[13px] font-semibold">{successCount}</span>
                </div>

                <div className="flex items-center gap-1.5 text-red-400">
                    <XCircle size={14} className="opacity-100" />
                    <span className="text-[13px] opacity-60 text-text-primary hidden sm:inline">Failed:</span>
                    <span className="text-[13px] font-semibold">{failedCount}</span>
                </div>
            </div>

            {currentTransfer && (
                <div className="flex-1 min-w-0 mx-5 sm:mx-3 flex flex-col justify-center gap-1">
                    <span className="text-[13px] whitespace-nowrap overflow-hidden text-ellipsis text-text-primary">
                        {currentTransfer.fileName}
                    </span>
                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-linear-to-r from-teal-500 to-teal-400 transition-[width] duration-300 rounded-full"
                            style={{ width: `${currentTransfer.progress}%` }}
                        />
                    </div>
                </div>
            )}

            {currentTransfer && (
                <div className="flex-shrink-0 hidden sm:block">
                    <span className="text-[13px] font-semibold text-text-primary">{currentTransfer.speed}</span>
                </div>
            )}

            {(successCount > 0 || failedCount > 0) && (
                <div className="flex items-center">
                    <button
                        className="h-6 px-3 bg-control-secondary border border-card-default rounded-md text-text-primary text-[11px] font-medium cursor-pointer transition-all hover:bg-subtle-secondary active:scale-[0.98]"
                        onClick={onClearCompleted}
                    >
                        Clear
                    </button>
                </div>
            )}
        </div>
    );
}
