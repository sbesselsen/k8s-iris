import {
    Box,
    Button,
    ButtonGroup,
    HStack,
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalOverlay,
    useColorModeValue,
    useToken,
    VStack,
} from "@chakra-ui/react";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import * as monaco from "monaco-editor";
import { K8sObject, K8sObjectIdentifier } from "../../../common/k8s/client";
import { objSameRef } from "../../../common/k8s/util";
import {
    cloneAndApply,
    diff,
    MergeConflict,
    mergeDiffs,
} from "../../../common/util/diff";
import { MonacoCodeEditor } from "../../component/editor/MonacoCodeEditor";
import {
    K8sObjectHeading,
    K8sObjectViewer,
    K8sResourceDisplayRule,
} from "../../component/k8s/K8sObjectViewer";
import { ContentTabs } from "../../component/main/ContentTabs";
import { ScrollBox } from "../../component/main/ScrollBox";
import { useContextLock } from "../../context/context-lock";
import { useAppParam } from "../../context/param";
import { useIpcCall } from "../../hook/ipc";
import { useK8sClient } from "../../k8s/client";
import { useK8sListWatch } from "../../k8s/list-watch";
import { parseYaml, toYaml } from "../../../common/util/yaml";
import { useDialog } from "../../hook/dialog";
import { MonacoDiffEditor } from "../../component/editor/MonacoDiffEditor";
import { deepEqual } from "../../../common/util/deep-equal";
import { useKeyListener } from "../../hook/keyboard";

export type ResourceEditorProps = {
    editorResource: K8sObjectIdentifier;
};

const displayRules: K8sResourceDisplayRule[] = [
    {
        selector: ".",
        displayAs: "accordion",
        keysOrder: ["metadata", "spec", "*", "status"],
    },
    {
        selector: ".apiVersion",
        displayAs: "hidden",
    },
    {
        selector: ".kind",
        displayAs: "hidden",
    },
    {
        selector: ".metadata",
        keysOrder: [
            "name",
            "namespace",
            "annotations",
            "labels",
            "*",
            "ownerReferences",
            "managedFields",
        ],
    },
    {
        selector: ".spec",
        keysOrder: ["containers", "volumes", "*"],
    },
    {
        selector: ".spec.template.spec",
        keysOrder: ["containers", "volumes", "*"],
    },
    {
        selector: "..containers",
        autoExpandSingleItem: true,
        displayAs: "accordion",
    },
    {
        selector: ".status.podIPs",
        autoExpandSingleItem: true,
    },
    {
        selector: "..annotations",
        displayAs: "string-key-pair",
    },
    {
        selector: "..labels",
        displayAs: "string-key-pair",
        keyValueSeparator: "=",
    },
    {
        selector: "..matchLabels",
        displayAs: "string-key-pair",
        keyValueSeparator: "=",
    },
];

const detailSelectors: string[] = [
    "..resourceVersion",
    "..managedFields",
    "..uid",
    "..providerID",
    "..finalizers",
    ".metadata.generation",
    ".metadata.generateName",
    ".metadata.ownerReferences",
    "..terminationMessagePath",
    "..terminationMessagePolicy",
    "..dnsPolicy",
    "..enableServiceLinks",
    ".spec.nodeName",
    ".spec.preemptionPolicy",
    ".spec.priority",
    ".spec.priorityClassName",
    ".spec.progressDeadlineSeconds",
    "..revisionHistoryLimit",
    ".spec.rules.http.paths.pathType",
    "..schedulerName",
    ".spec.template.metadata.creationTimestamp",
    "..terminationGracePeriodSeconds",
    ".spec.tolerations",
    ".status.qosClass",
    ".status.containerStatuses.containerID",
    ".status.observedGeneration",
];

export const ResourceEditor: React.FC<ResourceEditorProps> = (props) => {
    const { editorResource } = props;

    const [_isLoadingObjects, objects, _objectsError] = useK8sListWatch(
        {
            apiVersion: editorResource.apiVersion,
            kind: editorResource.kind,
            ...(editorResource.namespace
                ? { namespaces: [editorResource.namespace] }
                : {}),
        },
        {},
        [editorResource]
    );

    const object = useMemo(
        () =>
            objects?.items?.find(
                (item) => item.metadata.name === editorResource.name
            ),
        [objects]
    );

    const [activeTab, setActiveTab] = useAppParam("tab", "view");

    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);

    const onChangeTabSelection = useCallback(
        (id: string, requestNewWindow: boolean = false) => {
            if (requestNewWindow) {
                createWindow({
                    route: setActiveTab.asRoute(id),
                });
            } else {
                setActiveTab(id);
            }
        },
        [createWindow, setActiveTab]
    );

    const tabs = [
        {
            id: "view",
            title: "View",
            content: <ResourceViewer object={object} />,
        },
        {
            id: "edit",
            title: "Edit",
            content: <ResourceYamlEditor object={object} />,
        },
    ];
    return (
        <ContentTabs
            tabs={tabs}
            selected={activeTab}
            onChangeSelection={onChangeTabSelection}
            isLazy
        />
    );
};

