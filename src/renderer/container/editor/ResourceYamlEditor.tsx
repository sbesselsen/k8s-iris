import { Button, HStack, Icon, VStack } from "@chakra-ui/react";
import {
    AiFillCaretLeft,
    AiFillCaretRight,
    AiOutlineReload,
} from "react-icons/ai";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import * as monaco from "monaco-editor";
import { K8sObject } from "../../../common/k8s/client";
import { objSameRef } from "../../../common/k8s/util";
import {
    cloneAndApply,
    diff,
    MergeConflict,
    mergeDiffs,
} from "../../../common/util/diff";
import { MonacoCodeEditor } from "../../component/editor/MonacoCodeEditor";
import { useContextLock } from "../../context/context-lock";
import { useK8sClient } from "../../k8s/client";
import { parseYaml, toYaml } from "../../../common/util/yaml";
import { useDialog } from "../../hook/dialog";
import { MonacoDiffEditor } from "../../component/editor/MonacoDiffEditor";
import { deepEqual } from "../../../common/util/deep-equal";
import { useKeyListener } from "../../hook/keyboard";
import { Toolbar } from "../../component/main/Toolbar";

export type ResourceYamlEditorProps = {
    object?: K8sObject | undefined;
    onBackPressed?: () => void;
    onAfterApply?: (object: K8sObject) => void;
    shouldShowBackButton?: boolean;
};

