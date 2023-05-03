import {
    AddIcon,
    ArrowUpDownIcon,
    DeleteIcon,
    EditIcon,
} from "@chakra-ui/icons";
import { CgDetailsLess, CgDetailsMore } from "react-icons/cg";
import { MdOutlinePause, MdPlayArrow } from "react-icons/md";
import {
    Box,
    Button,
    ButtonGroup,
    FormControl,
    FormLabel,
    Heading,
    HStack,
    Icon,
    IconButton,
    Input,
    Link,
    NumberDecrementStepper,
    NumberIncrementStepper,
    NumberInput,
    NumberInputField,
    NumberInputStepper,
    Popover,
    PopoverArrow,
    PopoverBody,
    PopoverCloseButton,
    PopoverContent,
    PopoverFooter,
    PopoverHeader,
    PopoverTrigger,
    Portal,
    Select,
    Spinner,
    Table,
    Tbody,
    Td,
    Text,
    Th,
    Thead,
    Tr,
    useBreakpointValue,
    useColorModeValue,
    useConst,
    useDisclosure,
    VStack,
} from "@chakra-ui/react";
import React, {
    ChangeEvent,
    KeyboardEvent,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import {
    K8sObject,
    K8sObjectIdentifier,
    K8sPortForwardEntry,
    K8sPortForwardSpec,
    K8sPortForwardStats,
    K8sResourceTypeIdentifier,
} from "../../../common/k8s/client";
import {
    K8sObjectHeading,
    K8sObjectViewer,
    K8sResourceDisplayRule,
} from "../../component/k8s/K8sObjectViewer";
import { ScrollBox } from "../../component/main/ScrollBox";
import { Toolbar } from "../../component/main/Toolbar";
import { useContextLockHelpers } from "../../context/context-lock";
import { resourceEditor, useAppEditorsStore } from "../../context/editors";
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
import { useEditorLink } from "../../hook/editor-link";
import { useK8sPortForwardsWatch } from "../../k8s/port-forward-watch";
import {
    PortForwardStats,
    usePeriodStats,
} from "../../component/k8s/PortForwardStats";
import {
    K8sAssociatedPodsStoreValue,
    useK8sAssociatedPodsStore,
} from "../../k8s/associated-pods";
import { generateBadges, ResourceBadge } from "../../k8s/badges";
import { isSetLike } from "../../../common/k8s/util";
import {
    ContextMenuButton,
    MenuItem as ContextMenuItem,
} from "../../component/main/ContextMenuButton";
import { useContextMenu } from "../../hook/context-menu";
import { ContextMenuTemplate } from "../../../common/contextmenu";
import { ResourceActionButtons } from "../resources/ResourceActionButtons";
import { ReadableStore, useProvidedStoreValue } from "../../util/state";
import { ResourcesTable } from "../resources/ResourcesTable";
import { generateResourceDetails } from "../../k8s/details";

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

    const [isLoadingObjects, objects] = useK8sListWatch(
        {
            apiVersion: editorResource.apiVersion,
            kind: editorResource.kind,
            ...(editorResource.namespace
                ? { namespaces: [editorResource.namespace] }
                : {}),
            fieldSelector: [
                { name: "metadata.name", value: editorResource.name },
            ],
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

    const [showDetails, setShowDetails] = useState(false);
    const [mode, setMode] = useAppParam<"view" | "edit">("editorMode", "view");

    const isDeleting = Boolean((object as any)?.metadata?.deletionTimestamp);

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

    const isScalable =
        object && isSetLike(object) && object.kind !== "DaemonSet";

    const badges: ResourceBadge[] = useMemo(
        () => (object ? generateBadges(object) : []),
        [object]
    );

    const resourceArray = useMemo(() => (object ? [object] : []), [object]);
    const omitActions = useConst(["edit"]);

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
            attachedToolbar={
                <Toolbar>
                    <Button
                        leftIcon={<EditIcon />}
                        onClick={onClickEdit}
                        isDisabled={isDeleting}
                    >
                        Edit
                    </Button>
                    <ResourceActionButtons
                        resources={resourceArray}
                        omitActions={omitActions}
                    />
                    {isScalable && (
                        <ScaleButton object={object} isDisabled={isDeleting} />
                    )}
                    <ShowDetailsToggle
                        value={showDetails}
                        onChange={setShowDetails}
                    />
                </Toolbar>
            }
        >
            <VStack spacing={4} alignItems="stretch">
                <HStack alignItems="baseline">
                    <K8sObjectHeading
                        kind={kind}
                        apiVersion={apiVersion}
                        metadata={metadata}
                        object={object}
                        badges={badges}
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
                {object && <K8sObjectBoxes object={object} />}
                {object && <PortForwardingMenu object={object} />}
                {object && <AssociatedPods object={object} />}
            </VStack>
        </ScrollBox>
    );
});

