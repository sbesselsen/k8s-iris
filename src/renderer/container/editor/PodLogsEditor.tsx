import { Button, HStack, ScaleFade, Spinner, VStack } from "@chakra-ui/react";
import { editor, IDisposable, Range } from "monaco-editor";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { MonacoCodeEditor } from "../../component/editor/MonacoCodeEditor";
import { useHibernate } from "../../context/hibernate";
import { useK8sLogWatchListener } from "../../k8s/log-watch";

export type PodLogsEditorProps = {
    name: string;
    namespace: string;
    containerName: string;
};

function scrollToBottom(
    editorInstance: editor.IStandaloneCodeEditor,
    smooth = false
) {
    const numberOfLines = editorInstance.getModel().getLineCount();
    const position = editorInstance.getScrolledVisiblePosition({
        column: 1,
        lineNumber: numberOfLines,
    });
    const editorHeight = editorInstance.getContainerDomNode().clientHeight;
    if (position.top > editorHeight - 50) {
        // The bottom of the log is out of view.
        editorInstance.revealLine(
            numberOfLines,
            smooth ? editor.ScrollType.Smooth : editor.ScrollType.Immediate
        );
    }
}

function isLastLineVisible(editor: editor.IStandaloneCodeEditor): boolean {
    const numberOfLines = editor.getModel().getLineCount();
    const position = editor.getScrolledVisiblePosition({
        column: 1,
        lineNumber: numberOfLines,
    });
    const editorHeight = editor.getContainerDomNode().clientHeight;

    return position.top + position.height < editorHeight;
}

export const PodLogsEditor: React.FC<PodLogsEditorProps> = (props) => {
    const { name, namespace, containerName } = props;

    const editorRef = useRef<editor.IStandaloneCodeEditor>();
    const logLinesRef = useRef<string[]>([]);
    const pausedLogLinesRef = useRef<string[]>([]);

    const isPaused = useHibernate();
    const isPausedRef = useRef<boolean>(isPaused);

    const [showScrollToBottom, setShowScrollToBottom] = useState(false);
    const [isEnded, setEnded] = useState(false);

    const onClickScrollToBottom = useCallback(() => {
        if (editorRef.current) {
            scrollToBottom(editorRef.current, true);
        }
    }, [editorRef]);

    // Common function to append log lines to the editor.
    const appendLogLines = useCallback(
        (lines: string[]) => {
            logLinesRef.current.push(...lines);

            const editor = editorRef.current;
            if (!editor) {
                return;
            }

            // Append the new lines.
            const lineNumber = editor.getModel().getLineCount() + 1;
            const prevValue = editor.getModel().getValue();
            const stickToBottom = isLastLineVisible(editor);
            editor.getModel().applyEdits([
                {
                    text: lines.join("\n") + "\n",
                    range: new Range(lineNumber, 1, lineNumber, 1),
                },
            ]);
            if (stickToBottom) {
                scrollToBottom(editor);
            }
            if (!prevValue) {
                // Clear the selection if this is the first time we are adding logs.
                editor.setSelection(new Range(1, 1, 1, 1));
            }
            updateScrollToBottom();
        },
        [editorRef, logLinesRef]
    );

    const pauseableAppendLogLines = useCallback(
        (lines: string[]) => {
            if (isPausedRef.current) {
                pausedLogLinesRef.current.push(...lines);
            } else {
                appendLogLines(lines);
            }
        },
        [appendLogLines, isPausedRef, pausedLogLinesRef]
    );

    useEffect(() => {
        isPausedRef.current = isPaused;
        if (!isPaused && pausedLogLinesRef.current.length > 0) {
            appendLogLines(pausedLogLinesRef.current);
            pausedLogLinesRef.current = [];
        }
    }, [appendLogLines, isPaused, isPausedRef, pausedLogLinesRef]);

    const updateScrollToBottomTimeoutRef = useRef<any>();
    const updateScrollToBottom = useCallback(() => {
        const editor = editorRef.current;
        if (!editor) {
            return;
        }
        if (updateScrollToBottomTimeoutRef.current) {
            return;
        }
        updateScrollToBottomTimeoutRef.current = setTimeout(() => {
            setShowScrollToBottom(!isLastLineVisible(editor));
            updateScrollToBottomTimeoutRef.current = null;
        }, 500);
    }, [editorRef, setShowScrollToBottom, updateScrollToBottomTimeoutRef]);

    const didScrollChangeHandlerRef = useRef<IDisposable>();
    const configureEditor = useCallback(
        (editor: editor.IStandaloneCodeEditor) => {
            editorRef.current = editor;

            // Attach a scroll handler to the editor.
            didScrollChangeHandlerRef.current?.dispose();
            didScrollChangeHandlerRef.current =
                editor.onDidScrollChange(updateScrollToBottom);

            // Write out our backlog of log lines.
            if (logLinesRef.current.length > 0) {
                pauseableAppendLogLines(logLinesRef.current);
            }
        },
        [pauseableAppendLogLines, editorRef, logLinesRef, updateScrollToBottom]
    );

    // Empty the editor if we change to a different container.
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
            onLogLines: pauseableAppendLogLines,
            onEnd: () => {
                setEnded(true);
            },
            timestamps: true,
            updateCoalesceInterval: 100,
        },
        [name, namespace, containerName, pauseableAppendLogLines, setEnded]
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
                    language: "containerLog",
                }}
                defaultValue=""
                configureEditor={configureEditor}
            />
            <HStack position="absolute" right={8} bottom={2} zIndex={50}>
                <ScaleFade in={showScrollToBottom}>
                    <Button size="xs" onClick={onClickScrollToBottom}>
                        Scroll to bottom
                    </Button>
                </ScaleFade>
                {!isEnded && (
                    <Spinner
                        size="sm"
                        speed="1.2s"
                        color="gray.300"
                        emptyColor="gray.700"
                        title="Live updating logs..."
                    />
                )}
            </HStack>
        </VStack>
    );
};
