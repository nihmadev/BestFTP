import { FileItem } from "../../utils/api";
import { getFileIcon, getFolderIcon } from "../../utils/fileIcons";
import { X, Info, Trash2, Edit3, FolderPlus } from "lucide-react";

interface RenameDialogProps {
    newName: string;
    setNewName: (name: string) => void;
    onConfirm: () => void;
    onCancel: () => void;
}

export function RenameDialog({ newName, setNewName, onConfirm, onCancel }: RenameDialogProps) {
    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200" onClick={onCancel}>
            <div className="w-full max-w-[400px] bg-layer-default border border-card-default rounded-lg shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-card-default">
                    <div className="flex items-center gap-2">
                        <Edit3 size={16} className="text-accent" />
                        <h3 className="text-sm font-semibold text-text-primary">Rename</h3>
                    </div>
                    <button onClick={onCancel} className="p-1 rounded-md hover:bg-subtle-secondary text-text-secondary transition-colors">
                        <X size={16} />
                    </button>
                </div>
                <div className="p-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-text-secondary pl-1">New Name</label>
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') onConfirm();
                                if (e.key === 'Escape') onCancel();
                            }}
                            autoFocus
                            className="h-9 w-full bg-text-box border border-card-default rounded-md px-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent transition-all"
                        />
                    </div>
                </div>
                <div className="flex items-center justify-end gap-2 px-4 py-3 bg-control-secondary/30 border-t border-card-default rounded-b-lg">
                    <button onClick={onCancel} className="px-4 py-1.5 text-sm font-medium text-text-primary hover:bg-subtle-secondary rounded-md transition-colors">Cancel</button>
                    <button onClick={onConfirm} className="px-5 py-1.5 text-sm font-semibold text-white bg-accent hover:bg-accent-hover active:bg-accent-pressed rounded-md shadow-sm transition-all active:scale-[0.98]">Rename</button>
                </div>
            </div>
        </div>
    );
}

interface CreateDialogProps {
    title: string;
    name: string;
    setName: (name: string) => void;
    onConfirm: () => void;
    onCancel: () => void;
}

export function CreateDialog({ title, name, setName, onConfirm, onCancel }: CreateDialogProps) {
    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200" onClick={onCancel}>
            <div className="w-full max-w-[400px] bg-layer-default border border-card-default rounded-lg shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-card-default">
                    <div className="flex items-center gap-2">
                        <FolderPlus size={16} className="text-accent" />
                        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
                    </div>
                    <button onClick={onCancel} className="p-1 rounded-md hover:bg-subtle-secondary text-text-secondary transition-colors">
                        <X size={16} />
                    </button>
                </div>
                <div className="p-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-text-secondary pl-1">Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') onConfirm();
                                if (e.key === 'Escape') onCancel();
                            }}
                            autoFocus
                            placeholder="Enter name..."
                            className="h-9 w-full bg-text-box border border-card-default rounded-md px-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent transition-all"
                        />
                    </div>
                </div>
                <div className="flex items-center justify-end gap-2 px-4 py-3 bg-control-secondary/30 border-t border-card-default rounded-b-lg">
                    <button onClick={onCancel} className="px-4 py-1.5 text-sm font-medium text-text-primary hover:bg-subtle-secondary rounded-md transition-colors">Cancel</button>
                    <button onClick={onConfirm} className="px-5 py-1.5 text-sm font-semibold text-white bg-accent hover:bg-accent-hover active:bg-accent-pressed rounded-md shadow-sm transition-all active:scale-[0.98]">Create</button>
                </div>
            </div>
        </div>
    );
}

interface DeleteDialogProps {
    files: FileItem[];
    onConfirm: () => void;
    onCancel: () => void;
}

