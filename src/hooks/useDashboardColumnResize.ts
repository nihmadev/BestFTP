
import { useState, useCallback } from 'react';

export const useDashboardColumnResize = () => {
    const [localColumnWidths, setLocalColumnWidths] = useState({
        name: 2,
        size: 1,
        modified: 1.2
    });

    const [remoteColumnWidths, setRemoteColumnWidths] = useState({
        name: 2,
        size: 1,
        modified: 1.2
    });

    const handleColumnResize = useCallback((columnName: 'name' | 'size', e: React.MouseEvent, isRemote: boolean) => {
        e.preventDefault();
        const startX = e.clientX;
        const currentWidths = isRemote ? remoteColumnWidths : localColumnWidths;
        const startWidths = { ...currentWidths };
        const container = (e.currentTarget as HTMLElement).closest('[data-pane]');
        const containerWidth = container?.clientWidth || 800;
        const pixelToFr = 10 / containerWidth;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaFr = deltaX * pixelToFr;
            const setWidths = isRemote ? setRemoteColumnWidths : setLocalColumnWidths;

            if (columnName === 'name') {
                setWidths({
                    ...startWidths,
                    name: Math.max(0.5, startWidths.name + deltaFr),
                    size: Math.max(0.5, startWidths.size - deltaFr)
                });
            } else {
                setWidths({
                    ...startWidths,
                    size: Math.max(0.5, startWidths.size + deltaFr),
                    modified: Math.max(0.5, startWidths.modified - deltaFr)
                });
            }
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [remoteColumnWidths, localColumnWidths]);

    return {
        localColumnWidths,
        remoteColumnWidths,
        handleColumnResize
    };
};
