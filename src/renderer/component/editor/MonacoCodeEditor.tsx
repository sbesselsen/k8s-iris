import React, { useEffect, useRef } from "react";
import { editor } from "monaco-editor";
import {
    Box,
    useColorModeValue,
    useConst,
    useControllableState,
} from "@chakra-ui/react";
import JSONWorker from "url:monaco-editor/esm/vs/language/json/json.worker.js";
import CSSWorker from "url:monaco-editor/esm/vs/language/css/css.worker.js";
import HTMLWorker from "url:monaco-editor/esm/vs/language/html/html.worker.js";
import TSWorker from "url:monaco-editor/esm/vs/language/typescript/ts.worker.js";
import EditorWorker from "url:monaco-editor/esm/vs/editor/editor.worker.js";

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
    getWorkerUrl: function (_moduleId, label) {
        if (label === "json") {
            return JSONWorker;
        }
        if (label === "css" || label === "scss" || label === "less") {
            return CSSWorker;
        }
        if (label === "html" || label === "handlebars" || label === "razor") {
            return HTMLWorker;
        }
        if (label === "typescript" || label === "javascript") {
            return TSWorker;
        }
        return EditorWorker;
    },
};

export type MonacoCodeEditorProps = {
    defaultValue?: string;
    value?: string;
    onChange?: (newValue: string) => void;
    options?: editor.IStandaloneEditorConstructionOptions;
    runtimeOptions?: editor.IEditorOptions & editor.IGlobalEditorOptions;
    configureEditor?: (editor: editor.IStandaloneCodeEditor) => void;
};

export const MonacoCodeEditor: React.FC<MonacoCodeEditorProps> = (props) => {
    const {
        defaultValue,
        value,
        onChange,
        options,
        runtimeOptions,
        configureEditor,
    } = props;

    const optionsConst = useConst(options);
    const configureEditorConst = useConst(() => configureEditor);

    const containerRef = useRef<HTMLDivElement>();
    const editorRef = useRef<editor.IStandaloneCodeEditor>();

    const theme = useColorModeValue("charm", "charm-dark");

    const [stateValue, setStateValue] = useControllableState({
        defaultValue,
        value,
        onChange,
    });

    const editorValueRef = useRef<string>();

    useEffect(() => {
        const isNew = !editorRef.current;
        if (!containerRef.current) {
            return;
        }
        const editorInstance = editor.create(containerRef.current, {
            value: stateValue ?? "",
            theme,
            automaticLayout: true,
            ...optionsConst,
        });
        editorRef.current = editorInstance;
        editorInstance.onDidChangeModelContent(() => {
            const value = editorInstance.getModel()?.getValue();
            editorValueRef.current = value;
            setStateValue(value);
        });
        if (runtimeOptions && !isNew) {
            editorInstance.updateOptions(runtimeOptions);
        }
        configureEditorConst?.(editorInstance);
        return () => {
            editorInstance.dispose();
        };
    }, [
        configureEditorConst,
        containerRef,
        editorValueRef,
        optionsConst,
        editorRef,
    ]);

    useEffect(() => {
        editor.setTheme(theme);
    }, [theme]);

    useEffect(() => {
        if (runtimeOptions) {
            editorRef.current?.updateOptions(runtimeOptions);
        }
    }, [editorRef, runtimeOptions]);

    useEffect(() => {
        if (stateValue !== editorValueRef.current && editorRef.current) {
            const editor = editorRef.current;
            editor.setValue(stateValue);
            editorValueRef.current = editor.getValue();
        }
    }, [editorRef, editorValueRef, stateValue]);

    return <Box flex="1 0 0" ref={containerRef}></Box>;
};
