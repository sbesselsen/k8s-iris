import { Box, Spinner, VStack } from "@chakra-ui/react";
import { editor, Range } from "monaco-editor";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { MonacoCodeEditor } from "../../component/editor/MonacoCodeEditor";
import { useK8sLogWatchListener } from "../../k8s/log-watch";

export type PodLogsEditorProps = {
    name: string;
    namespace: string;
    containerName: string;
};

function scrollToBottomIfAllowed(
    editor: editor.IStandaloneCodeEditor,
    force = false
) {
    const numberOfLines = editor.getModel().getLineCount();
    const position = editor.getScrolledVisiblePosition({
        column: 1,
        lineNumber: numberOfLines,
    });
    const editorHeight = editor.getContainerDomNode().clientHeight;
    if (
        force ||
        (position.top > 0 &&
            position.top > editorHeight - 50 &&
            position.top < editorHeight + 50)
    ) {
        // The bottom of the log is just out of view.
        editor.revealLineInCenter(numberOfLines);
    }
}

export const PodLogsEditor: React.FC<PodLogsEditorProps> = (props) => {
    const { name, namespace, containerName } = props;

    const editorRef = useRef<editor.IStandaloneCodeEditor>();
    const logLinesRef = useRef<string[]>([]);

    const [isEnded, setEnded] = useState(false);

    const configureEditor = useCallback(
        (editor: editor.IStandaloneCodeEditor) => {
            editorRef.current = editor;
            if (logLinesRef.current.length > 0) {
                editor.getModel().setValue(logLinesRef.current.join("\n"));
                scrollToBottomIfAllowed(editor, true);
                const postInsertLineNumber = editor.getModel().getLineCount();
                editor.setSelection(
                    new Range(postInsertLineNumber, 1, postInsertLineNumber, 1)
                );
            }
        },
        [editorRef, logLinesRef]
    );

    useEffect(() => {
        editorRef.current?.getModel().setValue("");
        logLinesRef.current = [];
    }, [name, namespace, containerName, editorRef, logLinesRef]);

    useK8sLogWatchListener(
        {
            podName: name,
            namespace,
            containerName,
        },
        {
            onLogLines: (lines: string[]) => {
                const isFirst = logLinesRef.current.length === 0;
                logLinesRef.current.push(...lines);
                const editor = editorRef.current;
                if (editor) {
                    // Append the new lines.
                    const lineNumber = editor.getModel().getLineCount() + 1;
                    const value = editor.getModel().getValue();
                    editor.getModel().applyEdits([
                        {
                            text: (value ? "\n" : "") + lines.join("\n"),
                            range: new Range(lineNumber, 1, lineNumber, 1),
                        },
                    ]);
                    scrollToBottomIfAllowed(editor, isFirst);
                    const postInsertLineNumber = editor
                        .getModel()
                        .getLineCount();
                    if (isFirst) {
                        editor.setSelection(
                            new Range(
                                postInsertLineNumber,
                                1,
                                postInsertLineNumber,
                                1
                            )
                        );
                    }
                }
            },
            onEnd: () => {
                setEnded(true);
            },
            timestamps: true,
            updateCoalesceInterval: 100,
        },
        [name, namespace, containerName, editorRef, logLinesRef, setEnded]
    );

    return (
        <VStack alignItems="stretch" flex="1 0 0" position="relative">
            <MonacoCodeEditor
                options={{
                    readOnly: true,
                    minimap: { enabled: false }, // I hate that little freak
                    links: false, // and don't even get me started on clickable links
                    padding: { top: 5 },
                    lineNumbers: "off",
                    wordWrap: "on",
                }}
                defaultValue=""
                configureEditor={configureEditor}
            />
            <Box position="absolute" right={8} bottom={2} zIndex={50}>
                {!isEnded && (
                    <Spinner
                        size="sm"
                        speed="1.2s"
                        color="gray.300"
                        emptyColor="gray.700"
                        title="Live updating logs..."
                    />
                )}
            </Box>
        </VStack>
    );
};
