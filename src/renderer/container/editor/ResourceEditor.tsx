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
    useConst,
    VStack,
} from "@chakra-ui/react";
import React, { useCallback, useMemo, useState } from "react";
import {
    K8sObject,
    K8sObjectIdentifier,
    K8sResourceTypeIdentifier,
} from "../../../common/k8s/client";
import {
    K8sObjectHeading,
    K8sObjectViewer,
    K8sResourceDisplayRule,
} from "../../component/k8s/K8sObjectViewer";
import { ScrollBox } from "../../component/main/ScrollBox";
import { Toolbar } from "../../component/main/Toolbar";
import {
    appEditorForK8sObject,
    isAppEditorForK8sObject,
    useAppEditorsStore,
} from "../../context/editors";
import { useK8sNamespaces } from "../../context/k8s-namespaces";
import { useAppParam } from "../../context/param";
import { useAppRouteSetter } from "../../context/route";
import { useDialog } from "../../hook/dialog";
import { useIpcCall } from "../../hook/ipc";
import { useModifierKeyRef } from "../../hook/keyboard";
import { useK8sApiResourceTypes } from "../../k8s/api-resources";
import { useK8sClient } from "../../k8s/client";
import { useK8sListWatch } from "../../k8s/list-watch";
import { ResourceTypeSelector } from "../resources/ResourceTypeSelector";
import { ResourceYamlEditor } from "./ResourceYamlEditor";

export type ResourceEditorProps = {
    editorResource: K8sObjectIdentifier;
    isSuspended?: boolean;
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
    const { editorResource, isSuspended = false } = props;

    const [isLoadingObjects, objects, _objectsError] = useK8sListWatch(
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
            {!isLoadingObjects && (
                <ResourceViewer object={object} isSuspended={isSuspended} />
            )}
        </VStack>
    );
};

type ResourceViewerProps = {
    object: K8sObject | undefined;
    isSuspended?: boolean;
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
    const { object, isSuspended = false } = props;

    const kind = object?.kind;
    const apiVersion = object?.apiVersion;
    const metadata = object?.metadata;

    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);
    const metaKeyPressedRef = useModifierKeyRef("Meta");
    const client = useK8sClient();
    const showDialog = useDialog();

    const appEditorStore = useAppEditorsStore();

    const [showDetails, setShowDetails] = useAppParam("showDetails", false);
    const [mode, setMode] = useAppParam<"view" | "edit">("editorMode", "view");
    const [isDeleting, setIsDeleting] = useState(false);
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
    const onClickDelete = useCallback(() => {
        (async () => {
            const result = await showDialog({
                title: "Confirm deletion",
                message: "Are you sure?",
                detail: `Are you sure you want to delete ${object.kind.toLocaleLowerCase()} ${
                    object.metadata.name
                }?`,
                buttons: ["Yes", "No"],
            });
            if (result.response === 0) {
                setIsDeleting(true);
                await client.remove(object, { waitForCompletion: false });

                // Close the editor.
                // TODO: some kind of bus for updates to objects, so we can do this in a central place?
                appEditorStore.set((editors) =>
                    editors.filter((e) => !isAppEditorForK8sObject(e, object))
                );
            }
        })();
    }, [appEditorStore, client, object, setIsDeleting]);

    if (!kind || !apiVersion || !metadata) {
        return <Box p={4}>This resource is not available.</Box>;
    }

    if (mode === "edit") {
        return (
            <VStack spacing={0} flex="1 0 0" alignItems="stretch">
                <ResourceYamlEditor
                    object={object}
                    onBackPressed={onCancelEdit}
                    onAfterApply={onCancelEdit}
                    shouldShowBackButton={true}
                    isSuspended={isSuspended}
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
                        isDisabled={isDeleting}
                    >
                        Edit
                    </Button>
                    <IconButton
                        colorScheme="primary"
                        icon={<DeleteIcon />}
                        aria-label="Delete"
                        title="Delete"
                        onClick={onClickDelete}
                        isLoading={isDeleting}
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

export type NewResourceEditorProps = {
    editorId: string;
    resourceType?: K8sResourceTypeIdentifier;
    isSuspended?: boolean;
};

export const NewResourceEditor: React.FC<NewResourceEditorProps> = (props) => {
    const { editorId, isSuspended = false, resourceType } = props;

    const [selectedResourceType, setSelectedResourceType] = useState<
        K8sResourceTypeIdentifier | undefined
    >(resourceType);

    const namespaces = useK8sNamespaces();
    const namespacesConst = useConst(namespaces);

    const [_isLoadingResourceTypes, resourceTypes, _resourceTypesError] =
        useK8sApiResourceTypes();
    const resourceTypeInfo = useMemo(
        () =>
            selectedResourceType
                ? resourceTypes?.find(
                      (t) =>
                          t.apiVersion === selectedResourceType.apiVersion &&
                          t.kind === selectedResourceType.kind &&
                          !t.isSubResource
                  )
                : null,
        [resourceTypes, selectedResourceType]
    );

    const editorsStore = useAppEditorsStore();
    const setAppRoute = useAppRouteSetter();

    const object: K8sObject = useMemo(
        () =>
            selectedResourceType
                ? {
                      apiVersion: selectedResourceType.apiVersion,
                      kind: selectedResourceType.kind,
                      metadata: {
                          name: "",
                          ...(resourceTypeInfo?.namespaced
                              ? {
                                    namespace:
                                        namespacesConst.mode === "selected" &&
                                        namespacesConst.selected.length === 1
                                            ? namespacesConst.selected[0]
                                            : "",
                                }
                              : {}),
                      },
                  }
                : null,
        [namespacesConst, selectedResourceType]
    );

    const onAfterApply = useCallback(
        (object: K8sObject) => {
            const createdResourceEditor = appEditorForK8sObject(object);
            editorsStore.set((editors) =>
                editors.map((e) =>
                    e.id === editorId ? createdResourceEditor : e
                )
            );
            setAppRoute((route) => {
                if (route.activeEditor?.id === editorId) {
                    return { ...route, activeEditor: createdResourceEditor };
                }
                return route;
            });
        },
        [editorId, editorsStore, setAppRoute]
    );

    return (
        <VStack w="100%" h="100%" spacing={0} alignItems="stretch">
            <Box px={2} py={2} flex="0 0 auto">
                <ResourceTypeSelector
                    value={selectedResourceType}
                    onChange={setSelectedResourceType}
                    emptyValueContent="Select a resource type..."
                />
            </Box>
            <VStack overflow="hidden" flex="1 0 0" alignItems="stretch">
                {object && (
                    <ResourceYamlEditor
                        object={object}
                        onAfterApply={onAfterApply}
                        shouldShowBackButton={false}
                        isSuspended={isSuspended}
                    />
                )}
            </VStack>
        </VStack>
    );
};
