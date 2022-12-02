import React, { useEffect, useRef } from "react";
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
    recalcFont,
} from "./monaco-shared";
import { useIpcCall } from "../../hook/ipc";

export type MonacoCodeEditorProps = {
    originalValue?: string;
    defaultValue?: string;
    value?: string;
    onChange?: (newValue: string) => void;
    options?: editor.IStandaloneDiffEditorConstructionOptions & {
        language?: string;
        jumpToFirstChange?: boolean;
    };
    runtimeOptions?: editor.IDiffEditorOptions & editor.IGlobalEditorOptions;
    configureEditor?: (editor: editor.IStandaloneDiffEditor) => void;
    focusOnInit?: boolean;
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
        focusOnInit,
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
        const {
            language = "text/plain",
            jumpToFirstChange = true,
            ...editorOptions
        } = optionsConst ?? {};
        const editorInstance = editor.createDiffEditor(
            containerRef.current,
            {
                theme,
                automaticLayout: true,
                fontFamily: defaultFontFamily,
                fontSize: defaultFontSize,
                ...editorOptions,
            },
            {
                contextMenuService,
            }
        );
        recalcFont(optionsConst.fontFamily ?? defaultFontFamily);
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
        if (focusOnInit) {
            editorInstance.getModifiedEditor().focus();
        }
        if (runtimeOptions && !isNew) {
            editorInstance.updateOptions(runtimeOptions);
        }
        let navi: editor.IDiffNavigator | undefined;
        if (jumpToFirstChange) {
            navi = editor.createDiffNavigator(editorInstance, {
                followsCaret: true, // resets the navigator state when the user selects something in the editor
            });
            navi.next();
        }

        configureEditorConst?.(editorInstance);
        return () => {
            navi?.dispose();
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
        editorRef.current?.getOriginalEditor().setValue(originalValue);
    }, [editorRef, originalValue]);

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

    return <Box flex="1 0 0" overflow="hidden" ref={containerRef}></Box>;
};
