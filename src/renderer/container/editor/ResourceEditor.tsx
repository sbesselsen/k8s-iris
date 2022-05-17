import {
    Box,
    Button,
    ButtonGroup,
    HStack,
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
import { cloneAndApply, diff, mergeDiffs } from "../../../common/util/diff";
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
import { toYaml } from "../../../common/util/yaml";

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
    const shouldEnableSave = !useContextLock();

    const [editorObject, setEditorObject] = useState(object);
    useEffect(() => {
        if (!objSameRef(object, editorObject)) {
            // Only change the editor object if it is different. Updates to the object at hand should not overwrite what's in the editor.
            setEditorObject(object);
        }
    }, [object, setEditorObject]);

    // Update the object and show a smart diff.
    const applyChanges = useCallback(
        (newObject: K8sObject) => {
            return (async () => {
                // Load the newest version of the object.
                const clusterObject = await client.read(object);
                let editObject = object;
                if (clusterObject) {
                    const clusterDiff = diff(object, clusterObject);
                    const editDiff = diff(object, newObject);
                    const mergedDiff = mergeDiffs(clusterDiff, editDiff);
                    if (mergedDiff.success) {
                        editObject = cloneAndApply(
                            object,
                            mergedDiff.diff
                        ) as K8sObject;
                    }
                }

                // Now show a diff between these two!
                console.log("edit", clusterObject, editObject);

                // TODO: actually show the diff!

                // setEditorObject(newObject);
            })();
        },
        [client, object, setEditorObject]
    );

    const onChange = useCallback(
        (newValue: object) => {
            return applyChanges(newValue as K8sObject);
        },
        [applyChanges]
    );

    const [value, setValue] = useState("");
    const valueRef = useRef<string>();
    useEffect(() => {
        valueRef.current = value;
    }, [value, valueRef]);
    useEffect(() => {
        setValue(toYaml(object));
    }, [object, setValue]);

    const configureEditor = (editor: monaco.editor.IStandaloneCodeEditor) => {
        editor.addAction({
            id: "apply-to-cluster",
            label: "Apply to cluster",
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
            contextMenuGroupId: "navigation",
            contextMenuOrder: 1.5,
            run: function () {
                console.log("Apply", valueRef.current);
            },
        });
    };

    return (
        <MonacoCodeEditor
            options={{ language: "yaml" }}
            value={value}
            onChange={setValue}
            configureEditor={configureEditor}
        />
    );
};
