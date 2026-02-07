
export type ThemeId = 'paghalopi';

export interface ThemeColors {
    background: string;
    backgroundSecondary: string;
    backgroundTertiary: string;
    foreground: string;
    foregroundMuted: string;
    foregroundSubtle: string;
    accent: string;
    accentHover: string;
    accentMuted: string;
    border: string;
    borderActive: string;
    success: string;
    warning: string;
    error: string;
    info: string;
    syntaxKeyword: string;
    syntaxString: string;
    syntaxFunction: string;
    syntaxComment: string;
    syntaxType: string;
    syntaxVariable: string;
    syntaxNumber: string;
    syntaxOperator: string;
    sidebarBackground: string;
    activityBarBackground: string;
    statusBarBackground: string;
    tabActiveBackground: string;
    tabInactiveBackground: string;
    inputBackground: string;
    buttonBackground: string;
    buttonHoverBackground: string;
    scrollbarThumb: string;
    scrollbarThumbHover: string;
    selection: string;
    selectionHighlight: string;
    editorLineHighlight: string;
    editorGutter: string;
    hoverOverlay: string;
    hoverOverlayStrong: string;
    gitAdded: string;
    gitModified: string;
    gitDeleted: string;
}

export interface Theme {
    id: ThemeId;
    name: string;
    type: 'dark' | 'light';
    colors: ThemeColors;
    previewColors: string[];
}

const paghalopi: Theme = {
    id: 'paghalopi',
    name: 'Paghalopi',
    type: 'dark',
    previewColors: ['#202020', '#2dd4bf', '#2c2c2c', '#ffffff'],
    colors: {
        background: '#202020',
        backgroundSecondary: '#2c2c2c',
        backgroundTertiary: '#333333',
        foreground: '#ffffff',
        foregroundMuted: '#ffffff99',
        foregroundSubtle: '#ffffff73',
        accent: '#2dd4bf',
        accentHover: '#14b8a6',
        accentMuted: '#0d948840',
        border: '#ffffff1a',
        borderActive: '#2dd4bf',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
        syntaxKeyword: '#2dd4bf',
        syntaxString: '#86efac',
        syntaxFunction: '#5eead4',
        syntaxComment: '#6b7280',
        syntaxType: '#20b2aa',
        syntaxVariable: '#ffffff',
        syntaxNumber: '#99f6e4',
        syntaxOperator: '#2dd4bf',
        sidebarBackground: '#1a1a1a',
        activityBarBackground: '#141414',
        statusBarBackground: '#2dd4bf',
        tabActiveBackground: '#202020',
        tabInactiveBackground: '#2c2c2c',
        inputBackground: '#333333',
        buttonBackground: '#2dd4bf',
        buttonHoverBackground: '#14b8a6',
        scrollbarThumb: '#ffffff',
        scrollbarThumbHover: '#ffffff60',
        selection: '#2dd4bf40',
        selectionHighlight: '#2dd4bf20',
        editorLineHighlight: '#ffffff0a',
        editorGutter: '#202020',
        hoverOverlay: 'rgba(255, 255, 255, 0.05)',
        hoverOverlayStrong: 'rgba(255, 255, 255, 0.1)',
        gitAdded: '#10b981',
        gitModified: '#f59e0b',
        gitDeleted: '#ef4444',
    },
};

export const themes: Record<ThemeId, Theme> = {
    'paghalopi': paghalopi,
};
