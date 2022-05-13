import React, { useEffect, useMemo, useRef } from "react";
import { editor } from "monaco-editor";
import * as YAML from "yaml";
import { Box, useColorModeValue } from "@chakra-ui/react";

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
    value: object;
};

export const YamlEditor: React.FC<YamlEditorProps> = (props) => {
    const { value } = props;

    const containerRef = useRef<HTMLDivElement>();
    const editorRef = useRef<editor.IEditor>();

    const theme = useColorModeValue("charm", "charm-dark");

    const yamlValue = useMemo(() => {
        const doc = new YAML.Document();
        doc.contents = value;
        return doc.toString();
    }, [value]);

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
        return () => {
            myEditor.dispose();
        };
    }, [containerRef, editorRef]);

    useEffect(() => {
        editor.setTheme(theme);
    }, [theme]);

    useEffect(() => {
        editorRef.current?.getModel()?.setValue(yamlValue);
    }, [editorRef, yamlValue]);

    return <Box flex="1 0 0" ref={containerRef}></Box>;
};
