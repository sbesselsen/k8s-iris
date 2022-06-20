import {
    AddIcon,
    ChevronDownIcon,
    DeleteIcon,
    EditIcon,
} from "@chakra-ui/icons";
import { FiTerminal } from "react-icons/fi";
import { RiTextWrap } from "react-icons/ri";
import { MdCastConnected } from "react-icons/md";
import {
    Box,
    Button,
    HStack,
    Icon,
    IconButton,
    Input,
    Menu,
    MenuButton,
    MenuItem,
    MenuList,
    Popover,
    PopoverArrow,
    PopoverBody,
    PopoverCloseButton,
    PopoverContent,
    PopoverHeader,
    PopoverTrigger,
    Spinner,
    Table,
    Tbody,
    Td,
    Text,
    Th,
    Thead,
    Tr,
    useConst,
    VStack,
} from "@chakra-ui/react";
import React, {
    ChangeEvent,
    KeyboardEvent,
    useCallback,
    useMemo,
    useState,
} from "react";
import {
    K8sObject,
    K8sObjectIdentifier,
    K8sPortForwardEntry,
    K8sResourceTypeIdentifier,
} from "../../../common/k8s/client";
import {
    K8sObjectHeading,
    K8sObjectViewer,
    K8sResourceDisplayRule,
} from "../../component/k8s/K8sObjectViewer";
import { ScrollBox } from "../../component/main/ScrollBox";
import { Toolbar } from "../../component/main/Toolbar";
import { useContextLock } from "../../context/context-lock";
import {
    resourceEditor,
    isEditorForResource,
    useAppEditorsStore,
    logsEditor,
    shellEditor,
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
import { useEditorOpener } from "../../hook/editor-link";
import { useK8sPortForwardsWatch } from "../../k8s/port-forward-watch";

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
            {!isLoadingObjects && <ResourceViewer object={object} />}
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
    const client = useK8sClient();
    const showDialog = useDialog();

    const openEditor = useEditorOpener();

    const isClusterLocked = useContextLock();

    const appEditorStore = useAppEditorsStore();

    const [showDetails, setShowDetails] = useState(false);
    const [mode, setMode] = useAppParam<"view" | "edit">("editorMode", "view");
    const [isDeleting, setIsDeleting] = useState(false);

    const [expandedItems, setExpandedItems] = useState<string[]>([]);

    const onCancelEdit = useCallback(() => {
        setMode("view");
    }, [setMode]);
    const onClickEdit = useCallback(() => {
        if (metaKeyPressedRef.current) {
            createWindow({
                route: { ...setMode.asRoute("edit"), isSidebarVisible: false },
            });
        } else {
            setMode("edit");
        }
    }, [createWindow, metaKeyPressedRef, setMode]);
    const onClickDelete = useCallback(() => {
        (async () => {
            if (isClusterLocked) {
                showDialog({
                    title: "Read-only mode",
                    type: "error",
                    message: "This cluster is in read-only mode.",
                    detail: "You can delete after you unlock the cluster with the lock/unlock button in the toolbar.",
                    buttons: ["OK"],
                });
                return;
            }
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
                    editors.filter((e) => !isEditorForResource(e, object))
                );
            }
        })();
    }, [
        appEditorStore,
        client,
        isClusterLocked,
        object,
        setIsDeleting,
        showDialog,
    ]);
    const onClickShell = useCallback(
        (containerName: string) => {
            if (isClusterLocked) {
                showDialog({
                    title: "Read-only mode",
                    type: "error",
                    message: "This cluster is in read-only mode.",
                    detail: "You can only open a shell after you unlock the cluster with the lock/unlock button in the toolbar.",
                    buttons: ["OK"],
                });
                return;
            }
            openEditor(shellEditor(object, containerName));
        },
        [isClusterLocked, openEditor, object]
    );
    const onClickLogs = useCallback(
        (containerName: string) => {
            openEditor(logsEditor(object, containerName));
        },
        [openEditor, object]
    );

    const isLoggable = object?.apiVersion === "v1" && object.kind === "Pod";
    const isShellable = object?.apiVersion === "v1" && object.kind === "Pod";

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
                    {isShellable && (
                        <ShellButton
                            object={object}
                            isDisabled={isDeleting}
                            onClick={onClickShell}
                        />
                    )}
                    {isLoggable && (
                        <LogsButton
                            object={object}
                            isDisabled={isDeleting}
                            onClick={onClickLogs}
                        />
                    )}
                    <PortForwardingMenu object={object} />
                    <Box flex="1 0 0"></Box>
                    <ShowDetailsToggle
                        value={showDetails}
                        onChange={setShowDetails}
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
                        onChangeExpandedItems={setExpandedItems}
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