const ScaleButton: React.FC<{
    object: K8sObject;
    isDisabled?: boolean;
}> = (props) => {
    const { object, isDisabled = false } = props;

    const { isOpen, onOpen, onClose } = useDisclosure();

    useEffect(() => {
        onClose();
    }, [object.apiVersion, object.kind, object.metadata.name, onClose]);

    return (
        <Popover isOpen={isOpen} onOpen={onOpen} onClose={onClose} isLazy>
            <PopoverTrigger>
                <IconButton
                    icon={<ArrowUpDownIcon />}
                    aria-label="Scale"
                    title="Scale"
                    fontWeight="normal"
                    isDisabled={isDisabled}
                />
            </PopoverTrigger>
            <Portal>
                <PopoverContent>
                    <ScalePopoverContent object={object} onClose={onClose} />
                </PopoverContent>
            </Portal>
        </Popover>
    );
};

const ScalePopoverContent: React.FC<{
    object: K8sObject;
    onClose: () => void;
}> = (props) => {
    const { object, onClose } = props;

    const client = useK8sClient();
    const showDialog = useDialog();

    const [isLoadingHpas, hpas] = useK8sListWatch(
        {
            apiVersion: "autoscaling/v2beta2",
            kind: "HorizontalPodAutoscaler",
            namespaces: object.metadata.namespace
                ? [object.metadata.namespace]
                : [],
        },
        {},
        [object.metadata.namespace]
    );

    const { openEditor: openHpaEditor } = useEditorLink(
        hpas?.items?.[0] ?? object
    );

    const { checkContextLock } = useContextLockHelpers();

    const isAutoScaled = hpas?.items && hpas.items.length > 0;
    const currentScale = (object as any)?.spec?.replicas ?? 0;
    const pausedScaleNumber: number | undefined = useMemo(() => {
        if (
            !(object as any)?.metadata?.annotations?.[
                "irisapp.dev/original-replicas"
            ]
        ) {
            return undefined;
        }
        const pausedScale = parseInt(
            (object as any).metadata.annotations[
                "irisapp.dev/original-replicas"
            ],
            10
        );
        return pausedScale > 0 && !isNaN(pausedScale) ? pausedScale : undefined;
    }, [object]);

    const [targetScale, setTargetScale] = useState<number | undefined>();
    useEffect(() => {
        setTargetScale(undefined);
    }, [object.apiVersion, object.kind, object.metadata.name, setTargetScale]);

    const onChangeTargetScale = useCallback(
        (_, value) => {
            setTargetScale(value);
        },
        [setTargetScale]
    );

    const onClickOpenHpa = useCallback(() => {
        if (isAutoScaled) {
            openHpaEditor();
            onClose();
        }
    }, [isAutoScaled, onClose, openHpaEditor]);

    const scale = useCallback(
        async (
            targetScale: number,
            annotations: Record<string, string | null> = {}
        ) => {
            if (!(await checkContextLock())) {
                return;
            }
            if (targetScale === 0) {
                const result = await showDialog({
                    title: "Are you sure?",
                    type: "question",
                    message: `Are you sure you want to scale ${object.metadata.name} down to zero?`,
                    detail: "This will effectively switch it off and make it unavailable.",
                    buttons: ["Yes", "No"],
                });
                if (result.response === 1) {
                    return;
                }
            }
            try {
                const newAnnotations = {
                    ...object.metadata.annotations,
                    ...annotations,
                };
                for (const [k, v] of Object.entries(annotations)) {
                    if (v === null) {
                        delete newAnnotations[k];
                    }
                }
                await client.apply({
                    ...object,
                    metadata: {
                        ...object.metadata,
                        annotations: newAnnotations,
                    },
                    spec: {
                        ...(object as any).spec,
                        replicas: targetScale,
                    },
                } as K8sObject);
            } catch (e: any) {
                console.error("Error while scaling", { object, e });
                showDialog({
                    title: "Error while scaling",
                    type: "error",
                    message: "An error occurred while applying the new scale:",
                    detail: e.message,
                    buttons: ["OK"],
                });
            }
        },
        [checkContextLock, client, object, showDialog, targetScale]
    );

    const [isScaling, setIsScaling] = useState(false);
    const onClickScale = useCallback(async () => {
        if (targetScale === undefined) {
            return;
        }
        setIsScaling(true);
        await scale(targetScale, {
            "irisapp.dev/original-replicas": null,
        });
        setIsScaling(false);
    }, [scale, setIsScaling, targetScale]);

    const [isPausing, setIsPausing] = useState(false);
    const onClickPause = useCallback(async () => {
        if (currentScale === 0) {
            return;
        }
        setIsPausing(true);
        await scale(0, {
            "irisapp.dev/original-replicas": String(currentScale),
        });
        setIsPausing(false);
    }, [scale, currentScale, setIsPausing]);

    const [isResuming, setIsResuming] = useState(false);
    const onClickResume = useCallback(async () => {
        const targetScale = pausedScaleNumber ?? 1;
        setIsResuming(true);
        await scale(targetScale, {
            "irisapp.dev/original-replicas": null,
        });
        setIsResuming(false);
    }, [pausedScaleNumber, scale, setIsResuming]);

    const onKeyDownTargetScale = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === "Enter" || e.key === "Return") {
                onClickScale();
            }
        },
        [onClickScale]
    );

    return (
        <>
            <PopoverArrow />
            <PopoverCloseButton />
            <PopoverHeader>
                <Heading size="sm">Scale</Heading>
            </PopoverHeader>
            <PopoverBody>
                <VStack alignItems="stretch">
                    {isAutoScaled && (
                        <Text>Managed by Horizontal Pod Autoscaler.</Text>
                    )}
                    {!isAutoScaled && (
                        <>
                            <Text fontWeight="normal" fontSize="sm">
                                Current scale: {currentScale}{" "}
                                {currentScale === 0 &&
                                    pausedScaleNumber !== undefined &&
                                    ` (was: ${pausedScaleNumber})`}
                            </Text>
                            <FormControl>
                                <FormLabel fontSize="sm" htmlFor="targetScale">
                                    Target scale
                                </FormLabel>
                                <NumberInput
                                    id="targetScale"
                                    size="sm"
                                    step={1}
                                    min={0}
                                    value={targetScale ?? currentScale}
                                    onChange={onChangeTargetScale}
                                    onKeyDown={onKeyDownTargetScale}
                                >
                                    <NumberInputField />
                                    <NumberInputStepper>
                                        <NumberIncrementStepper />
                                        <NumberDecrementStepper />
                                    </NumberInputStepper>
                                </NumberInput>
                            </FormControl>
                        </>
                    )}
                </VStack>
            </PopoverBody>
            <PopoverFooter>
                <ButtonGroup
                    w="100%"
                    variant="toolbar"
                    size="sm"
                    justifyContent="end"
                    spacing={0.5}
                >
                    <Button onClick={onClose}>Cancel</Button>
                    {!isLoadingHpas && !isAutoScaled && currentScale > 0 && (
                        <Button
                            onClick={onClickPause}
                            isLoading={isPausing}
                            leftIcon={<Icon as={MdOutlinePause} />}
                        >
                            Pause
                        </Button>
                    )}
                    {!isLoadingHpas && !isAutoScaled && currentScale === 0 && (
                        <Button
                            onClick={onClickResume}
                            isLoading={isResuming}
                            leftIcon={<Icon as={MdPlayArrow} />}
                        >
                            Resume
                        </Button>
                    )}
                    {!isLoadingHpas && !isAutoScaled && (
                        <Button
                            isDisabled={
                                targetScale === undefined ||
                                currentScale === targetScale
                            }
                            onClick={onClickScale}
                            isLoading={isScaling}
                        >
                            Scale
                        </Button>
                    )}
                    {isAutoScaled && (
                        <Button onClick={onClickOpenHpa}>Open HPA</Button>
                    )}
                </ButtonGroup>
            </PopoverFooter>
        </>
    );
};

