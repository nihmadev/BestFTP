import { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { FileItem, ftp } from "../../utils/api";
import { X, Loader2 } from "lucide-react";
import { getFileIcon } from "../../utils/fileIcons";
import { registerMonacoThemes, getMonacoThemeName } from "../../themes/monaco-themes";
import { VideoViewer } from "./VideoViewer";

interface EditorDialogProps {
    file: FileItem;
    isRemote: boolean;
    onClose: () => void;
    onSaveSuccess?: () => void;
    addToast: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export function EditorDialog({ file, isRemote, onClose, onSaveSuccess, addToast }: EditorDialogProps) {
    const [content, setContent] = useState<string>("");
    const [imageData, setImageData] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [originalContent, setOriginalContent] = useState<string>("");
    const [zoom, setZoom] = useState<number>(1);
    const contentRef = useRef<string>("");

    const isImage = (fileName: string) => {
        const ext = fileName.split(".").pop()?.toLowerCase();
        return ["png", "jpg", "jpeg", "gif", "bmp", "webp", "ico", "svg"].includes(ext || "");
    };


    const isVideo = (fileName: string) => {
        const ext = fileName.split(".").pop()?.toLowerCase();
        return ["mp4", "webm", "ogg", "mov", "avi", "mkv"].includes(ext || "");
    };

    const isDirty = content !== originalContent && !isImage(file.name) && !isVideo(file.name);

    const getMimeType = (fileName: string) => {
        const ext = fileName.split(".").pop()?.toLowerCase();
        switch (ext) {
            case "svg": return "image/svg+xml";
            case "png": return "image/png";
            case "jpg":
            case "jpeg": return "image/jpeg";
            case "gif": return "image/gif";
            case "webp": return "image/webp";
            case "ico": return "image/x-icon";
            default: return "image/png";
        }
    };

    useEffect(() => {
        contentRef.current = content;
    }, [content]);

    useEffect(() => {
        if (isImage(file.name)) {
            loadImage();
        } else if (isVideo(file.name)) {
            setLoading(false);
        } else {
            loadContent();
        }
    }, [file.full_path, isRemote]);

    useEffect(() => {
        if (isImage(file.name) || isVideo(file.name)) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [originalContent, file.name]);

    const loadContent = async () => {
        setLoading(true);
        try {
            const result = await ftp.readTextFile(file.full_path, isRemote);
            if (result.success && result.data !== null) {
                setContent(result.data);
                setOriginalContent(result.data);
            } else {
                addToast(result.error || "Failed to read file", "error");
                onClose();
            }
        } catch (error) {
            addToast(String(error), "error");
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const loadImage = async () => {
        setLoading(true);
        try {
            const result = await ftp.readBinaryFile(file.full_path, isRemote);
            if (result.success && result.data !== null) {
                const uint8Array = new Uint8Array(result.data);
                const blob = new Blob([uint8Array], { type: getMimeType(file.name) });
                const url = URL.createObjectURL(blob);
                setImageData(url);
            } else {
                addToast(result.error || "Failed to read image", "error");
                onClose();
            }
        } catch (error) {
            addToast(String(error), "error");
            onClose();
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        return () => {
            if (imageData) URL.revokeObjectURL(imageData);
        };
    }, [imageData]);

    const handleSave = async () => {
        const currentContent = contentRef.current;
        if (currentContent === originalContent) {
            return;
        }

        try {
            const result = await ftp.writeTextFile(file.full_path, currentContent, isRemote);
            if (result.success) {
                setOriginalContent(currentContent);
                addToast("Saved", "success");
                onSaveSuccess?.();
            } else {
                addToast(result.error || "Failed to save", "error");
            }
        } catch (error) {
            addToast(String(error), "error");
        }
    };

    const handleImageClick = (e: React.MouseEvent) => {
        if (e.button === 0) { // LMB
            setZoom(prev => Math.min(prev + 0.5, 10));
        }
    };

    const handleImageContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setZoom(prev => Math.max(prev - 0.5, 0.5));
    };

    const getLanguage = (fileName: string) => {
        const ext = fileName.split(".").pop()?.toLowerCase();
        switch (ext) {
            case "js":
            case "jsx": return "javascript";
            case "ts":
            case "tsx": return "typescript";
            case "json": return "json";
            case "css": return "css";
            case "html": return "html";
            case "md": return "markdown";
            case "py": return "python";
            case "rs": return "rust";
            case "c":
            case "cpp": return "cpp";
            case "cs": return "csharp";
            case "yml":
            case "yaml": return "yaml";
            case "xml": return "xml";
            case "sql": return "sql";
            case "php": return "php";
            case "go": return "go";
            case "java": return "java";
            case "kt": return "kotlin";
            case "swift": return "swift";
            case "dart": return "dart";
            case "rb": return "ruby";
            case "lua": return "lua";
            case "ex": return "elixir";
            case "exs": return "elixir";
            case "clj": return "clojure";
            case "cljs": return "clojurescript";
            case "cljc": return "clojurescript";
            case "edn": return "clojure";
            case "fs": return "fsharp";
            case "fsx": return "fsharp";
            case "fsi": return "fsharp";
            case "lsp": return "lisp";
            case "cl": return "common lisp";
            case "scm": return "scheme";
            case "rkt": return "racket";
            case "hs": return "haskell";
            case "lhs": return "haskell";
            case "purs": return "purescript";
            case "elm": return "elm";
            case "scala": return "scala";
            case "groovy": return "groovy";
            case "gradle": return "groovy";
            case "kts": return "kotlin";
            case "ktm": return "kotlin";
            case "ktl": return "kotlin";
            case "env": return "ini";
            case "el": return "elisp";
            case "yopta": return "YoptaScript";
            case "bf": return "brainfuck";
            case "b": return "brainfuck";
            case "r": return "R";
            case "ps1": return "powershell";
            case "psm1": return "powershell";
            case "psd1": return "powershell";
            case "ps1xml": return "powershell";
            case "pl": return "perl";
            case "pm": return "perl";
            case "jl": return "julia";
            case "toml": return "toml";
            case "ini": return "ini";
            case "cfg": return "ini";
            case "conf": return "ini";
            case "config": return "ini";
            case "zsh": return "shell";
            case "fish": return "shell";
            case "bash": return "shell";
            case "sh": return "shell";
            case "ksh": return "shell";
            case "csh": return "shell";
            case "tcsh": return "shell";
            case "mk": return "makefile";
            case "coffee": return "coffeescript";
            case "litcoffee": return "coffeescript";
            default: return "plaintext";
        }
    };

    const handleEditorDidMount = (_editor: any, monaco: any) => {
        registerMonacoThemes(monaco);
        monaco.editor.setTheme(getMonacoThemeName('paghalopi'));
    };

    const getModelUri = () => {
        return `file://${file.full_path}`;
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[2000] backdrop-blur-[4px] animate-in fade-in duration-200"
            onClick={(e) => {
                if (e.target === e.currentTarget && !isDirty) onClose();
            }}>
            <div className="w-[800px] h-[600px] max-w-[95vw] max-h-[90vh] bg-layer-default border border-card-default rounded-lg flex flex-col overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-2.5 duration-200"
                onClick={(e) => e.stopPropagation()}>
                {!isVideo(file.name) && (
                    <div className="h-10 px-4 flex items-center justify-between bg-solid-bg border-b border-card-default relative z-10">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <span className="flex items-center mt-0.5">
                                {getFileIcon(file.name, file.full_path)}
                            </span>
                            <span className="text-[13px] text-text-primary whitespace-nowrap overflow-hidden text-ellipsis">
                                {file.name}{isDirty ? "*" : ""}
                                {isImage(file.name) && ` (${Math.round(zoom * 100)}%)`}
                            </span>
                        </div>

                        <div className="flex items-center">
                            <button
                                className="w-9 h-9 flex items-center justify-center bg-transparent text-text-primary border-none cursor-pointer rounded-md transition-all hover:bg-red-500 hover:text-white"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClose();
                                }}
                                title="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex-1 relative min-h-0">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 size={32} className="animate-spin text-text-secondary" />
                        </div>
                    ) : isImage(file.name) ? (
                        <div
                            className="w-full h-full flex items-center justify-center bg-layer-default overflow-auto p-5 cursor-zoom-in select-none"
                            onMouseDown={handleImageClick}
                            onContextMenu={handleImageContextMenu}
                        >
                            {imageData ? (
                                <img
                                    src={imageData}
                                    alt={file.name}
                                    className="max-w-full max-h-full object-contain shadow-[0_0_20px_rgba(0,0,0,0.3)] transition-transform duration-200 bg-checkerboard"
                                    style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
                                />
                            ) : (
                                <span className="text-text-secondary">Failed to load content</span>
                            )}
                        </div>
                    ) : isVideo(file.name) ? (
                        <VideoViewer path={file.full_path} onClose={onClose} />
                    ) : (
                        <Editor
                            height="100%"
                            theme="vs-dark"
                            language={getLanguage(file.name)}
                            path={getModelUri()}
                            value={content}
                            onChange={(value) => setContent(value || "")}
                            onMount={handleEditorDidMount}
                            options={{
                                fontSize: 13,
                                minimap: { enabled: true },
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                                padding: { top: 8 },
                                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                renderLineHighlight: "all",
                                scrollbar: {
                                    vertical: "visible",
                                    horizontal: "visible",
                                    useShadows: false,
                                    verticalScrollbarSize: 10,
                                    horizontalScrollbarSize: 10
                                },
                                fixedOverflowWidgets: true
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
