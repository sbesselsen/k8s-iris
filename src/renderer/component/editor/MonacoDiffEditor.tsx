import React, { useEffect, useRef } from "react";
import { editor } from "monaco-editor";
import {
    Box,
    useColorModeValue,
    useConst,
    useControllableState,
} from "@chakra-ui/react";
import { initializeMonaco } from "./monaco-shared";

export type MonacoCodeEditorProps = {
    originalValue?: string;
    defaultValue?: string;
    value?: string;
    onChange?: (newValue: string) => void;
    options?: editor.IStandaloneDiffEditorConstructionOptions & {
        language?: string;
    };
    runtimeOptions?: editor.IDiffEditorOptions & editor.IGlobalEditorOptions;
    configureEditor?: (editor: editor.IStandaloneDiffEditor) => void;
};

export const MonacoDiffEditor: React.FC<MonacoCodeEditorProps> = (props) => {
    initializeMonaco();

    const {
        defaultValue,
        value,
        onChange,
        options,
        originalValue,
        runtimeOptions,
        configureEditor,
    } = props;

    const optionsConst = useConst(options);
    const configureEditorConst = useConst(() => configureEditor);

    const containerRef = useRef<HTMLDivElement>();
    const editorRef = useRef<editor.IStandaloneDiffEditor>();

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
        const { language = "text/plain", ...editorOptions } =
            optionsConst ?? {};
        const editorInstance = editor.createDiffEditor(containerRef.current, {
            theme,
            automaticLayout: true,
            ...editorOptions,
        });
        const originalModel = editor.createModel(originalValue, language);
        const modifiedModel = editor.createModel(value, language);
        editorInstance.setModel({
            original: originalModel,
            modified: modifiedModel,
        });
        editorRef.current = editorInstance;
        editorInstance.onDidUpdateDiff(() => {
            const value = editorInstance.getModifiedEditor()?.getValue();
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
            const modifiedEditor = editorRef.current.getModifiedEditor();
            modifiedEditor.setValue(stateValue);
            editorValueRef.current = modifiedEditor.getValue();
        }
    }, [editorRef, editorValueRef, stateValue]);

    return <Box flex="1 0 0" ref={containerRef}></Box>;
};