export const ResourceYamlEditor: React.FC<ResourceYamlEditorProps> = (
    props
) => {
    const {
        object,
        onBackPressed,
        onAfterApply,
        shouldShowBackButton = false,
    } = props;

    const client = useK8sClient();
    const isClusterLocked = useContextLock();
    const showDialog = useDialog();

    const [editorObject, setEditorObjectState] = useState(object);
    const [originalValue, setOriginalValue] = useState("");
    const [value, setValue] = useState("");
    const [phase, setPhase] = useState<"edit" | "review">("edit");
    const [isApplyInProgress, setApplyInProgress] = useState(false);

    const updateValueFromObject = useCallback(
        (object: K8sObject | undefined) => {
            const newValue = toYaml(object);
            setOriginalValue(newValue);
            setValue(newValue);
        },
        [setOriginalValue, setValue]
    );

    const setEditorObject = useCallback(
        (object: K8sObject, updateValue = true) => {
            setEditorObjectState(object);

            if (updateValue) {
                updateValueFromObject(object);
            }
        },
        [setEditorObjectState, updateValueFromObject]
    );

    useEffect(() => {
        // Update values etc from the editorObject on load.
        updateValueFromObject(editorObject);
    }, []);

    useEffect(() => {
        if (!objSameRef(object, editorObject)) {
            // Only change the editor object if it is different. Updates to the object at hand should not overwrite what's in the editor.
            setEditorObject(object);
        }
    }, [object, setEditorObject]);

    const hasUpstreamChanges = useMemo(
        () => !deepEqual(editorObject, object),
        [editorObject, object]
    );

    const mergeClusterUpdates = useCallback(():
        | { merged: true }
        | {
              merged: false;
              reason: "no_diff" | "invalid_yaml";
              error?: any;
          } => {
        let newObject: K8sObject;
        try {
            newObject = parseYaml(value) as K8sObject;
        } catch (e) {
            return { merged: false, reason: "invalid_yaml", error: e };
        }

        let clusterObject = object;
        const editDiff = diff(editorObject, newObject);
        if (!editDiff) {
            return { merged: false, reason: "no_diff" };
        }
        const clusterDiff = diff(editorObject, clusterObject);
        // Create a merged diff, where in case of conflicts, we choose the side of the edit we just made.
        // The user is going to review it anyway!
        const mergedDiff = mergeDiffs(
            clusterDiff,
            editDiff,
            (conflict: MergeConflict) => {
                return conflict.rightDiff;
            }
        );
        if (mergedDiff.diff) {
            // We can show a simplified diff of only the items on "our side" of the diff, at least as far as possible.
            newObject = cloneAndApply(
                editorObject,
                mergedDiff.diff
            ) as K8sObject;
        }

        // Re-create the cluster object as (editorObject + diff(editorObject, clusterObject)) to make sure all object keys are in the same order. Nicer diff!
        clusterObject = cloneAndApply(editorObject, clusterDiff) as K8sObject;

        setEditorObject(clusterObject, false);
        setOriginalValue(toYaml(clusterObject));
        setValue(toYaml(newObject));

        return { merged: true };
    }, [
        editorObject,
        object,
        setEditorObject,
        setOriginalValue,
        setValue,
        value,
    ]);

    const onReview = useCallback(() => {
        if (isClusterLocked) {
            showDialog({
                title: "Read-only mode",
                type: "error",
                message: "This cluster is in read-only mode.",
                detail: "You can save after you unlock the cluster with the lock/unlock button in the toolbar.",
                buttons: ["OK"],
            });
            return;
        }

        const result = mergeClusterUpdates();
        if (result.merged === false) {
            // Typescript does not discriminate type with !result.merged
            if (result.reason === "invalid_yaml") {
                showDialog({
                    title: "Invalid yaml",
                    type: "error",
                    message: "The yaml you are trying to apply is invalid.",
                    detail: result.error ? String(result.error) : null,
                    buttons: ["OK"],
                });
            }
            return;
        }

        setPhase("review");
    }, [isClusterLocked, showDialog, mergeClusterUpdates, setPhase]);

    const onReviewRef = useRef<() => void>(onReview);
    useEffect(() => {
        onReviewRef.current = onReview;
    }, [onReview, onReviewRef]);

    const cancelReview = useCallback(() => {
        if (phase === "review") {
            setPhase("edit");
        }
    }, [phase, setPhase]);

    const onBackToEditor = useCallback(() => {
        cancelReview();
    }, [cancelReview]);

    const onApply = useCallback(() => {
        let newObject: K8sObject;
        try {
            newObject = parseYaml(value) as K8sObject;
        } catch (e) {
            showDialog({
                title: "Invalid yaml",
                type: "error",
                message: "The yaml you are trying to apply is invalid.",
                detail: String(e),
                buttons: ["OK"],
            });
            return;
        }
        setApplyInProgress(true);
        (async () => {
            try {
                const response = await client.apply(newObject);
                setEditorObject(response);
                setPhase("edit");
                onAfterApply?.(response);
            } catch (e) {
                showDialog({
                    title: "Error applying",
                    type: "error",
                    message:
                        "Kubernetes reported an error while applying your changes.",
                    detail: e?.message ?? String(e),
                    buttons: ["OK"],
                });
            }
            setApplyInProgress(false);
        })();
    }, [
        client,
        value,
        onAfterApply,
        setApplyInProgress,
        setEditorObject,
        setPhase,
    ]);
    const onApplyRef = useRef<() => void>(onApply);
    useEffect(() => {
        onApplyRef.current = onApply;
    }, [onApply, onApplyRef]);

    const onClickUpdate = useCallback(() => {
        const result = mergeClusterUpdates();
        if (result.merged === false) {
            switch (result.reason) {
                case "no_diff":
                    // No local edits, so we can just overwrite the value.
                    setEditorObject(object);
                    break;
                case "invalid_yaml":
                    showDialog({
                        title: "Invalid yaml",
                        type: "error",
                        message:
                            "Cannot update your editor because your yaml is currently invalid.",
                        detail: result.error ? String(result.error) : null,
                        buttons: ["OK"],
                    });
                    break;
            }
        }
    }, [object, mergeClusterUpdates, setEditorObject, showDialog]);

    useKeyListener(
        useCallback(
            (eventType, key) => {
                if (eventType === "keydown" && key === "Escape") {
                    if (phase === "review") {
                        cancelReview();
                    }
                }
            },
            [phase, cancelReview]
        )
    );

    const configureEditor = useCallback(
        (editor: monaco.editor.IStandaloneCodeEditor) => {
            addDefaultEditorActions(editor);
            editor.addAction({
                id: "review-changes",
                label: "Review changes",
                keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
                contextMenuGroupId: "navigation",
                contextMenuOrder: 1.5,
                run: async () => {
                    onReviewRef.current();
                },
            });
        },
        [onReviewRef]
    );
    const configureDiffEditor = useCallback(
        (editor: monaco.editor.IStandaloneDiffEditor) => {
            addDefaultEditorActions(editor.getModifiedEditor());
            editor.addAction({
                id: "save",
                label: "Save to cluster",
                keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
                contextMenuGroupId: "navigation",
                contextMenuOrder: 1.5,
                run: async () => {
                    onApplyRef.current();
                },
            });
        },
        [onReviewRef]
    );

    return (
        <VStack
            alignItems="stretch"
            flex="1 0 0"
            position="relative"
            spacing={0}
        >
            {phase === "edit" && (
                <MonacoCodeEditor
                    options={{
                        language: "yaml",
                        minimap: { enabled: false }, // I hate that little freak
                        links: false, // and don't even get me started on clickable links
                        padding: { top: 5 },
                    }}
                    value={value}
                    onChange={setValue}
                    configureEditor={configureEditor}
                    focusOnInit={true}
                />
            )}
            {phase === "review" && (
                <MonacoDiffEditor
                    options={{
                        language: "yaml",
                        minimap: { enabled: false },
                        links: false,
                        padding: { top: 5 },
                    }}
                    originalValue={originalValue}
                    value={value}
                    onChange={setValue}
                    configureEditor={configureDiffEditor}
                    focusOnInit={true}
                />
            )}
            <HStack
                position="absolute"
                bottom={0}
                left={0}
                right={0}
                px={6}
                pb={3}
                justifyContent="center"
            >
                <Toolbar>
                    {phase === "edit" && (
                        <>
                            {shouldShowBackButton && onBackPressed && (
                                <Button
                                    colorScheme="primary"
                                    variant="ghost"
                                    onClick={onBackPressed}
                                    leftIcon={<Icon as={AiFillCaretLeft} />}
                                >
                                    Back
                                </Button>
                            )}
                            {hasUpstreamChanges && (
                                <Button
                                    colorScheme="yellow"
                                    variant="outline"
                                    onClick={onClickUpdate}
                                    leftIcon={<Icon as={AiOutlineReload} />}
                                >
                                    Update
                                </Button>
                            )}
                            <Button
                                colorScheme="primary"
                                onClick={onReview}
                                rightIcon={<Icon as={AiFillCaretRight} />}
                                isDisabled={originalValue === value}
                            >
                                Review changes
                            </Button>
                        </>
                    )}
                    {phase === "review" && (
                        <>
                            <Button
                                colorScheme="primary"
                                variant="ghost"
                                onClick={onBackToEditor}
                                leftIcon={<Icon as={AiFillCaretLeft} />}
                            >
                                Back
                            </Button>
                            {hasUpstreamChanges && (
                                <Button
                                    colorScheme="yellow"
                                    variant="outline"
                                    onClick={onClickUpdate}
                                    leftIcon={<Icon as={AiOutlineReload} />}
                                >
                                    Update
                                </Button>
                            )}
                            <Button
                                colorScheme="primary"
                                onClick={onApply}
                                isLoading={isApplyInProgress}
                                loadingText="Applying"
                            >
                                Apply
                            </Button>
                        </>
                    )}
                </Toolbar>
            </HStack>
        </VStack>
    );
};

