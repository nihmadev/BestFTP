import { useState, useCallback, useEffect, useRef } from "react";
import { ftp, FileItem, RecentFolder } from "../utils/api";

export function useFileSystem(addToast: (msg: string, type?: any) => void) {
    const [localPath, setLocalPath] = useState<string>("");
    const [remotePath, setRemotePath] = useState<string>("/");

    const [localFiles, setLocalFiles] = useState<FileItem[]>([]);
    const [remoteFiles, setRemoteFiles] = useState<FileItem[]>([]);
    const [recentFolders, setRecentFolders] = useState<RecentFolder[]>([]);

    const [localLoading, setLocalLoading] = useState<boolean | string>(false);
    const [remoteLoading, setRemoteLoading] = useState<boolean | string>(false);

    const [localHistory, setLocalHistory] = useState<string[]>([]);
    const [localHistoryIndex, setLocalHistoryIndex] = useState<number>(-1);
    const [remoteHistory, setRemoteHistory] = useState<string[]>([]);
    const [remoteHistoryIndex, setRemoteHistoryIndex] = useState<number>(-1);

    const [localBreadcrumbs, setLocalBreadcrumbs] = useState<string[]>([]);
    const [remoteBreadcrumbs, setRemoteBreadcrumbs] = useState<string[]>([]);

    const localHistoryIndexRef = useRef(localHistoryIndex);
    const remoteHistoryIndexRef = useRef(remoteHistoryIndex);
    const localPathRef = useRef(localPath);
    const remotePathRef = useRef(remotePath);
    const loadingRemotePath = useRef<string | null>(null);
    const localBreadcrumbsRef = useRef(localBreadcrumbs);
    const remoteBreadcrumbsRef = useRef(remoteBreadcrumbs);
    const localHistoryRef = useRef(localHistory);
    const remoteHistoryRef = useRef(remoteHistory);

    useEffect(() => { localHistoryIndexRef.current = localHistoryIndex; }, [localHistoryIndex]);
    useEffect(() => { remoteHistoryIndexRef.current = remoteHistoryIndex; }, [remoteHistoryIndex]);
    useEffect(() => { localPathRef.current = localPath; }, [localPath]);
    useEffect(() => { remotePathRef.current = remotePath; }, [remotePath]);
    useEffect(() => { localBreadcrumbsRef.current = localBreadcrumbs; }, [localBreadcrumbs]);
    useEffect(() => { remoteBreadcrumbsRef.current = remoteBreadcrumbs; }, [remoteBreadcrumbs]);
    useEffect(() => { localHistoryRef.current = localHistory; }, [localHistory]);
    useEffect(() => { remoteHistoryRef.current = remoteHistory; }, [remoteHistory]);

    const loadLocal = useCallback(async (path: string, skipHistory = false) => {
        setLocalLoading(true);
        try {
            const res = await ftp.listLocalFiles(path);
            if (res.success && res.data) {
                const isRoot = path === "/" || (path.includes(':') && (path.endsWith(":/") || path.endsWith(":\\")));
                const filesWithParent = isRoot ? res.data : [
                    {
                        name: "..",
                        full_path: path,
                        is_directory: true,
                        size: 0,
                        modified: "",
                        readable_size: "",
                        readable_modified: ""
                    } as FileItem,
                    ...res.data
                ];
                
                setLocalFiles(filesWithParent);
                setLocalPath(path);
                ftp.saveLastLocalPath(path);

                if (!skipHistory) {
                    setLocalHistory(prev => {
                        const newHistory = prev.slice(0, localHistoryIndexRef.current + 1);
                        newHistory.push(path);
                        setLocalHistoryIndex(newHistory.length - 1);
                        return newHistory;
                    });
                }

                const normalized = path.replace(/\\/g, '/');
                const parts = normalized.split('/').filter(p => p);
                setLocalBreadcrumbs(parts);
            }
        } catch (e) {
        } finally {
            setLocalLoading(false);
        }
    }, []);

    const loadRemote = useCallback(async (path: string, skipHistory = false) => {
        if (loadingRemotePath.current === path) return;
        loadingRemotePath.current = path;
        setRemoteLoading(true);
        try {
            const res = await ftp.listRemoteFiles(path);
            if (res.success && res.data) {
                const isRoot = path === "/" || path === "";
                const filesWithParent = isRoot ? res.data : [
                    {
                        name: "..",
                        full_path: path,
                        is_directory: true,
                        size: 0,
                        modified: "",
                        readable_size: "",
                        readable_modified: ""
                    } as FileItem,
                    ...res.data
                ];
                
                setRemoteFiles(filesWithParent);
                setRemotePath(path);

                if (!skipHistory) {
                    setRemoteHistory(prev => {
                        const newHistory = prev.slice(0, remoteHistoryIndexRef.current + 1);
                        newHistory.push(path);
                        setRemoteHistoryIndex(newHistory.length - 1);
                        return newHistory;
                    });
                }

                const parts = path.split('/').filter(p => p);
                setRemoteBreadcrumbs(parts);
            } else if (res.error) {
                addToast(res.error, 'error');
            }
        } catch (e) {
            addToast("Failed to load remote directory", 'error');
        } finally {
            setRemoteLoading(false);
            loadingRemotePath.current = null;
        }
    }, [addToast]);

    const navigateLocalUp = useCallback(() => {
        const currentPath = localPathRef.current;
        const lastSlash = Math.max(currentPath.lastIndexOf('/'), currentPath.lastIndexOf('\\'));
        if (lastSlash <= 0) {
            if (currentPath.endsWith(":/") || currentPath.endsWith(":\\")) return;
        }

        let parent = currentPath.substring(0, lastSlash);
        if (currentPath.includes(':') && parent.length === 2 && parent.endsWith(':')) {
            parent += "/";
        }
        if (!parent) parent = "/";

        if (parent !== currentPath) {
            loadLocal(parent);
        }
    }, [loadLocal]);

    const navigateRemoteUp = useCallback(() => {
        const currentPath = remotePathRef.current;
        if (currentPath === "/" || currentPath === "") return;
        const lastSlash = currentPath.lastIndexOf('/');
        if (lastSlash <= 0) {
            loadRemote("/");
            return;
        }
        const parent = currentPath.substring(0, lastSlash);
        loadRemote(parent);
    }, [loadRemote]);

    const navigateLocalBreadcrumb = useCallback((index: number) => {
        const parts = localBreadcrumbsRef.current.slice(0, index + 1);
        let newPath = "";

        if (parts[0] && parts[0].includes(':')) {
            if (parts.length === 1) {
                newPath = parts[0] + "/";
            } else {
                newPath = parts.join('\\');
            }
        } else {
            newPath = "/" + parts.join('/');
        }
        loadLocal(newPath);
    }, [loadLocal]);

    const navigateRemoteBreadcrumb = useCallback((index: number) => {
        const parts = remoteBreadcrumbsRef.current.slice(0, index + 1);
        const newPath = "/" + parts.join('/');
        loadRemote(newPath);
    }, [loadRemote]);

    const goBack = useCallback((activePane: 'local' | 'remote') => {
        if (activePane === 'local') {
            const index = localHistoryIndexRef.current;
            const history = localHistoryRef.current;
            if (index > 0) {
                const prevIndex = index - 1;
                const prevPath = history[prevIndex];
                setLocalHistoryIndex(prevIndex);
                loadLocal(prevPath, true);
            }
        } else {
            const index = remoteHistoryIndexRef.current;
            const history = remoteHistoryRef.current;
            if (index > 0) {
                const prevIndex = index - 1;
                const prevPath = history[prevIndex];
                setRemoteHistoryIndex(prevIndex);
                loadRemote(prevPath, true);
            }
        }
    }, [loadLocal, loadRemote]);

    const goForward = useCallback((activePane: 'local' | 'remote') => {
        if (activePane === 'local') {
            const index = localHistoryIndexRef.current;
            const history = localHistoryRef.current;
            if (index < history.length - 1) {
                const nextIndex = index + 1;
                const nextPath = history[nextIndex];
                setLocalHistoryIndex(nextIndex);
                loadLocal(nextPath, true);
            }
        } else {
            const index = remoteHistoryIndexRef.current;
            const history = remoteHistoryRef.current;
            if (index < history.length - 1) {
                const nextIndex = index + 1;
                const nextPath = history[nextIndex];
                setRemoteHistoryIndex(nextIndex);
                loadRemote(nextPath, true);
            }
        }
    }, [loadLocal, loadRemote]);

    const refreshRecentFolders = useCallback(async () => {
        const recents = await ftp.getRecentFolders();
        if (recents.success && recents.data) {
            setRecentFolders(recents.data);
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            try {
                const docs = await ftp.getInitialLocalPath();
                const initialPath = docs || "C:/";
                loadLocal(initialPath);
                loadRemote("/");
                refreshRecentFolders();
            } catch (e) {
            }
        };
        init();
    }, [loadLocal, loadRemote, refreshRecentFolders]);

    return {
        localPath, remotePath,
        localFiles, remoteFiles,
        recentFolders,
        localLoading, remoteLoading,
        setLocalLoading, setRemoteLoading,
        localBreadcrumbs, remoteBreadcrumbs,
        localHistoryIndex, remoteHistoryIndex,
        localHistory, remoteHistory,
        loadLocal, loadRemote,
        navigateLocalUp, navigateRemoteUp,
        navigateLocalBreadcrumb, navigateRemoteBreadcrumb,
        goBack, goForward,
        refreshRecentFolders
    };
}
