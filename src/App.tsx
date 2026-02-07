import { useState, useEffect } from "react";
import { Login } from "./pages/Login.tsx";
import { Dashboard } from "./pages/Dashboard.tsx";
import { TitleBar } from "./components/TitleBar.tsx";

function App() {
  const [view, setView] = useState<"login" | "dashboard">("login");

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && (e.key === 'f' || e.key === 'F')) ||
        e.key === 'F3' ||
        (e.ctrlKey && (e.key === 'h' || e.key === 'H')) ||
        (e.ctrlKey && (e.key === 'p' || e.key === 'P')) ||
        (e.ctrlKey && (e.key === 'g' || e.key === 'G')) ||
        e.key === 'F12'
      ) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen pt-8">
      <TitleBar currentPage={view} />
      {view === "login" && <Login onLoginSuccess={() => setView("dashboard")} />}
      {view === "dashboard" && <Dashboard onLogout={() => setView("login")} />}
    </div>
  );
}

export default App;