const ShowDetailsToggle: React.FC<{
    value: boolean;
    onChange: (showDetails: boolean) => void;
}> = (props) => {
    const { value, onChange } = props;

    const viewMode = value ? "detailed" : "simple";
    const onMenuAction = useCallback(
        ({ actionId }: { actionId: string }) => {
            onChange(actionId === "detailed");
        },
        [onChange]
    );

    return (
        <ContextMenuButton
            px={1}
            as={IconButton}
            aria-label="View mode"
            title="View mode"
            onMenuAction={onMenuAction}
            icon={<Icon as={value ? CgDetailsMore : CgDetailsLess} />}
        >
            <ContextMenuItem
                label="Simple"
                actionId="simple"
                type="radio"
                checked={viewMode === "simple"}
            />
            <ContextMenuItem
                label="Detailed"
                actionId="detailed"
                type="radio"
                checked={viewMode === "detailed"}
            />
        </ContextMenuButton>
    );
};

export type NewResourceEditorProps = {
    editorId: string;
    resourceType?: K8sResourceTypeIdentifier;
};

export const NewResourceEditor: React.FC<NewResourceEditorProps> = (props) => {
    const { editorId, resourceType } = props;

    const [selectedResourceType, setSelectedResourceType] =
        useState<K8sResourceTypeIdentifier | null>(resourceType ?? null);

    const namespaces = useK8sNamespaces();
    const namespacesConst = useConst(namespaces);

    const [, resourceTypes] = useK8sApiResourceTypes();
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

    const object: K8sObject | null = useMemo(
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

    const bg = useColorModeValue("white", "gray.900");

    return (
        <VStack w="100%" h="100%" spacing={0} alignItems="stretch" bg={bg}>
            <Box px={4} py={2} flex="0 0 auto">
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

const AssociatedPods: React.FC<{ object: K8sObject }> = (props) => {
    const { object } = props;

    const store = useK8sAssociatedPodsStore(object);
    return <AssociatedPodsInner store={store} />;
};

const AssociatedPodsInner: React.FC<{
    store: ReadableStore<K8sAssociatedPodsStoreValue>;
}> = React.memo((props) => {
    const { store } = props;
    const hasAssociatedPods = useProvidedStoreValue(
        store,
        (v) => v.hasAssociatedPods
    );
    if (!hasAssociatedPods) {
        return null;
    }
    return (
        <>
            <Heading size="sm">Pods</Heading>
            <Box mx={-4}>
                <ResourcesTable
                    showNamespace={false}
                    showSelect={false}
                    resourcesStore={store}
                />
            </Box>
        </>
    );
});

const K8sObjectBoxes: React.FC<{ object: K8sObject }> = (props) => {
    const { object } = props;

    const { kind, apiVersion } = object;
    const details = useMemo(() => {
        const details = generateResourceDetails({ apiVersion, kind }).filter(
            (d) => d.style === "box"
        );
        details.sort((a, b) => (a.importance ?? 0) - (b.importance ?? 0));
        return details;
    }, [apiVersion, kind]);

    if (details.length === 0) {
        return null;
    }
    return (
        <VStack alignItems="stretch">
            {details.map((detail) => {
                const value = detail.valueFor(object);
                if (!value) {
                    return;
                }
                return (
                    <VStack alignItems="stretch" key={detail.id}>
                        <Heading size="sm">{detail.header}</Heading>
                        {value}
                    </VStack>
                );
            })}
        </VStack>
    );
};

const remoteTypes: Record<string, string> = {
    "v1:Pod": "pod",
    "v1:Service": "service",
    "apps/v1:Deployment": "deployment",
    "apps/v1:StatefulSet": "statefulset",
};

const PortForwardingMenu: React.FC<{ object: K8sObject }> = (props) => {
    const { object } = props;
    if (!object) {
        return null;
    }

    const remoteType = remoteTypes[
        `${object.apiVersion}:${object.kind}`
    ] as K8sPortForwardSpec["remoteType"];
    if (!remoteType) {
        return null;
    }

    const client = useK8sClient();
    const showDialog = useDialog();
    const { checkContextLock } = useContextLockHelpers();

    const [stats, setStats] = useState<Record<string, K8sPortForwardStats>>({});

    const [loading, forwards] = useK8sPortForwardsWatch(
        {
            onStats(stats) {
                setStats(stats);
            },
        },
        [setStats]
    );

    const availablePorts = useMemo(() => {
        const ports: Array<{
            id: string;
            port: number;
            name: string;
            portForward: K8sPortForwardEntry | undefined;
            forwardable: boolean;
        }> = [];
        if (object.kind === "Pod") {
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
                                id: String(
                                    port.containerPort + ":" + port.protocol
                                ),
                                port: port.containerPort,
                                name: port.name ?? String(port.containerPort),
                                portForward: forwards.find(
                                    (fwd) =>
                                        fwd.spec.namespace ===
                                            object.metadata.namespace &&
                                        fwd.spec.remoteType === remoteType &&
                                        fwd.spec.remoteName ===
                                            object.metadata.name &&
                                        fwd.spec.remotePort ===
                                            port.containerPort &&
                                        forwardable
                                ),
                                forwardable,
                            });
                        }
                    }
                }
            }
        } else if (object.kind === "Service") {
            for (const port of (object as any).spec?.ports ?? []) {
                const forwardable = !port.protocol || port.protocol === "TCP";
                ports.push({
                    id: String(port.port + ":" + port.protocol),
                    port: port.port,
                    name: port.name ?? String(port.port),
                    portForward: forwards.find(
                        (fwd) =>
                            fwd.spec.namespace === object.metadata.namespace &&
                            fwd.spec.remoteType === remoteType &&
                            fwd.spec.remoteName === object.metadata.name &&
                            fwd.spec.remotePort === port.port &&
                            forwardable
                    ),
                    forwardable,
                });
            }
        } else if (
            object.kind === "Deployment" ||
            object.kind === "StatefulSet"
        ) {
            const containers = (object as any).spec?.template?.spec?.containers;
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
                                id: String(
                                    port.containerPort + ":" + port.protocol
                                ),
                                port: port.containerPort,
                                name: port.name ?? String(port.containerPort),
                                portForward: forwards.find(
                                    (fwd) =>
                                        fwd.spec.namespace ===
                                            object.metadata.namespace &&
                                        fwd.spec.remoteType === remoteType &&
                                        fwd.spec.remoteName ===
                                            object.metadata.name &&
                                        fwd.spec.remotePort ===
                                            port.containerPort &&
                                        forwardable
                                ),
                                forwardable,
                            });
                        }
                    }
                }
            }
        }
        return ports;
    }, [forwards, object, remoteType]);

    const addForward = useCallback(
        (
            remotePort: number,
            localPort: number | undefined,
            localOnly: boolean
        ) => {
            (async () => {
                if (!(await checkContextLock())) {
                    return;
                }
                try {
                    await client.portForward({
                        remoteType,
                        remoteName: object.metadata.name,
                        namespace: object.metadata.namespace as string,
                        localOnly,
                        remotePort,
                        ...(localPort !== undefined ? { localPort } : {}),
                    });
                } catch (e: any) {
                    console.error("Error port forwarding", e);
                    showDialog({
                        title: "Error forwarding port",
                        type: "error",
                        message:
                            "An error occurred while starting port forwarding.",
                        detail: e.message,
                        buttons: ["OK"],
                    });
                }
            })();
        },
        [client, checkContextLock, object, remoteType, showDialog]
    );

    const stopForward = useCallback(
        (id: string) => {
            (async () => {
                if (!(await checkContextLock())) {
                    return;
                }
                try {
                    await client.stopPortForward(id);
                } catch (e) {
                    console.error("Error stopping port forwarding", e);
                }
            })();
        },
        [client, checkContextLock, showDialog]
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

    const showStats = useBreakpointValue({ base: false, lg: true });

    return (
        <VStack alignItems="stretch">
            <Heading size="sm">Port forwarding</Heading>
            {loading && <Spinner />}
            {!loading && availablePorts.length === 0 && (
                <Text fontSize="sm" color="gray">
                    {object.kind} exposes no ports.
                </Text>
            )}
            {!loading && availablePorts.length > 0 && (
                <Table size="sm" sx={{ tableLayout: "fixed" }} width="100%">
                    <Thead>
                        <Tr>
                            <Th whiteSpace="nowrap" ps={0} width="120px">
                                Pod port
                            </Th>
                            <Th whiteSpace="nowrap" width="120px">
                                Local port
                            </Th>
                            <Th whiteSpace="nowrap" width="120px">
                                Mode
                            </Th>
                            <Th width="30px"></Th>
                            <Th>{showStats && "Stats"}</Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {availablePorts.map((port) => (
                            <PortForwardingRow
                                portForward={port.portForward}
                                podPort={port.port}
                                podPortName={port.name}
                                isForwardable={port.forwardable}
                                allStats={stats}
                                showStats={showStats}
                                onAdd={onAddHandlers[port.id]}
                                onStop={
                                    port.portForward
                                        ? onStopHandlers[port.portForward?.id]
                                        : undefined
                                }
                                key={port.id}
                            />
                        ))}
                    </Tbody>
                </Table>
            )}
        </VStack>
    );
};

