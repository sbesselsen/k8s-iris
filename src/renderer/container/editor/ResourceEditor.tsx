import { ChevronDownIcon, DeleteIcon, EditIcon } from "@chakra-ui/icons";
import {
    Box,
    Button,
    HStack,
    IconButton,
    Menu,
    MenuButton,
    MenuItem,
    MenuList,
    VStack,
} from "@chakra-ui/react";
import React, { useCallback, useMemo } from "react";
import { K8sObject, K8sObjectIdentifier } from "../../../common/k8s/client";
import {
    K8sObjectHeading,
    K8sObjectViewer,
    K8sResourceDisplayRule,
} from "../../component/k8s/K8sObjectViewer";
import { ScrollBox } from "../../component/main/ScrollBox";
import { Toolbar } from "../../component/main/Toolbar";
import { useAppParam } from "../../context/param";
import { useIpcCall } from "../../hook/ipc";
import { useModifierKeyRef } from "../../hook/keyboard";
import { useK8sListWatch } from "../../k8s/list-watch";
import { ResourceYamlEditor } from "./ResourceYamlEditor";

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

    return (
        <VStack spacing={0} alignItems="stretch" w="100%" h="100%">
            <ResourceViewer object={object} />
        </VStack>
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

    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);
    const metaKeyPressedRef = useModifierKeyRef("Meta");

    const [showDetails, setShowDetails] = useAppParam("showDetails", false);
    const [mode, setMode] = useAppParam<"view" | "edit">("editorMode", "view");
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

    const onCancelEdit = useCallback(() => {
        setMode("view");
    }, [setMode]);
    const onClickEdit = useCallback(() => {
        if (metaKeyPressedRef.current) {
            createWindow({
                route: setMode.asRoute("edit"),
            });
        } else {
            setMode("edit");
        }
    }, [createWindow, metaKeyPressedRef, setMode]);

    if (!kind || !apiVersion || !metadata) {
        return null;
    }

    if (mode === "edit") {
        return (
            <VStack spacing={0} flex="1 0 0" alignItems="stretch">
                <ResourceYamlEditor
                    object={object}
                    onBackPressed={onCancelEdit}
                    onAfterApply={onCancelEdit}
                />
            </VStack>
        );
    }
    return (
        <ScrollBox
            px={4}
            py={2}
            bottomToolbar={
                <Toolbar>
                    <Button
                        colorScheme="primary"
                        leftIcon={<EditIcon />}
                        onClick={onClickEdit}
                    >
                        Edit
                    </Button>
                    <IconButton
                        colorScheme="primary"
                        icon={<DeleteIcon />}
                        aria-label="Delete"
                        title="Delete"
                    />
                    <Box flex="1 0 0"></Box>
                    <ShowDetailsToggle
                        value={showDetails}
                        onChange={onChangeShowDetails}
                    />
                </Toolbar>
            }
        >
            <VStack spacing={4} alignItems="stretch">
                <HStack alignItems="baseline" pt={2}>
                    <K8sObjectHeading
                        kind={kind}
                        apiVersion={apiVersion}
                        metadata={metadata}
                        flex="1 0 0"
                    />
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

    return (
        <Menu>
            <MenuButton
                colorScheme="primary"
                as={Button}
                aria-label="View mode"
                title="View mode"
                fontWeight="normal"
                variant="ghost"
                rightIcon={<ChevronDownIcon />}
            >
                {value ? "Detailed view" : "Simple view"}
            </MenuButton>
            <MenuList>
                <MenuItem onClick={onClickSimple}>Simple view</MenuItem>
                <MenuItem onClick={onClickDetailed}>Detailed view</MenuItem>
            </MenuList>
        </Menu>
    );
};