type ResourceViewerProps = {
    object: K8sObject | undefined;
};

const detailedDisplayRules = displayRules;
const undetailedDisplayRules = [
    ...displayRules,
    ...detailSelectors.map(
        (selector) =>
            ({
                selector,
                displayAs: "hidden",
            } as const)
    ),
];

const ResourceViewer: React.FC<ResourceViewerProps> = React.memo((props) => {
    const { object } = props;

    const kind = object?.kind;
    const apiVersion = object?.apiVersion;
    const metadata = object?.metadata;

    const [showDetails, setShowDetails] = useAppParam("showDetails", false);
    const onChangeShowDetails = useCallback(
        (value: boolean) => {
            setShowDetails(value, true);
        },
        [setShowDetails]
    );

    const [expandedItems, setExpandedItems] = useAppParam<string[]>(
        "expandedItems",
        []
    );

    const onChangeExpandedItems = useCallback(
        (items: string[]) => {
            setExpandedItems(items, true);
        },
        [setExpandedItems]
    );

    if (!kind || !apiVersion || !metadata) {
        return null;
    }

    return (
        <ScrollBox px={4} py={2}>
            <VStack spacing={4} alignItems="stretch">
                <HStack alignItems="baseline">
                    <K8sObjectHeading
                        kind={kind}
                        apiVersion={apiVersion}
                        metadata={metadata}
                        flex="1 0 0"
                    />
                    <Box>
                        <ShowDetailsToggle
                            value={showDetails}
                            onChange={onChangeShowDetails}
                        />
                    </Box>
                </HStack>
                {object && (
                    <K8sObjectViewer
                        data={object}
                        expandedItems={expandedItems}
                        onChangeExpandedItems={onChangeExpandedItems}
                        displayRules={
                            showDetails
                                ? detailedDisplayRules
                                : undetailedDisplayRules
                        }
                    />
                )}
            </VStack>
        </ScrollBox>
    );
});

const ShowDetailsToggle: React.FC<{
    value: boolean;
    onChange: (showDetails: boolean) => void;
}> = (props) => {
    const { value, onChange } = props;

    const onClickSimple = useCallback(() => {
        onChange(false);
    }, [onChange]);

    const onClickDetailed = useCallback(() => {
        onChange(true);
    }, [onChange]);

    const itemTextColor = useColorModeValue("primary.900", "white");

    const borderColor = "primary.500";
    const hoverColor = useColorModeValue("primary.50", "primary.900");
    const focusShadow = useToken("shadows", "outline");

    return (
        <ButtonGroup variant="outline" size="xs" isAttached>
            <Button
                mr="-1px"
                borderColor={borderColor}
                textColor={itemTextColor}
                isActive={!value}
                _active={{
                    bg: borderColor,
                    textColor: "white",
                }}
                _hover={{
                    bg: hoverColor,
                }}
                _focus={{}}
                _focusVisible={{
                    boxShadow: focusShadow,
                }}
                onClick={onClickSimple}
            >
                Simple
            </Button>
            <Button
                borderColor={borderColor}
                textColor={itemTextColor}
                isActive={value}
                _active={{
                    bg: borderColor,
                    textColor: "white",
                }}
                _hover={{
                    bg: hoverColor,
                }}
                _focus={{}}
                _focusVisible={{
                    boxShadow: focusShadow,
                }}
                onClick={onClickDetailed}
            >
                Detailed
            </Button>
        </ButtonGroup>
    );
};

type ResourceYamlEditorProps = {
    object: K8sObject | undefined;
};

const ResourceYamlEditor: React.FC<ResourceYamlEditorProps> = (props) => {
    const { object } = props;
    return object ? <InnerResourceYamlEditor {...props} /> : null;
};

type InnerResourceYamlEditorProps = {
    object: K8sObject;
};

