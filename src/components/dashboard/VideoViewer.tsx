import { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw, RotateCw, X } from 'lucide-react';
import { tauriApi } from '../../lib/tauri-api';

interface VideoViewerProps {
    path: string;
    onClose?: () => void;
}

export const VideoViewer = ({ path, onClose }: VideoViewerProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [videoUrl, setVideoUrl] = useState<string>('');
    const [loadError, setLoadError] = useState<string>('');

    useEffect(() => {
        const loadVideo = () => {
            try {
                setLoadError('');
                const assetUrl = tauriApi.getAssetUrl(path);
                setVideoUrl(assetUrl);
            } catch (error) {
                setLoadError(`Failed to load video: ${error}`);
            }
        };

        loadVideo();
    }, [path]);

    useEffect(() => {
        const handleMouseMove = () => {
            setShowControls(true);
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
            controlsTimeoutRef.current = setTimeout(() => {
                if (isPlaying) setShowControls(false);
            }, 3000);
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        };
    }, [isPlaying]);

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        if (videoRef.current) {
            videoRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const formatTime = (time: number) => {
        const h = Math.floor(time / 3600);
        const m = Math.floor((time % 3600) / 60);
        const s = Math.floor(time % 60);
        return `${h > 0 ? h + ':' : ''}${m.toString().padStart(h > 0 ? 2 : 1, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setVolume(val);
        if (videoRef.current) {
            videoRef.current.volume = val;
            videoRef.current.muted = val === 0;
            setIsMuted(val === 0);
        }
    };

    const toggleFullscreen = () => {
        if (videoRef.current) {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                videoRef.current.parentElement?.requestFullscreen();
            }
        }
    };

    const skip = (amount: number) => {
        if (videoRef.current) {
            videoRef.current.currentTime += amount;
        }
    };

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div
            className={`relative w-full h-full bg-black group overflow-hidden ${!showControls ? 'cursor-none' : ''}`}
        >
            <video
                ref={videoRef}
                src={videoUrl}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onClick={togglePlay}
                onContextMenu={(e) => e.preventDefault()}
                className="w-full h-full object-contain cursor-pointer"
                onError={(e) => {
                    console.error('Video error:', e);
                    setLoadError('Failed to load video file');
                }}
            />
            {onClose && (
                <button
                    className={`absolute top-4 right-4 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-black/50 text-white transition-opacity duration-300 hover:bg-red-500/80 ${showControls ? 'opacity-100' : 'opacity-0'}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                >
                    <X size={20} />
                </button>
            )}

            {loadError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-red-500 z-10">
                    <p className="px-4 text-center">{loadError}</p>
                </div>
            )}
            <div className={`absolute bottom-0 left-0 right-0 p-5 pt-10 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 z-20 flex flex-col gap-3 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                <div className="relative w-full h-1 group/progress cursor-pointer bg-white/20 rounded-full overflow-hidden hover:h-1.5 transition-[height]">
                    <div
                        className="absolute h-full bg-teal-500 rounded-full transition-[width] duration-100 ease-linear"
                        style={{ width: `${progress}%` }}
                    />
                    <input
                        type="range"
                        min="0"
                        max={duration || 0}
                        step="0.1"
                        value={currentTime}
                        onChange={handleSeek}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={togglePlay} className="p-2 transition-transform active:scale-95 text-white hover:bg-white/10 rounded-full">
                            {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                        </button>

                        <div className="flex items-center gap-1 group">
                            <button onClick={() => skip(-10)} className="p-1.5 text-white hover:bg-white/10 rounded-full" title="Back 10s">
                                <RotateCcw size={18} />
                            </button>
                            <button onClick={() => skip(10)} className="p-1.5 text-white hover:bg-white/10 rounded-full" title="Forward 10s">
                                <RotateCw size={18} />
                            </button>
                        </div>

                        <div className="text-[13px] font-medium text-white/80 flex items-center gap-1 min-w-[100px]">
                            <span>{formatTime(currentTime)}</span>
                            <span className="text-white/40">/</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 group/volume">
                            <button onClick={toggleMute} className="p-2 text-white hover:bg-white/10 rounded-full">
                                {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                            </button>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={isMuted ? 0 : volume}
                                onChange={handleVolumeChange}
                                className="w-0 opacity-0 group-hover/volume:w-20 group-hover/volume:opacity-100 transition-all duration-300 cursor-pointer accent-teal-500"
                            />
                        </div>

                        <button onClick={toggleFullscreen} className="p-2 text-white hover:bg-white/10 rounded-full" title="Fullscreen">
                            <Maximize size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