const ShellButton: React.FC<{
    object: K8sObject;
    isDisabled?: boolean;
    onClick?: (containerName: string) => void;
}> = (props) => {
    const { object, onClick, isDisabled = false } = props;

    const containers = useMemo(
        () =>
            (object as any).spec?.containers?.map((container) => ({
                name: container.name,
                onClick: () => {
                    onClick(container.name);
                },
            })) ?? [],
        [object, onClick]
    );

    if (containers.length === 1) {
        return (
            <IconButton
                colorScheme="primary"
                icon={<Icon as={FiTerminal} />}
                aria-label="Shell"
                title="Shell"
                fontWeight="normal"
                isDisabled={isDisabled}
                onClick={containers[0].onClick}
            />
        );
    } else {
        return (
            <Menu>
                <MenuButton
                    colorScheme="primary"
                    as={IconButton}
                    icon={<Icon as={FiTerminal} />}
                    aria-label="Shell"
                    title="Shell"
                    fontWeight="normal"
                    isDisabled={isDisabled}
                />
                <MenuList>
                    {containers.map((container) => (
                        <MenuItem
                            key={container.name}
                            onClick={container.onClick}
                        >
                            {container.name}
                        </MenuItem>
                    ))}
                </MenuList>
            </Menu>
        );
    }
};

const LogsButton: React.FC<{
    object: K8sObject;
    isDisabled?: boolean;
    onClick?: (containerName: string) => void;
}> = (props) => {
    const { object, onClick, isDisabled = false } = props;

    const containers = useMemo(
        () =>
            (object as any).spec?.containers?.map((container) => ({
                name: container.name,
                onClick: () => {
                    onClick(container.name);
                },
            })) ?? [],
        [object, onClick]
    );

    if (containers.length === 1) {
        return (
            <IconButton
                colorScheme="primary"
                icon={<Icon as={RiTextWrap} />}
                aria-label="Logs"
                title="Logs"
                fontWeight="normal"
                isDisabled={isDisabled}
                onClick={containers[0].onClick}
            />
        );
    } else {
        return (
            <Menu>
                <MenuButton
                    colorScheme="primary"
                    as={IconButton}
                    icon={<Icon as={RiTextWrap} />}
                    aria-label="Logs"
                    title="Logs"
                    fontWeight="normal"
                    isDisabled={isDisabled}
                />
                <MenuList>
                    {containers.map((container) => (
                        <MenuItem
                            key={container.name}
                            onClick={container.onClick}
                        >
                            {container.name}
                        </MenuItem>
                    ))}
                </MenuList>
            </Menu>
        );
    }
};

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
};

export const NewResourceEditor: React.FC<NewResourceEditorProps> = (props) => {
    const { editorId, resourceType } = props;

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
            const createdResourceEditor = resourceEditor(object);
            setAppRoute((route) => {
                if (route.activeEditor?.id === editorId) {
                    return { ...route, activeEditor: createdResourceEditor };
                }
                return route;
            });
            editorsStore.set((editors) =>
                editors.filter((e) => e.id !== editorId)
            );
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
                    />
                )}
            </VStack>
        </VStack>
    );
};