const InnerResourceYamlEditor: React.FC<InnerResourceYamlEditorProps> = (
    props
) => {
    const { object } = props;

    const client = useK8sClient();
    const isClusterLocked = useContextLock();
    const showDialog = useDialog();

    const [editorObject, setEditorObject] = useState(object);
    const [value, setValue] = useState("");
    const [phase, setPhase] = useState<"edit" | "review">("edit");
    const [reviewOriginalValue, setReviewOriginalValue] = useState("");
    const [reviewValue, setReviewValue] = useState("");

    useEffect(() => {
        if (!objSameRef(object, editorObject)) {
            // Only change the editor object if it is different. Updates to the object at hand should not overwrite what's in the editor.
            setEditorObject(object);
        }
    }, [object, setEditorObject]);
    useEffect(() => {
        setValue(toYaml(editorObject));
    }, [editorObject, setValue]);

    const updateDiffEditor = useCallback(
        (value: string): boolean => {
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
                return false;
            }
            console.log("newObject", toYaml(newObject));

            let clusterObject = object;
            console.log("clusterObject", toYaml(clusterObject));
            const editDiff = diff(editorObject, newObject);
            console.log("editDiff", toYaml(editDiff));
            if (!editDiff) {
                return false;
            }
            const clusterDiff = diff(editorObject, clusterObject);
            console.log("clusterDiff", toYaml(clusterDiff));
            // Create a merged diff, where in case of conflicts, we choose the side of the edit we just made.
            // The user is going to review it anyway!
            const mergedDiff = mergeDiffs(
                clusterDiff,
                editDiff,
                (conflict: MergeConflict) => {
                    return conflict.rightDiff;
                }
            );
            console.log("mergedDiff", toYaml(mergedDiff));
            if (mergedDiff.diff) {
                // We can show a simplified diff of only the items on "our side" of the diff, at least as far as possible.
                newObject = cloneAndApply(
                    editorObject,
                    mergedDiff.diff
                ) as K8sObject;
            }

            // Re-create the cluster object as (editorObject + diff(editorObject, clusterObject)) to make sure all object keys are in the same order. Nicer diff!
            clusterObject = cloneAndApply(
                editorObject,
                clusterDiff
            ) as K8sObject;

            setEditorObject(clusterObject);
            setReviewOriginalValue(toYaml(clusterObject));
            setReviewValue(toYaml(newObject));

            return true;
        },
        [
            editorObject,
            object,
            setEditorObject,
            setReviewOriginalValue,
            setReviewValue,
            showDialog,
        ]
    );

    const onReview = useCallback(() => {
        if (isClusterLocked) {
            showDialog({
                title: "Read-only mode",
                type: "error",
                message: "This cluster is in read-only mode.",
                detail: "You can save after you click 'Allow changes' next to the cluster selector.",
                buttons: ["OK"],
            });
            return;
        }

        if (!updateDiffEditor(value)) {
            return;
        }

        setPhase("review");
    }, [isClusterLocked, showDialog, updateDiffEditor, setPhase, value]);

    const onReviewRef = useRef<() => void>(onReview);
    useEffect(() => {
        onReviewRef.current = onReview;
    }, [onReview, onReviewRef]);

    const cancelReview = useCallback(() => {
        if (phase === "review") {
            setValue(reviewValue);
            setPhase("edit");
        }
    }, [phase, reviewValue, setPhase, setValue]);

    const onBackToEditor = useCallback(() => {
        cancelReview();
    }, [cancelReview]);

    const onSave = useCallback(() => {
        // TODO
        // Check again if anything happened to object that might conflict with our local changes.
        // If so, show a dialog and updateDiffEditor(reviewValue).
        // If not, actually save. Use a JSON patch if possible. We will see if it is.
    }, [reviewValue]);
    const onSaveRef = useRef<() => void>(onSave);
    useEffect(() => {
        onSaveRef.current = onSave;
    }, [onSave, onSaveRef]);

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
            editor.addAction({
                id: "save",
                label: "Save to cluster",
                keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
                contextMenuGroupId: "navigation",
                contextMenuOrder: 1.5,
                run: async () => {
                    onSaveRef.current();
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
                    }}
                    value={value}
                    onChange={setValue}
                    configureEditor={configureEditor}
                />
            )}
            {phase === "review" && (
                <MonacoDiffEditor
                    options={{
                        language: "yaml",
                        minimap: { enabled: false },
                    }}
                    originalValue={reviewOriginalValue}
                    value={reviewValue}
                    onChange={setReviewValue}
                    configureEditor={configureDiffEditor}
                />
            )}
            <HStack flex="0 0 auto" justifyContent="end" px={4} py={2}>
                {phase === "edit" && (
                    <>
                        <Button colorScheme="primary" onClick={onReview}>
                            Save
                        </Button>
                    </>
                )}
                {phase === "review" && (
                    <>
                        <Button
                            colorScheme="primary"
                            variant="ghost"
                            onClick={onBackToEditor}
                        >
                            Back to editor
                        </Button>
                        <Button colorScheme="primary" onClick={onSave}>
                            Save
                        </Button>
                    </>
                )}
            </HStack>
        </VStack>
    );
};
