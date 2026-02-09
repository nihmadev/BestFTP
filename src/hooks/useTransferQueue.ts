import { useState, useCallback, useRef, useEffect } from 'react';
import { ftp } from '../utils/api';

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
    const queueRef = useRef<TransferItem[]>([]);
    const [currentTransfer, setCurrentTransfer] = useState<TransferItem | null>(null);
    useEffect(() => {
        let unlisten: (() => void) | undefined;

        const setupDeleteProgressListener = async () => {
            try {
                unlisten = await ftp.onDeleteProgress((event) => {
                    const payload = event.payload;
                    setCurrentTransfer(prev => {
                        if (prev && prev.fileName.includes('Deleting') && payload.progress >= 0) {
                            return {
                                ...prev,
                                progress: payload.progress,
                                speed: `${payload.deleted_items}/${payload.total_items} items`
                            };
                        }
                        return prev;
                    });
                    setQueue(prev => prev.map(item => {
                        if (item.fileName.includes('Deleting') && item.status === 'transferring') {
                            return {
                                ...item,
                                progress: payload.progress,
                                speed: `${payload.deleted_items}/${payload.total_items} items`
                            };
                        }
                        return item;
                    }));
                });
            } catch (error) {
                console.error('Failed to setup delete progress listener:', error);
            }
        };

        setupDeleteProgressListener();

        return () => {
            if (unlisten) {
                unlisten();
            }
        };
    }, []);

    const updateQueue = useCallback((newQueue: TransferItem[] | ((prev: TransferItem[]) => TransferItem[])) => {
        setQueue(prev => {
            const next = typeof newQueue === 'function' ? newQueue(prev) : newQueue;
            queueRef.current = next;
            return next;
        });
    }, []);

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
        updateQueue(prev => [...prev, newItem]);
        return newItem.id;
    }, [updateQueue]);

    const startTransfer = useCallback((id: string) => {
        updateQueue(prev => prev.map(item =>
            item.id === id ? { ...item, status: 'transferring' as const } : item
        ));
        const item = queueRef.current.find(t => t.id === id);
        if (item) {
            setCurrentTransfer({ ...item, status: 'transferring' });
        }
        setTimeout(() => {
            const queueItem = queueRef.current.find(t => t.id === id && t.status === 'transferring');
            if (queueItem) {
                setCurrentTransfer(prev => {
                    if (!prev || prev.id !== id) {
                        return { ...queueItem, status: 'transferring' };
                    }
                    return prev;
                });
            }
        }, 10);
    }, [updateQueue]);

    const updateProgress = useCallback((id: string, progress: number, speed: string) => {
        setQueue(prev => prev.map(item =>
            item.id === id ? { ...item, progress, speed } : item
        ));
        setCurrentTransfer(prev => {
            if (prev?.id === id) {
                return { ...prev, progress, speed };
            }
            const queueItem = queueRef.current.find(item => 
                item.id === id && item.status === 'transferring'
            );
            if (queueItem) {
                return { ...queueItem, progress, speed };
            }
            return prev;
        });
    }, []);

    const simulateProgress = useCallback((id: string, durationMs: number = 2000) => {
        const startTime = Date.now();
        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(100, (elapsed / durationMs) * 100);
            const speed = `${Math.floor(Math.random() * 500 + 500)} KB/s`;

            updateProgress(id, progress, speed);

            if (progress >= 100) {
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
        setCurrentTransfer(prev => {
            if (prev?.id === id) {
                return { ...prev, progress: 100 };
            }
            return prev;
        });
        setTimeout(() => {
            setCurrentTransfer(prev => prev?.id === id ? null : prev);
        }, 1000);
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
