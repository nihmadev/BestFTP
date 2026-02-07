import { Info, AlertCircle, CheckCircle } from "lucide-react";
import { Toast } from "../../hooks/useToasts";

interface ToastListProps {
    toasts: Toast[];
}

export function ToastList({ toasts }: ToastListProps) {
    return (
        <div className="fixed bottom-12 right-6 z-[10001] flex flex-col gap-3 pointer-events-none max-w-[360px] w-full items-end">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={`pointer-events-auto flex items-center gap-3 p-3 pl-4 pr-5 rounded-lg border shadow-xl backdrop-blur-md transition-all duration-300 animate-in slide-in-from-right-4 fade-in
                               ${toast.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-500' :
                            toast.type === 'success' ? 'bg-teal-500/10 border-teal-500/30 text-teal-400' :
                                'bg-layer-default/80 border-card-default text-text-primary'}`}
                >
                    <div className="shrink-0 flex items-center">
                        {toast.type === 'error' && <AlertCircle size={18} />}
                        {toast.type === 'success' && <CheckCircle size={18} />}
                        {toast.type === 'info' && <Info size={18} className="text-accent" />}
                    </div>
                    <div className="flex-1 text-[13px] font-medium leading-tight">
                        {toast.message}
                    </div>
                </div>
            ))}
        </div>
    );
}
