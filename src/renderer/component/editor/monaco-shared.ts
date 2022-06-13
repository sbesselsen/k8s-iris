import { editor } from "monaco-editor";
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

    editor.defineTheme("charm", {
        base: "vs",
        inherit: true,
        rules: [],
        colors: {},
    });
    editor.defineTheme("charm-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [],
        colors: {
            "editor.background": "#171923", // gray.900
        },
    });

    (self as any).MonacoEnvironment = {
        getWorker: function (_moduleId, label) {
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

export function recalcFont(_family: string) {
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
export const defaultFontSize = 13;
