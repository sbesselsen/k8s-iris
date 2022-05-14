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
    shouldEnableSave?: boolean;
};

export const YamlEditor: React.FC<YamlEditorProps> = (props) => {
    const { value, onChange, shouldEnableSave = true } = props;

    const [isSaving, setIsSaving] = useState(false);

    const containerRef = useRef<HTMLDivElement>();
    const editorRef = useRef<editor.IEditor>();

    const onSaveRef = useRef<() => void>();

    const theme = useColorModeValue("charm", "charm-dark");

    useEffect(() => {
        if (!containerRef.current) {
            return;
        }
        const myEditor = editor.create(containerRef.current, {
            value: "",
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
    }, [containerRef, editorRef, onSaveRef]);

    useEffect(() => {
        editor.setTheme(theme);
    }, [theme]);

    useEffect(() => {
        const model = editorRef.current?.getModel();
        if (model && "setValue" in model) {
            model.setValue(toYaml(value));
        }
    }, [editorRef, value]);

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
        }
    }, [editorRef, onChange, setIsSaving]);
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

    return (
        <VStack
            flex="1 0 0"
            spacing={0}
            alignItems="stretch"
            position="relative"
        >
            <HStack flex="0 0 auto" px={4} pt={3} pb={2} boxShadow="inner">
                {normalToolbar}
            </HStack>
            <Box flex="1 0 0" ref={containerRef}></Box>
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
