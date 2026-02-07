import { LogOut, Clock } from "lucide-react";
import { RecentFolder, ftp } from "../../utils/api";
import { getFolderIcon } from "../../utils/fileIcons";

interface SidebarProps {
    recentFolders: RecentFolder[];
    onDisconnect: () => void;
    onLoadLocal: (path: string) => void;
    onItemClick?: () => void;
    className?: string; // className is used for 'open' state on mobile
}

export function Sidebar({ recentFolders, onDisconnect, onLoadLocal, onItemClick, className }: SidebarProps) {
    const isOpen = className?.includes('open');

    return (
        <div className={`w-[280px] shrink-0 bg-layer-default border-r border-card-default flex flex-col p-3 gap-1 transition-transform duration-300 overflow-x-hidden
                         fixed top-0 left-0 bottom-0 z-[1000] shadow-2xl
                         lg:static lg:translate-x-0 lg:shadow-none
                         ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <button className="h-9 flex items-center gap-3 px-3 rounded-sm bg-transparent border-none text-sm text-text-primary text-left cursor-default w-full transition-colors hover:bg-subtle-secondary active:bg-subtle-tertiary"
                onClick={onDisconnect}>
                <LogOut size={16} />
                Disconnect
            </button>

            <div className="text-[12px] font-semibold opacity-60 px-3 pt-3 pb-1 uppercase tracking-wider">QUICK ACCESS</div>
            <div className="flex flex-col gap-0.5">
                <button className="h-9 flex items-center gap-3 px-3 rounded-sm bg-transparent border-none text-sm text-text-primary text-left cursor-default w-full transition-colors hover:bg-subtle-secondary active:bg-subtle-tertiary"
                    onClick={async () => {
                        onLoadLocal(await ftp.getInitialLocalPath());
                        onItemClick?.();
                    }}>
                    {getFolderIcon("documents", false)}
                    Documents
                </button>

                {recentFolders.length > 0 && (
                    <>
                        <div className="text-[11px] font-medium opacity-50 px-3 pt-2 pb-1 flex items-center">
                            <Clock size={12} className="mr-1.5" />
                            Recent
                        </div>
                        {recentFolders.map((folder, idx) => (
                            <button
                                key={idx}
                                className="h-8 flex items-center gap-2 px-3 rounded-sm bg-transparent border-none text-[13px] text-text-primary text-left cursor-default w-full transition-colors hover:bg-subtle-secondary active:bg-subtle-tertiary"
                                onClick={() => {
                                    onLoadLocal(folder.path);
                                    onItemClick?.();
                                }}
                                title={folder.path}
                            >
                                {getFolderIcon(folder.name, false, folder.path)}
                                <span className="whitespace-nowrap overflow-hidden text-ellipsis max-w-[160px]">{folder.name}</span>
                            </button>
                        ))}
                    </>
                )}
            </div>
        </div>
    );
}
