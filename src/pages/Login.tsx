import { useState, useEffect } from "react";
import { ftp } from "../utils/api";
import { XCircle, User, Lock, Server } from "lucide-react";
import background from "../assets/background.jpeg";

interface LoginProps {
    onLoginSuccess: () => void;
}

interface SavedCredential {
    host: string;
    port: number;
    username: string;
    password?: string;
    lastUsed: number;
}

export function Login({ onLoginSuccess }: LoginProps) {
    const [host, setHost] = useState("");
    const [port, setPort] = useState(21);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [saveCreds, setSaveCreds] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isVerySmall, setIsVerySmall] = useState(false);

    const [savedCreds, setSavedCreds] = useState<SavedCredential[]>([]);

    useEffect(() => {
        const saved = localStorage.getItem("bestftp_creds");
        if (saved) {
            try {
                setSavedCreds(JSON.parse(saved));
            } catch (e) {
            }
        }

        const checkScreenSize = () => {
            setIsVerySmall(window.innerWidth < 480);
        };

        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);
        const timer = setTimeout(() => {
            checkScreenSize();
        }, 100);
        
        return () => {
            window.removeEventListener('resize', checkScreenSize);
            clearTimeout(timer);
        };
    }, []);

    const handleLogin = async (e?: React.FormEvent) => {
        e?.preventDefault();
        setError(null);
        setIsLoading(true);

        if (!host) {
            setError("Please enter a host address");
            setIsLoading(false);
            return;
        }

        try {
            const result = await ftp.connect(host, port, username || undefined, password || undefined);

            if (result.success) {
                if (saveCreds) {
                    const newCred: SavedCredential = {
                        host,
                        port,
                        username,
                        password,
                        lastUsed: Date.now(),
                    };

                    const filtered = savedCreds.filter(c => !(c.host === host && c.port === port && c.username === username));
                    const updated = [newCred, ...filtered].slice(0, 10);
                    setSavedCreds(updated);
                    localStorage.setItem("bestftp_creds", JSON.stringify(updated));
                }
                onLoginSuccess();
            } else {
                setError(result.error || "Connection failed");
            }
        } catch (err) {
            setError(`Connection error: ${err}`);
        } finally {
            setIsLoading(false);
        }
    };

    const loadCredential = (creds: SavedCredential) => {
        setHost(creds.host);
        setPort(creds.port);
        setUsername(creds.username);
        setPassword(creds.password || "");
        setSaveCreds(true);
    };

    const removeCredential = (e: React.MouseEvent, creds: SavedCredential) => {
        e.stopPropagation();
        const updated = savedCreds.filter(c => c !== creds);
        setSavedCreds(updated);
        localStorage.setItem("bestftp_creds", JSON.stringify(updated));
    };

    return (
        <div className="flex h-screen w-screen select-none relative"> 
            <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${background})` }}
            />

            <div
                className="hidden lg:block flex-[6] relative z-0"
            >
            </div>

            <div className="flex-[4] min-w-[280px] sm:min-w-[300px] flex flex-col justify-center items-center p-3 sm:p-4 md:p-6 lg:p-8 relative z-10 overflow-y-auto lg:bg-solid-bg">
                <div className="w-full max-w-[260px] sm:max-w-[280px] md:max-w-[320px] flex flex-col gap-2 sm:gap-3 md:gap-4">
                    <div className="flex justify-center -mb-8">
                        <img src="/icons/icon.png" alt="BestFTP Logo" className="w-24 h-24 rounded-2xl" />
                    </div>

                    <h2 className="text-xl sm:text-2xl font-semibold text-center mb-3 sm:mb-4 text-text-primary tracking-tight">Connect to server</h2>

                    {error && (
                        <div className="bg-red-600/70 text-white border border-red-200 rounded-sm p-2.5 text-sm">
                            <div className="flex items-center gap-2">
                                <XCircle size={16} />
                                <span>{error}</span>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="contents">
                        <div className="grid grid-cols-[1fr_100px] gap-3">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-text-primary pl-1">Host</label>
                                <div className="relative group">
                                    <input
                                        className="h-9 w-full border border-card-default rounded-md px-3 pl-[34px] bg-text-box text-text-primary outline-none transition-all lg:hover:bg-subtle-secondary"
                                        placeholder="ftpupload.net"
                                        value={host}
                                        onChange={(e) => setHost(e.target.value)}
                                    />
                                    <Server size={14} className="absolute left-3 top-[11px] text-text-secondary opacity-50 group-focus-within:opacity-100 transition-opacity" />
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-text-primary pl-1">Port</label>
                                <input
                                    type="number"
                                    className="h-9 w-full border border-card-default rounded-md px-3 bg-text-box text-text-primary outline-none transition-all lg:hover:bg-subtle-secondary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    placeholder="21"
                                    value={port}
                                    onChange={(e) => setPort(parseInt(e.target.value) || 21)}
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-text-primary pl-1">Username</label>
                            <div className="relative group">
                                <input
                                    className="h-9 w-full border border-card-default rounded-md px-3 pl-[34px] bg-text-box text-text-primary outline-none transition-all lg:hover:bg-subtle-secondary"
                                    placeholder="example@example.com"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                />
                                <User size={14} className="absolute left-3 top-[11px] text-text-secondary opacity-50 group-focus-within:opacity-100 transition-opacity" />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-text-primary pl-1">Password</label>
                            <div className="relative group">
                                <input
                                    type="password"
                                    className="h-9 w-full border border-card-default rounded-md px-3 pl-[34px] bg-text-box text-text-primary outline-none transition-all lg:hover:bg-subtle-secondary"
                                    placeholder="••••••••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <Lock size={14} className="absolute left-3 top-[11px] text-text-secondary opacity-50 group-focus-within:opacity-100 transition-opacity" />
                            </div>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                className="appearance-none w-5 h-5 border border-text-tertiary rounded-[4px] bg-control-alt cursor-pointer relative transition-all checked:bg-accent checked:border-accent
                                           hover:border-accent checked:after:content-[''] checked:after:absolute checked:after:left-[6px] checked:after:top-[1.5px] 
                                           checked:after:w-[6px] checked:after:h-[11px] checked:after:border-white checked:after:border-r-2 checked:after:border-b-2 checked:after:rotate-45
                                           focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                                checked={saveCreds}
                                onChange={(e) => setSaveCreds(e.target.checked)}
                            />
                            <span className="text-sm text-text-primary">Save credentials</span>
                        </label>

                        <button type="submit"
                            className={`h-9 rounded-md font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm
                                           ${isLoading ? 'bg-control-secondary text-text-tertiary cursor-not-allowed' : 'bg-accent text-white hover:bg-accent-hover active:bg-accent-pressed active:scale-[0.98]'}`}
                            disabled={isLoading}>
                            {isLoading ? "Connecting..." : "Login"}
                        </button>

                        {isLoading && (
                            <div className="h-[3px] w-full bg-control-alt overflow-hidden relative rounded-[2px]">
                                <div className="absolute top-0 bottom-0 bg-accent w-[30%] animate-[indeterminate_1.5s_infinite_ease-in-out]"></div>
                            </div>
                        )}
                    </form>

                    {savedCreds.length > 0 && (
                        <div className="mt-2 sm:mt-3 md:mt-4 lg:mt-6 w-full animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150 fill-mode-both">
                            <div className="text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] font-bold text-text-tertiary mb-1 sm:mb-1.5 lg:mb-2 uppercase tracking-widest pl-1">Recent Connections</div>
                            <div className="flex flex-col gap-0.5 sm:gap-0.5 md:gap-1 lg:gap-1.5 max-h-[80px] sm:max-h-[90px] md:max-h-[110px] lg:max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                                {savedCreds.map((creds, idx) => (
                                    <div
                                        key={idx}
                                        className="group p-1 px-1.5 sm:p-1.5 px-2 md:p-2 lg:p-2.5 lg:px-3 bg-control-secondary/50 rounded-lg cursor-pointer flex items-center justify-between border border-card-default/50 hover:bg-subtle-secondary hover:border-accent/30 transition-all duration-200"
                                        onClick={() => loadCredential(creds)}
                                    >
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-semibold text-[10px] sm:text-[11px] md:text-[12px] lg:text-[13px] text-text-primary truncate">{creds.host}:{creds.port}</span>
                                            {creds.username && <span className="text-[8px] sm:text-[9px] md:text-[10px] lg:text-[11px] text-text-tertiary truncate">{creds.username}</span>}
                                        </div>
                                        <div className="flex items-center gap-1 sm:gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="w-px h-5 sm:h-6 bg-card-default"></div>
                                            <button
                                                onClick={(e) => removeCredential(e, creds)}
                                                className="p-1 sm:p-1.5 text-text-tertiary hover:text-red-500 hover:bg-red-500/10 rounded-md transition-all"
                                                title="Remove"
                                            >
                                                <XCircle size={isVerySmall ? 14 : 16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