export function DeleteDialog({ files, onConfirm, onCancel }: DeleteDialogProps) {
    const allDirectories = files.every(f => f.is_directory);
    const allFiles = files.every(f => !f.is_directory);

    let deleteLabel = "Delete";
    let itemType = "items";

    if (files.length === 1) {
        const isDir = files[0].is_directory;
        deleteLabel = isDir ? "Delete folder" : "Delete file";
        itemType = isDir ? "folder" : "file";
    } else if (allDirectories) {
        deleteLabel = "Delete folders";
        itemType = "folders";
    } else if (allFiles) {
        deleteLabel = "Delete files";
        itemType = "files";
    } else {
        deleteLabel = "Delete items";
        itemType = "items";
    }

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200" onClick={onCancel}>
            <div className="w-full max-w-[420px] bg-layer-default border border-card-default rounded-lg shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-card-default">
                    <div className="flex items-center gap-2 text-[#d13438]">
                        <Trash2 size={16} />
                        <h3 className="text-sm font-semibold">{deleteLabel}</h3>
                    </div>
                    <button onClick={onCancel} className="p-1 rounded-md hover:bg-subtle-secondary text-text-secondary transition-colors">
                        <X size={16} />
                    </button>
                </div>
                <div className="p-4">
                    <p className="text-sm text-text-primary mb-4 leading-relaxed">
                        Are you sure you want to delete {files.length === 1 ? <span className="font-semibold italic">{files[0].name}</span> : `${files.length} ${itemType}`}? This action cannot be undone.
                    </p>
                    <div className="flex flex-col gap-1 max-h-[160px] overflow-y-auto pr-2 bg-control-alt/30 rounded-md p-2 border border-card-default/50">
                        {files.map((file, idx) => (
                            <div key={idx} className="flex items-center gap-3 py-1.5 px-2 rounded-sm group">
                                <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                                    {file.is_directory
                                        ? getFolderIcon(file.name, false, file.full_path)
                                        : getFileIcon(file.name, file.full_path)
                                    }
                                </div>
                                <span className="text-xs text-text-primary truncate font-medium">
                                    {file.name}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex items-center justify-end gap-2 px-4 py-3 bg-control-secondary/30 border-t border-card-default rounded-b-lg">
                    <button onClick={onCancel} className="px-4 py-1.5 text-sm font-medium text-text-primary hover:bg-subtle-secondary rounded-md transition-colors">Cancel</button>
                    <button onClick={onConfirm} className="px-5 py-1.5 text-sm font-semibold text-white bg-[#d13438] hover:bg-[#a4262c] active:bg-[#841d22] rounded-md shadow-sm transition-all active:scale-[0.98]">Delete</button>
                </div>
            </div>
        </div>
    );
}

interface PropertiesDialogProps {
    file: FileItem;
    onClose: () => void;
}

export function PropertiesDialog({ file, onClose }: PropertiesDialogProps) {
    const isDir = file.is_directory;

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200" onClick={onClose}>
            <div className="w-full max-w-[440px] bg-layer-default border border-card-default rounded-lg shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-card-default">
                    <div className="flex items-center gap-2 text-accent">
                        <Info size={16} />
                        <h3 className="text-sm font-semibold text-text-primary">Properties</h3>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-md hover:bg-subtle-secondary text-text-secondary transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-5 flex flex-col gap-6">
                    <div className="flex items-center gap-5">
                        <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center bg-control-alt/30 rounded-2xl border border-card-default p-4 shadow-sm">
                            {isDir
                                ? getFolderIcon(file.name, false, file.full_path)
                                : getFileIcon(file.name, file.full_path)
                            }
                        </div>
                        <div className="flex flex-col min-w-0 pr-4">
                            <span className="text-lg font-bold text-text-primary truncate" title={file.name}>{file.name}</span>
                            <span className="text-[11px] text-text-tertiary truncate leading-tight mt-0.5 break-all whitespace-pre-wrap">{file.full_path}</span>
                        </div>
                    </div>

                    <div className="h-px bg-card-default" />

                    <div className="grid grid-cols-[110px_1fr] gap-y-4 gap-x-4">
                        <span className="text-[13px] text-text-tertiary">Type:</span>
                        <span className="text-[13px] text-text-primary font-semibold">{isDir ? 'File folder' : 'File'}</span>

                        <span className="text-[13px] text-text-tertiary">Size:</span>
                        <div className="flex flex-col">
                            <span className="text-[13px] text-text-primary font-semibold">{file.readable_size || '0 bytes'}</span>
                            <span className="text-[11px] text-text-tertiary">{file.size > 0 && `(${file.size.toLocaleString()} bytes)`}</span>
                        </div>

                        <span className="text-[13px] text-text-tertiary">Modified:</span>
                        <span className="text-[13px] text-text-primary font-semibold">{file.readable_modified}</span>

                        {!isDir && (
                            <>
                                <span className="text-[13px] text-text-tertiary">Extension:</span>
                                <span className="text-[13px] text-text-primary font-semibold uppercase">.{file.name.split('.').pop()}</span>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-end px-4 py-3 bg-control-secondary/30 border-t border-card-default rounded-b-lg">
                    <button onClick={onClose} className="px-8 py-1.5 text-sm font-semibold text-white bg-accent hover:bg-accent-hover active:bg-accent-pressed rounded-md shadow-sm transition-all active:scale-[0.98]">OK</button>
                </div>
            </div>
        </div>
    );
}