const PortForwardingMenu: React.FC<{ object: K8sObject }> = (props) => {
    const { object } = props;
    if (!object || object.apiVersion !== "v1" || object.kind !== "Pod") {
        return null;
    }

    const client = useK8sClient();
    const showDialog = useDialog();
    const isContextLocked = useContextLock();

    const [loading, forwards, forwardsError] = useK8sPortForwardsWatch();

    const availablePorts = useMemo(() => {
        const ports: Array<{
            id: string;
            port: number;
            name: string;
            portForward: K8sPortForwardEntry | undefined;
            forwardable: boolean;
        }> = [];
        const containers = (object as any).spec?.containers;
        if (containers) {
            for (const container of containers) {
                if (container?.ports) {
                    for (const port of container.ports) {
                        if (!port) {
                            continue;
                        }
                        const forwardable =
                            !port.protocol || port.protocol === "TCP";
                        ports.push({
                            id: String(port.containerPort),
                            port: port.containerPort,
                            name: port.name ?? String(port.containerPort),
                            portForward: forwards.find(
                                (fwd) =>
                                    fwd.spec.namespace ===
                                        object.metadata.namespace &&
                                    fwd.spec.podName === object.metadata.name &&
                                    fwd.spec.podPort === port.containerPort
                            ),
                            forwardable,
                        });
                    }
                }
            }
        }
        return ports;
    }, [forwards, object]);

    const addForward = useCallback(
        (
            podPort: number,
            localPort: number | undefined,
            localOnly: boolean
        ) => {
            (async () => {
                if (isContextLocked) {
                    showDialog({
                        title: "Read-only mode",
                        type: "error",
                        message: "This cluster is in read-only mode.",
                        detail: "You can only port forward after you unlock the cluster with the lock/unlock button in the toolbar.",
                        buttons: ["OK"],
                    });
                    return;
                }
                try {
                    await client.portForward({
                        podName: object.metadata.name,
                        namespace: object.metadata.namespace as string,
                        localOnly,
                        podPort,
                        ...(localPort !== undefined ? { localPort } : {}),
                    });
                } catch (e) {
                    console.error("Error port forwarding", e);
                }
            })();
        },
        [client, isContextLocked, object, showDialog]
    );

    const stopForward = useCallback(
        (id: string) => {
            (async () => {
                if (isContextLocked) {
                    showDialog({
                        title: "Read-only mode",
                        type: "error",
                        message: "This cluster is in read-only mode.",
                        detail: "You can only stop this port forward after you unlock the cluster with the lock/unlock button in the toolbar.",
                        buttons: ["OK"],
                    });
                    return;
                }
                try {
                    await client.stopPortForward(id);
                } catch (e) {
                    console.error("Error stopping port forwarding", e);
                }
            })();
        },
        [client, isContextLocked, showDialog]
    );

    const onAddHandlers = useMemo(
        () =>
            Object.fromEntries(
                availablePorts.map((port) => [
                    port.id,
                    (localPort: number | undefined, localOnly: boolean) => {
                        addForward(port.port, localPort, localOnly);
                    },
                ])
            ),
        [addForward, availablePorts]
    );

    const onStopHandlers = useMemo(
        () =>
            Object.fromEntries(
                forwards.map((fwd) => [
                    fwd.id,
                    () => {
                        stopForward(fwd.id);
                    },
                ])
            ),
        [forwards, stopForward]
    );

    return (
        <Popover>
            <PopoverTrigger>
                <IconButton
                    colorScheme="primary"
                    icon={<Icon as={MdCastConnected} />}
                    aria-label="Port forwarding"
                    title="Port forwarding"
                    fontWeight="normal"
                />
            </PopoverTrigger>
            <PopoverContent>
                <PopoverArrow />
                <PopoverCloseButton />
                <PopoverBody>
                    {loading && <Spinner />}
                    {!loading && (
                        <Table
                            size="sm"
                            sx={{ tableLayout: "fixed" }}
                            width="100%"
                        >
                            <Thead>
                                <Tr>
                                    <Th>Pod port</Th>
                                    <Th>Local port</Th>
                                    <Th width="30px"></Th>
                                </Tr>
                            </Thead>
                            <Tbody>
                                {availablePorts.map((port) => (
                                    <PortForwardingRow
                                        portForward={port.portForward}
                                        podPort={port.port}
                                        podPortName={port.name}
                                        isForwardable={port.forwardable}
                                        onAdd={onAddHandlers[port.id]}
                                        onStop={
                                            port.portForward
                                                ? onStopHandlers[
                                                      port.portForward?.id
                                                  ]
                                                : undefined
                                        }
                                        key={port.id}
                                    />
                                ))}
                            </Tbody>
                        </Table>
                    )}
                </PopoverBody>
            </PopoverContent>
        </Popover>
    );
};

type PortForwardingRowProps = {
    portForward: K8sPortForwardEntry | undefined;
    podPort: number;
    podPortName: string;
    isForwardable: boolean;
    onAdd?: (localPort: number | undefined, localOnly: boolean) => void;
    onStop?: () => void;
};
const PortForwardingRow: React.FC<PortForwardingRowProps> = (props) => {
    const { portForward, podPort, podPortName, isForwardable, onAdd, onStop } =
        props;

    const [localPortString, setLocalPortString] = useState("");

    const onClickAdd = useCallback(() => {
        // TODO: localOnly UI
        onAdd?.(
            localPortString === "" ? undefined : parseInt(localPortString, 10),
            true
        );
    }, [onAdd, localPortString]);

    const onClickStop = useCallback(() => {
        onStop?.();
    }, [onStop]);

    const onChangeLocalPort = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            setLocalPortString(e.target.value);
        },
        [setLocalPortString]
    );

    const onInputKeyPress = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === "Enter" || e.key === "Return") {
                onClickAdd();
            }
        },
        [onClickAdd]
    );

    return (
        <Tr>
            <Td>
                {podPort}
                {String(podPort) !== podPortName && ` (${podPortName})`}
            </Td>
            <Td>
                <Input
                    placeholder="auto"
                    type="number"
                    isDisabled={!!portForward}
                    value={
                        portForward
                            ? String(portForward.localPort)
                            : localPortString
                    }
                    onKeyDown={onInputKeyPress}
                    onChange={onChangeLocalPort}
                />
            </Td>
            <Td px={0}>
                {!portForward && isForwardable && (
                    <IconButton
                        colorScheme="primary"
                        size="sm"
                        icon={<Icon as={AddIcon} />}
                        aria-label="Forward"
                        title="Forward"
                        onClick={onClickAdd}
                    />
                )}
                {portForward && (
                    <IconButton
                        colorScheme="primary"
                        size="sm"
                        icon={<Icon as={DeleteIcon} />}
                        aria-label="Stop"
                        title="Stop"
                        onClick={onClickStop}
                    />
                )}
            </Td>
        </Tr>
    );
};
