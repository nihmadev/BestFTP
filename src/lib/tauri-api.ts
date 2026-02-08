import { convertFileSrc } from "@tauri-apps/api/core";

export const tauriApi = {
    getAssetUrl: (path: string) => {
        const normalizedPath = path.replace(/\\/g, '/');
        return convertFileSrc(normalizedPath);
    }
};
