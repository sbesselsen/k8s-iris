import React, { MutableRefObject, useEffect, useRef } from "react";
import { editor } from "monaco-editor";
import {
    Box,
    useColorModeValue,
    useConst,
    useControllableState,
} from "@chakra-ui/react";
import {
    createContextMenuService,
    defaultFontFamily,
    defaultFontSize,
    initializeMonaco,
    recalcFonts,
} from "./monaco-shared";
import { useIpcCall } from "../../hook/ipc";

export type MonacoCodeEditorProps = {
    defaultValue?: string;
    value?: string;
    onChange?: (newValue: string) => void;
    options?: editor.IStandaloneEditorConstructionOptions;
    runtimeOptions?: editor.IEditorOptions & editor.IGlobalEditorOptions;
    configureEditor?: (editor: editor.IStandaloneCodeEditor) => void;
    focusOnInit?: boolean;
};

export const MonacoCodeEditor: React.FC<MonacoCodeEditorProps> = (props) => {
    initializeMonaco();

    const {
        defaultValue,
        value,
        onChange,
        options,
        runtimeOptions,
        configureEditor,
        focusOnInit,
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
    const popupContextMenu = useIpcCall((ipc) => ipc.contextMenu.popup);

    useEffect(() => {
        const isNew = !editorRef.current;
        if (!containerRef.current) {
            return;
        }
        const contextMenuService = createContextMenuService({
            popup: (menuTemplate, options) =>
                popupContextMenu({ menuTemplate, options }),
            onClick: (actionId) => {
                editorInstance.trigger(undefined, actionId, undefined);
            },
        });
        const editorInstance = editor.create(
            containerRef.current,
            {
                value: stateValue ?? "",
                theme,
                automaticLayout: true,
                fontFamily: defaultFontFamily,
                fontSize: defaultFontSize,
                ...optionsConst,
            },
            {
                contextMenuService,
            }
        );
        recalcFonts();
        editorRef.current = editorInstance;
        editorInstance.onDidChangeModelContent(() => {
            const value = editorInstance.getModel()?.getValue() ?? "";
            editorValueRef.current = value;
            setStateValue(value);
        });
        if (focusOnInit) {
            editorInstance.focus();
        }
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
        popupContextMenu,
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

    return (
        <Box
            flex="1 0 0"
            overflow="hidden"
            ref={containerRef as MutableRefObject<HTMLDivElement>}
        ></Box>
    );
};