type PortForwardingRowProps = {
    portForward: K8sPortForwardEntry | undefined;
    podPort: number;
    podPortName: string;
    isForwardable: boolean;
    onAdd?: (localPort: number | undefined, localOnly: boolean) => void;
    onStop?: () => void;
    showStats?: boolean;
    allStats?: Record<string, K8sPortForwardStats>;
};
const PortForwardingRow: React.FC<PortForwardingRowProps> = (props) => {
    const {
        portForward,
        podPort,
        podPortName,
        isForwardable,
        onAdd,
        onStop,
        allStats,
        showStats,
    } = props;

    const stats = portForward ? allStats?.[portForward.id] : null;
    const periodStats = usePeriodStats(stats);

    const [localPortString, setLocalPortString] = useState("");
    const [modeString, setModeString] = useState("localOnly");

    const openInBrowser = useIpcCall((ipc) => ipc.app.openUrlInBrowser);

    const onClickAdd = useCallback(() => {
        onAdd?.(
            localPortString === "" ? undefined : parseInt(localPortString, 10),
            modeString !== "shared"
        );
    }, [onAdd, localPortString, modeString]);

    useEffect(() => {
        if (portForward) {
            setLocalPortString(String(portForward.localPort));
            setModeString(portForward.spec.localOnly ? "localOnly" : "shared");
        }
    }, [portForward, setLocalPortString, setModeString]);

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

    const onChangeMode = useCallback(
        (e: ChangeEvent<HTMLSelectElement>) => {
            setModeString(e.target.value);
        },
        [setModeString]
    );

    const portForwardHostPort = useMemo(
        () => (portForward ? `localhost:${portForward.localPort}` : null),
        [portForward]
    );
    const portForwardUrl = useMemo(() => {
        if (!portForward) {
            return null;
        }
        const looksLikeSecureLink = portForward.spec.remotePort % 1000 === 443;
        const guessedProtocol = looksLikeSecureLink ? "https" : "http";
        return `${guessedProtocol}://localhost:${portForward.localPort}`;
    }, [portForwardHostPort]);

    const openLocalPortInBrowser = useCallback(() => {
        if (portForwardUrl) {
            openInBrowser({ url: portForwardUrl });
        }
    }, [openInBrowser, portForwardUrl]);

    const onClickLocalPort = useCallback(() => {
        openLocalPortInBrowser();
    }, [openLocalPortInBrowser]);

    const contextMenuTemplate: ContextMenuTemplate = useMemo(
        () =>
            portForward
                ? [
                      { label: "Open in Browser", actionId: "openInBrowser" },
                      { type: "separator" },
                      { label: "Copy host:port", actionId: "copyHostPort" },
                      { label: "Copy URL", actionId: "copyUrl" },
                      { type: "separator" },
                      { label: "Stop", actionId: "stop" },
                  ]
                : [],
        [portForward]
    );
    const onContextMenuAction = useCallback(
        ({ actionId }: { actionId: string }) => {
            if (!portForward) {
                return;
            }
            switch (actionId) {
                case "openInBrowser":
                    openLocalPortInBrowser();
                    break;
                case "copyHostPort":
                    if (portForwardHostPort) {
                        navigator.clipboard.writeText(portForwardHostPort);
                    }
                    break;
                case "copyUrl":
                    if (portForwardUrl) {
                        navigator.clipboard.writeText(portForwardUrl);
                    }
                    break;
                case "stop":
                    onClickStop();
                    break;
            }
        },
        [
            onClickStop,
            openLocalPortInBrowser,
            portForwardHostPort,
            portForwardUrl,
        ]
    );
    const onContextMenu = useContextMenu(contextMenuTemplate, {
        onMenuAction: onContextMenuAction,
    });

    return (
        <>
            <Tr onContextMenu={onContextMenu}>
                <Td ps={0} whiteSpace="nowrap">
                    <HStack>
                        {portForward && (
                            <Box
                                w="10px"
                                h="10px"
                                borderRadius="full"
                                bg="green"
                                flex="0 0 auto"
                            />
                        )}
                        <Text>
                            {podPort}
                            {String(podPort) !== podPortName &&
                                ` (${podPortName})`}
                        </Text>
                    </HStack>
                </Td>
                <Td whiteSpace="nowrap">
                    {portForward && (
                        <Link
                            size="xs"
                            textDecoration="underline"
                            onClick={onClickLocalPort}
                            ps={2}
                        >
                            {localPortString}
                        </Link>
                    )}
                    {!portForward && (
                        <Input
                            placeholder="auto"
                            size="sm"
                            type="number"
                            value={localPortString}
                            onKeyDown={onInputKeyPress}
                            onChange={onChangeLocalPort}
                        />
                    )}
                </Td>
                <Td whiteSpace="nowrap">
                    <Select
                        size="sm"
                        isDisabled={!!portForward}
                        value={modeString}
                        onChange={onChangeMode}
                    >
                        <option value="localOnly">Local</option>
                        <option value="shared">Shared</option>
                    </Select>
                </Td>
                <Td px={0} whiteSpace="nowrap">
                    {!portForward && isForwardable && (
                        <IconButton
                            size="xs"
                            icon={<Icon as={AddIcon} />}
                            aria-label="Forward"
                            title="Forward"
                            onClick={onClickAdd}
                        />
                    )}
                    {portForward && (
                        <IconButton
                            size="xs"
                            icon={<Icon as={DeleteIcon} />}
                            aria-label="Stop"
                            title="Stop"
                            onClick={onClickStop}
                        />
                    )}
                </Td>
                <Td>
                    {showStats && periodStats && (
                        <PortForwardStats stats={periodStats} />
                    )}
                </Td>
            </Tr>
        </>
    );
};
