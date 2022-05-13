import React, { useCallback, useEffect, useRef, useState } from "react";
import { editor, KeyMod, KeyCode } from "monaco-editor";
import * as YAML from "yaml";
import {
    Box,
    Button,
    HStack,
    Text,
    useColorModeValue,
    VStack,
} from "@chakra-ui/react";

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

import JSONWorker from "url:monaco-editor/esm/vs/language/json/json.worker.js";
import CSSWorker from "url:monaco-editor/esm/vs/language/css/css.worker.js";
import HTMLWorker from "url:monaco-editor/esm/vs/language/html/html.worker.js";
import TSWorker from "url:monaco-editor/esm/vs/language/typescript/ts.worker.js";
import EditorWorker from "url:monaco-editor/esm/vs/editor/editor.worker.js";

(self as any).MonacoEnvironment = {
    getWorkerUrl: function (moduleId, label) {
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

export type YamlEditorProps = {
    value?: object;
    onChange?: (newValue: object) => undefined | Promise<void>;
    mergeChanges?: (
        oldValue: object,
        newValue: object,
        editorValue: object
    ) => object | null | undefined;
    shouldEnableSave?: boolean;
};

export const YamlEditor: React.FC<YamlEditorProps> = (props) => {
    const { value, onChange, mergeChanges, shouldEnableSave = true } = props;

    const [isSaving, setIsSaving] = useState(false);

    const prevValueRef = useRef<object>();

    const containerRef = useRef<HTMLDivElement>();
    const editorRef = useRef<editor.IEditor>();

    const onSaveRef = useRef<() => void>();

    const theme = useColorModeValue("charm", "charm-dark");
    const [shouldDisplayMergeButton, setShouldDisplayMergeButton] =
        useState(false);

    const inputModelValueRef = useRef<string>();
    const hasModifications = useCallback(() => {
        if (!inputModelValueRef.current) {
            return false;
        }
        const model = editorRef.current?.getModel();
        if (model && "getValue" in model) {
            const modelValue = model.getValue();
            return modelValue !== inputModelValueRef.current;
        }
        return false;
    }, [editorRef, inputModelValueRef]);

    useEffect(() => {
        if (!containerRef.current) {
            return;
        }
        const myEditor = editor.create(containerRef.current, {
            value: inputModelValueRef.current ?? "",
            language: "yaml",
            theme,
            automaticLayout: true,
        });
        editorRef.current = myEditor;
        myEditor.addAction({
            id: "save-to-cluster",
            label: "Apply to cluster",
            keybindings: [KeyMod.CtrlCmd | KeyCode.KeyS],
            contextMenuGroupId: "navigation",
            contextMenuOrder: 1.5,
            run: function () {
                onSaveRef?.current();
            },
        });

        return () => {
            myEditor.dispose();
        };
    }, [containerRef, editorRef, inputModelValueRef, onSaveRef]);

    useEffect(() => {
        editor.setTheme(theme);
    }, [theme]);

    useEffect(() => {
        editorRef.current?.updateOptions({
            readOnly: shouldDisplayMergeButton,
        });
    }, [editorRef, shouldDisplayMergeButton]);

    useEffect(() => {
        const model = editorRef.current?.getModel();
        if (model && "setValue" in model) {
            if (hasModifications()) {
                setShouldDisplayMergeButton(true);
            } else {
                model.setValue(toYaml(value));
                inputModelValueRef.current = model.getValue();
            }
        }
    }, [
        editorRef,
        inputModelValueRef,
        hasModifications,
        prevValueRef,
        setShouldDisplayMergeButton,
        value,
    ]);

    const onValueUpdateIgnore = useCallback(() => {
        setShouldDisplayMergeButton(false);
    }, [setShouldDisplayMergeButton]);

    const onValueUpdateReload = useCallback(() => {
        const model = editorRef.current?.getModel();
        if (model && "setValue" in model) {
            model.setValue(toYaml(value));
            inputModelValueRef.current = model.getValue();
        }
        setShouldDisplayMergeButton(false);
    }, [
        editorRef,
        inputModelValueRef,
        prevValueRef,
        setShouldDisplayMergeButton,
        value,
    ]);

    const onValueUpdateMerge = useCallback(() => {
        const model = editorRef.current?.getModel();
        if (model && "setValue" in model) {
            try {
                const oldValue = parseYaml(inputModelValueRef.current);
                const editorValue = parseYaml(model.getValue());
                const mergedValue = mergeChanges?.(
                    oldValue as object,
                    value,
                    editorValue as object
                );
                if (mergedValue) {
                    // Merge!
                    model.setValue(toYaml(mergedValue));
                    inputModelValueRef.current = toYaml(value);
                }
            } catch (e) {
                // Cannot merge.
                console.error("Cannot merge", e);
            }
        }
        setShouldDisplayMergeButton(false);
    }, [
        editorRef,
        inputModelValueRef,
        mergeChanges,
        prevValueRef,
        setShouldDisplayMergeButton,
        value,
    ]);

    const onSave = useCallback(() => {
        const model = editorRef.current?.getModel();
        if (model && "getValue" in model) {
            let object;
            const modelValue = model.getValue();
            try {
                object = parseYaml(modelValue);
            } catch (e) {
                console.error("Error on save: ", e);
                return;
            }
            const onChangeResult = onChange?.(object);
            if (onChangeResult) {
                setIsSaving(true);
                (async () => {
                    await onChangeResult;
                    setIsSaving(false);
                })();
            }
            inputModelValueRef.current = modelValue;
        }
    }, [editorRef, inputModelValueRef, onChange, setIsSaving]);
    onSaveRef.current = onSave;

    const normalToolbar = (
        <>
            <Box flex="1 0 0"></Box>
            <Button
                variant="solid"
                colorScheme="primary"
                onClick={onSave}
                isLoading={isSaving}
                isDisabled={!shouldEnableSave}
            >
                Save
            </Button>
        </>
    );

    const upstreamChangesToolbar = (
        <>
            <Box flex="1 0 0">
                <Text>The object changed in the cluster.</Text>
            </Box>
            <Button
                variant="outline"
                colorScheme="primary"
                onClick={onValueUpdateIgnore}
            >
                Ignore
            </Button>
            <Button
                variant="outline"
                colorScheme="primary"
                onClick={onValueUpdateReload}
            >
                Reload
            </Button>
            <Button
                variant="solid"
                colorScheme="primary"
                onClick={onValueUpdateMerge}
            >
                Merge
            </Button>
        </>
    );

    return (
        <VStack
            flex="1 0 0"
            spacing={0}
            alignItems="stretch"
            position="relative"
        >
            <HStack flex="0 0 auto" px={4} pt={3} pb={2} boxShadow="inner">
                {shouldDisplayMergeButton
                    ? upstreamChangesToolbar
                    : normalToolbar}
            </HStack>
            <Box
                flex="1 0 0"
                ref={containerRef}
                opacity={shouldDisplayMergeButton ? 0.5 : 1}
            ></Box>
        </VStack>
    );
};

function toYaml(obj: object): string {
    const doc = new YAML.Document();
    doc.contents = obj;
    return doc.toString();
}
function parseYaml(yaml: string): unknown {
    return YAML.parse(yaml);
}
