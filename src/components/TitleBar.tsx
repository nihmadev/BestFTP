import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Square } from "lucide-react";

export function TitleBar({ currentPage = "dashboard" }: { currentPage?: "login" | "dashboard" }) {
  const [isMaximized, setIsMaximized] = useState(false);
  const appWindow = getCurrentWindow();

  useEffect(() => {
    const checkMaximized = async () => {
      const maximized = await appWindow.isMaximized();
      setIsMaximized(maximized);
    };

    checkMaximized();

    const unlisten = appWindow.onResized(() => {
      checkMaximized();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleMinimize = () => {
    appWindow.minimize();
  };

  const handleMaximize = () => {
    appWindow.toggleMaximize();
  };

  const handleClose = () => {
    appWindow.close();
  };

  return (
    <div className={`h-8 fixed top-0 left-0 right-0 z-[9999] flex justify-between items-center select-none border-b border-white/10 ${currentPage === "login" ? "bg-solid-bg" : "bg-control-secondary"}`} data-tauri-drag-region>
      <div className="flex items-center pl-1 flex-1 h-full" data-tauri-drag-region>
        <img src="/icons/icon.png" alt="BestFTP" className="w-[30px] h-full object-contain pointer-events-none" />
        <span className="text-[13px] text-text-primary font-medium ml-1" data-tauri-drag-region>
          BestFTP
        </span>
      </div>
      <div className="flex h-full [app-region:no-drag]">
        <button
          className="w-11 h-full border-none bg-transparent text-text-primary cursor-pointer flex items-center justify-center transition-colors hover:bg-subtle-secondary active:bg-subtle-tertiary"
          onClick={handleMinimize}
          aria-label="Minimize"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="0" y="5" width="12" height="2" fill="currentColor" />
          </svg>
        </button>
        <button
          className="w-11 h-full border-none bg-transparent text-text-primary cursor-pointer flex items-center justify-center transition-colors hover:bg-subtle-secondary active:bg-subtle-tertiary"
          onClick={handleMaximize}
          aria-label={isMaximized ? "Restore" : "Maximize"}
        >
          <Square size={13} />
        </button>
        <button
          className="w-11 h-full border-none bg-transparent text-text-primary cursor-pointer flex items-center justify-center transition-colors hover:bg-[#e81123] hover:text-white active:bg-[#c50f1f]"
          onClick={handleClose}
          aria-label="Close"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path
              d="M 2,2 L 10,10 M 10,2 L 2,10"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
