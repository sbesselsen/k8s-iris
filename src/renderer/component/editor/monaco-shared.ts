import { editor, languages } from "monaco-editor";
import {
    ContextMenuItemConstructorOptions,
    ContextMenuOptions,
    ContextMenuResult,
    ContextMenuTemplate,
} from "../../../common/contextmenu";
// import JSONWorker from "url:monaco-editor/esm/vs/language/json/json.worker.js";
// import CSSWorker from "url:monaco-editor/esm/vs/language/css/css.worker.js";
// import HTMLWorker from "url:monaco-editor/esm/vs/language/html/html.worker.js";
// import TSWorker from "url:monaco-editor/esm/vs/language/typescript/ts.worker.js";
// import EditorWorker from "url:monaco-editor/esm/vs/editor/editor.worker.js";

let initialized = false;

export function initializeMonaco() {
    if (initialized) {
        return;
    }
    initialized = true;

    initializeLogLanguage();

    editor.defineTheme("charm", {
        base: "vs",
        inherit: true,
        rules: [
            {
                token: "log-timestamp",
                fontStyle: "italic",
                foreground: "666666",
            },
            {
                token: "log-warning",
                foreground: "E53E3E",
            },
            {
                token: "log-error",
                foreground: "E53E3E",
            },
            {
                token: "log-info",
                foreground: "2b6cb0",
            },
            {
                token: "log-notice",
                foreground: "2b6cb0",
            },
        ],
        colors: {},
    });
    editor.defineTheme("charm-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [
            {
                token: "log-timestamp",
                fontStyle: "italic",
                foreground: "666666",
            },
            {
                token: "log-warning",
                foreground: "E53E3E",
            },
            {
                token: "log-error",
                foreground: "E53E3E",
            },
            {
                token: "log-info",
                foreground: "2b6cb0",
            },
            {
                token: "log-notice",
                foreground: "2b6cb0",
            },
        ],
        colors: {
            "editor.background": "#242424",
        },
    });

    (self as any).MonacoEnvironment = {
        getWorker: function (_moduleId: any, label: any) {
            // if (label === "json") {
            //     return JSONWorker;
            // }
            // if (label === "css" || label === "scss" || label === "less") {
            //     return CSSWorker;
            // }
            // if (
            //     label === "html" ||
            //     label === "handlebars" ||
            //     label === "razor"
            // ) {
            //     return HTMLWorker;
            // }
            // if (label === "typescript" || label === "javascript") {
            //     return TSWorker;
            // }
            if (label === "editorWorkerService") {
                return new Worker(new URL("worker/editor", import.meta.url), {
                    name: label,
                    type: "module",
                });
            }
        },
    };
}

export function recalcFonts() {
    // This sucks but it does the job. Maybe we could wait for window onLoad but I'm not sure that would help.
    editor.remeasureFonts();
    setTimeout(() => {
        editor.remeasureFonts();
    }, 1000);
    setTimeout(() => {
        editor.remeasureFonts();
    }, 5000);
}

export const defaultFontFamily = "JetBrainsMono";
export const defaultFontSize = 12;

function initializeLogLanguage() {
    // Register a new language
    languages.register({ id: "containerLog" });

    // Register a tokens provider for the language
    languages.setMonarchTokensProvider("containerLog", {
        tokenizer: {
            root: [
                [
                    /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9.]+[Z+][^\s]*/,
                    "log-timestamp",
                ],
                [/\[[Ww][Aa][Rr][Nn]([Ii][Nn][Gg])?\]/, "log-warning"],
                [/\[[E][Rr][Rr]([Oo][Rr])?\]/, "log-error"],
                [/\[[Nn][Oo][Tt][Ii][Cc][Ee]\]/, "log-notice"],
                [/\[[Ii][Nn][Ff][Oo]\]/, "log-info"],
            ],
        },
    });
}

export type MonacoContextMenuService = {
    showContextMenu: (params: any) => void;
};

export function createContextMenuService({
    popup,
    onClick,
}: {
    popup: (
        menuTemplate: ContextMenuTemplate,
        options?: ContextMenuOptions
    ) => Promise<ContextMenuResult>;
    onClick: (actionId: string) => void;
}): MonacoContextMenuService {
    function menuTemplateFromParams(params: any): ContextMenuTemplate {
        return params
            .getActions()
            .map((action: any): ContextMenuItemConstructorOptions => {
                if (action._id === "vs.actions.separator") {
                    return { type: "separator" };
                }
                if (action.id === "editor.action.clipboardCutAction") {
                    return { role: "cut", accelerator: "CommandOrControl+X" };
                }
                if (action.id === "editor.action.clipboardCopyAction") {
                    return { role: "copy", accelerator: "CommandOrControl+C" };
                }
                if (action.id === "editor.action.clipboardPasteAction") {
                    return { role: "paste", accelerator: "CommandOrControl+V" };
                }
                const keyBinding = params.getKeyBinding(action);
                let accelerator: string | undefined;
                if (keyBinding) {
                    if (
                        keyBinding._getElectronAccelerator &&
                        keyBinding._parts
                    ) {
                        for (const part of keyBinding._parts) {
                            const keyText =
                                keyBinding._getElectronAccelerator(part);
                            if (keyText) {
                                accelerator = keyText;
                            }
                            if (part.ctrlKey || part.metaKey) {
                                accelerator = `CommandOrControl+${accelerator}`;
                            }
                            if (part.shiftKey) {
                                accelerator = `Shift+${accelerator}`;
                            }
                            if (part.altKey) {
                                accelerator = `Option+${accelerator}`;
                            }
                            break; // If you want to use "chords" that's your business but keep that shit outta here
                        }
                    } else {
                        console.error(
                            "keyBinding does not have ._getElectronAccelerator or ._parts"
                        );
                    }
                }
                return {
                    actionId: action.id,
                    label: action.label,
                    enabled: action.enabled,
                    accelerator,
                    registerAccelerator: false,
                };
            })
            .filter((x: any) => x !== null);
    }

    function showContextMenu(params: any) {
        const menuTemplate = menuTemplateFromParams(params);
        popup(menuTemplate).then((result) => {
            if (result.actionId) {
                onClick(result.actionId);
                // params.onHide(false);
            } else {
                params.onHide(true);
            }
        });
    }

    return { showContextMenu };
}
