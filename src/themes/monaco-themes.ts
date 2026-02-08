import type { Monaco } from '@monaco-editor/react';
import { themes, type ThemeId } from './index';


export const getMonacoThemeName = (themeId: ThemeId): string => {
    return `cognitive-${themeId}`;
};


const createMonacoTheme = (themeId: ThemeId): any => {
    const theme = themes[themeId];
    if (!theme) return null;

    const colors = theme.colors;

    // Helper to ensure we have a 6-digit hex for appending alpha
    const stripAlpha = (hex: string) => {
        if (hex.startsWith('#') && hex.length > 7) {
            return hex.substring(0, 7);
        }
        return hex;
    };

    return {
        base: theme.type === 'dark' ? 'vs-dark' : 'vs',
        inherit: true,
        rules: [
            { token: '', foreground: stripAlpha(colors.foreground).replace('#', '') },
            { token: 'comment', foreground: stripAlpha(colors.syntaxComment).replace('#', ''), fontStyle: 'italic' },
            { token: 'keyword', foreground: stripAlpha(colors.syntaxKeyword).replace('#', '') },
            { token: 'keyword.control', foreground: stripAlpha(colors.syntaxKeyword).replace('#', '') },
            { token: 'string', foreground: stripAlpha(colors.syntaxString).replace('#', '') },
            { token: 'string.key', foreground: stripAlpha(colors.syntaxVariable).replace('#', '') },
            { token: 'string.value', foreground: stripAlpha(colors.syntaxString).replace('#', '') },
            { token: 'number', foreground: stripAlpha(colors.syntaxNumber).replace('#', '') },
            { token: 'number.hex', foreground: stripAlpha(colors.syntaxNumber).replace('#', '') },
            { token: 'regexp', foreground: stripAlpha(colors.syntaxString).replace('#', '') },
            { token: 'type', foreground: stripAlpha(colors.syntaxType).replace('#', '') },
            { token: 'type.identifier', foreground: stripAlpha(colors.syntaxType).replace('#', '') },
            { token: 'class', foreground: stripAlpha(colors.syntaxType).replace('#', '') },
            { token: 'interface', foreground: stripAlpha(colors.syntaxType).replace('#', '') },
            { token: 'function', foreground: stripAlpha(colors.syntaxFunction).replace('#', '') },
            { token: 'function.call', foreground: stripAlpha(colors.syntaxFunction).replace('#', '') },
            { token: 'variable', foreground: stripAlpha(colors.syntaxVariable).replace('#', '') },
            { token: 'variable.predefined', foreground: stripAlpha(colors.syntaxVariable).replace('#', '') },
            { token: 'constant', foreground: stripAlpha(colors.syntaxNumber).replace('#', '') },
            { token: 'operator', foreground: stripAlpha(colors.syntaxOperator).replace('#', '') },
            { token: 'delimiter', foreground: stripAlpha(colors.foreground).replace('#', '') },
            { token: 'delimiter.bracket', foreground: stripAlpha(colors.foreground).replace('#', '') },
            { token: 'tag', foreground: stripAlpha(colors.syntaxKeyword).replace('#', '') },
            { token: 'attribute.name', foreground: stripAlpha(colors.syntaxVariable).replace('#', '') },
            { token: 'attribute.value', foreground: stripAlpha(colors.syntaxString).replace('#', '') },
            { token: 'metatag', foreground: stripAlpha(colors.syntaxKeyword).replace('#', '') },
            { token: 'annotation', foreground: stripAlpha(colors.syntaxFunction).replace('#', '') },

            { token: 'string.key.json', foreground: stripAlpha(colors.syntaxVariable).replace('#', '') },
            { token: 'string.value.json', foreground: stripAlpha(colors.syntaxString).replace('#', '') },

            { token: 'tag.html', foreground: stripAlpha(colors.syntaxKeyword).replace('#', '') },
            { token: 'tag.xml', foreground: stripAlpha(colors.syntaxKeyword).replace('#', '') },

            { token: 'attribute.name.css', foreground: stripAlpha(colors.syntaxVariable).replace('#', '') },
            { token: 'attribute.value.css', foreground: stripAlpha(colors.syntaxString).replace('#', '') },
            { token: 'selector.css', foreground: stripAlpha(colors.syntaxFunction).replace('#', '') },
        ],
        colors: {
            'editor.background': colors.background,
            'editor.foreground': colors.foreground,
            'editor.lineHighlightBackground': colors.editorLineHighlight,
            'editor.selectionBackground': colors.selection,
            'editor.selectionHighlightBackground': colors.selectionHighlight,
            'editor.selectionForeground': colors.foreground,
            'editor.inactiveSelectionBackground': stripAlpha(colors.selection) + '80',
            'editorLineNumber.foreground': colors.foregroundSubtle,
            'editorLineNumber.activeForeground': colors.foreground,
            'editorCursor.foreground': colors.accent,
            'editorWhitespace.foreground': stripAlpha(colors.foregroundSubtle) + '40',
            'editorIndentGuide.background': colors.border,
            'editorIndentGuide.activeBackground': colors.borderActive,
            'editor.findMatchBackground': stripAlpha(colors.accent) + '40',
            'editor.findMatchHighlightBackground': stripAlpha(colors.accent) + '20',
            'editorBracketMatch.background': stripAlpha(colors.accent) + '30',
            'editorBracketMatch.border': colors.accent,
            'editorGutter.background': colors.editorGutter,
            'editorWidget.background': colors.backgroundSecondary,
            'editorWidget.border': colors.border,
            'editorSuggestWidget.background': colors.backgroundSecondary,
            'editorSuggestWidget.border': colors.border,
            'editorSuggestWidget.foreground': colors.foreground,
            'editorSuggestWidget.selectedBackground': colors.selection,
            'editorHoverWidget.background': colors.backgroundSecondary,
            'editorHoverWidget.border': colors.border,
            'scrollbar.shadow': '#00000000',
            'scrollbarSlider.background': stripAlpha(colors.scrollbarThumb) + '80',
            'scrollbarSlider.hoverBackground': colors.scrollbarThumbHover,
            'scrollbarSlider.activeBackground': colors.scrollbarThumbHover,
            'minimap.background': colors.background,
            'minimapSlider.background': stripAlpha(colors.scrollbarThumb) + '40',
            'minimapSlider.hoverBackground': stripAlpha(colors.scrollbarThumb) + '60',
            'minimapSlider.activeBackground': stripAlpha(colors.scrollbarThumb) + '80',
            'breadcrumb.background': colors.background,
            'breadcrumb.foreground': colors.foreground,
            'breadcrumb.focusForeground': colors.accent,
            'breadcrumb.activeSelectionForeground': colors.accent,
            'breadcrumbPicker.background': colors.backgroundSecondary,
            'editorWidget.foreground': colors.foreground,
            'editorWidget.resizeBorder': colors.border,
            'editor.findMatchBorder': colors.accent,
            'editor.findMatchHighlightBorder': stripAlpha(colors.accent) + '60',
            'editorOverviewRuler.findMatchForeground': colors.accent,
            'editorOverviewRuler.rangeHighlightForeground': stripAlpha(colors.accent) + '40',
            'editorWidget.closeIconBackground': colors.backgroundSecondary,
            'editorWidget.closeIconForeground': colors.foregroundSubtle,
            'editorWidget.closeIconHoverBackground': colors.border,
            'editorWidget.closeIconHoverForeground': colors.foreground,

            'diffEditor.insertedTextBackground': stripAlpha(colors.gitAdded) + '44',
            'diffEditor.removedTextBackground': stripAlpha(colors.gitDeleted) + '44',
            'diffEditor.insertedLineBackground': stripAlpha(colors.gitAdded) + '22',
            'diffEditor.removedLineBackground': stripAlpha(colors.gitDeleted) + '22',
            'diffEditor.insertedTextBorder': '#00000000',
            'diffEditor.removedTextBorder': '#00000000',
            'diffEditor.diagonalFill': colors.border,
        },
    };
}


export const registerMonacoThemes = (monaco: Monaco): void => {
    const themeIds = Object.keys(themes) as ThemeId[];

    for (const themeId of themeIds) {
        const themeName = getMonacoThemeName(themeId);
        const monacoTheme = createMonacoTheme(themeId);
        if (monacoTheme) {
            monaco.editor.defineTheme(themeName, monacoTheme);
        }
    }
};


export const forceRegisterMonacoThemes = (monaco: Monaco): void => {
    registerMonacoThemes(monaco);
};
