import { useState, useCallback } from 'react';

export interface TransferItem {
    id: string;
    fileName: string;
    progress: number;
    speed: string;
    status: 'queued' | 'transferring' | 'success' | 'failed';
    error?: string;
}

export function useTransferQueue() {
    const [queue, setQueue] = useState<TransferItem[]>([]);
    const [currentTransfer, setCurrentTransfer] = useState<TransferItem | null>(null);

    const queuedCount = queue.filter(t => t.status === 'queued').length;
    const successCount = queue.filter(t => t.status === 'success').length;
    const failedCount = queue.filter(t => t.status === 'failed').length;

    const addToQueue = useCallback((fileName: string) => {
        const newItem: TransferItem = {
            id: `${Date.now()}-${Math.random()}`,
            fileName,
            progress: 0,
            speed: '0 KB/s',
            status: 'queued'
        };
        setQueue(prev => [...prev, newItem]);
        return newItem.id;
    }, []);

    const startTransfer = useCallback((id: string) => {
        setQueue(prev => prev.map(item => 
            item.id === id ? { ...item, status: 'transferring' as const } : item
        ));
        const item = queue.find(t => t.id === id);
        if (item) {
            setCurrentTransfer({ ...item, status: 'transferring' });
        }
    }, [queue]);

    const updateProgress = useCallback((id: string, progress: number, speed: string) => {
        setQueue(prev => prev.map(item =>
            item.id === id ? { ...item, progress, speed } : item
        ));
        setCurrentTransfer(prev => 
            prev?.id === id ? { ...prev, progress, speed } : prev
        );
    }, []);

    const simulateProgress = useCallback((id: string, durationMs: number = 2000) => {
        const startTime = Date.now();
        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(95, (elapsed / durationMs) * 100);
            const speed = `${Math.floor(Math.random() * 500 + 500)} KB/s`;
            
            updateProgress(id, progress, speed);
            
            if (progress >= 95) {
                clearInterval(interval);
            }
        }, 100);
        
        return () => clearInterval(interval);
    }, [updateProgress]);

    const completeTransfer = useCallback((id: string, success: boolean, error?: string) => {
        const status = success ? 'success' : 'failed';
        setQueue(prev => prev.map(item =>
            item.id === id ? { ...item, status, progress: 100, error } : item
        ));
        setCurrentTransfer(null);
    }, []);

    const clearCompleted = useCallback(() => {
        setQueue(prev => prev.filter(item => 
            item.status !== 'success' && item.status !== 'failed'
        ));
    }, []);

    return {
        queue,
        currentTransfer,
        queuedCount,
        successCount,
        failedCount,
        addToQueue,
        startTransfer,
        updateProgress,
        simulateProgress,
        completeTransfer,
        clearCompleted
    };
}