function addDefaultEditorActions(editor: monaco.editor.IStandaloneCodeEditor) {
    editor.addAction({
        id: "b64-decode",
        label: "Base64 Decode",
        contextMenuGroupId: "1_modification",
        contextMenuOrder: 1.1,
        run: async () => {
            // Get the current selection in the editor.
            const selection = editor.getSelection();
            if (!selection) {
                return;
            }
            const b64 = editor.getModel().getValueInRange(selection);
            editor.executeEdits("clipboard", [
                {
                    range: selection,
                    text: atob(b64),
                    forceMoveMarkers: true,
                },
            ]);
        },
    });
    editor.addAction({
        id: "b64-encode",
        label: "Base64 Encode",
        contextMenuGroupId: "1_modification",
        contextMenuOrder: 1.11,
        run: async () => {
            // Get the current selection in the editor.
            const selection = editor.getSelection();
            if (!selection) {
                return;
            }
            const plain = editor.getModel().getValueInRange(selection);
            editor.executeEdits("clipboard", [
                {
                    range: selection,
                    text: btoa(plain),
                    forceMoveMarkers: true,
                },
            ]);
        },
    });
    editor.addAction({
        id: "copy-as-plain",
        label: "Copy Base64 Decoded",
        keybindings: [
            monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyC,
        ],
        contextMenuGroupId: "9_cutcopypaste",
        contextMenuOrder: 1.5,
        run: async () => {
            // Get the current selection in the editor.
            const selection = editor.getSelection();
            if (!selection) {
                return;
            }
            const b64 = editor.getModel().getValueInRange(selection);
            navigator.clipboard.writeText(atob(b64));
        },
    });
    editor.addAction({
        id: "paste-as-base64",
        label: "Paste Base64 Encoded",
        keybindings: [
            monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyV,
        ],
        contextMenuGroupId: "9_cutcopypaste",
        contextMenuOrder: 2.5,
        run: async () => {
            editor.focus();

            // Get the current clipboard contents
            const text = await navigator.clipboard.readText();

            // Get the current selection in the editor.
            const selection = editor.getSelection();
            if (!selection) {
                return;
            }

            // Replace the current contents with the text from the clipboard.
            editor.executeEdits("clipboard", [
                {
                    range: selection,
                    text: btoa(text),
                    forceMoveMarkers: true,
                },
            ]);
        },
    });
}
