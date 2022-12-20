import {
    AddIcon,
    ArrowUpDownIcon,
    DeleteIcon,
    EditIcon,
    RepeatIcon,
} from "@chakra-ui/icons";
import { CgDetailsLess, CgDetailsMore } from "react-icons/cg";
import { FiTerminal } from "react-icons/fi";
import { RiTextWrap } from "react-icons/ri";
import { MdOutlinePause, MdPlayArrow } from "react-icons/md";
import {
    Badge,
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
import {
    resourceEditor,
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
import { useEditorLink, useEditorOpener } from "../../hook/editor-link";
import { useK8sPortForwardsWatch } from "../../k8s/port-forward-watch";
import {
    PortForwardStats,
    usePeriodStats,
} from "../../component/k8s/PortForwardStats";
import { useK8sAssociatedPods } from "../../k8s/associated-pods";
import { Selectable } from "../../component/main/Selectable";
import { ResourceEditorLink } from "../resources/ResourceEditorLink";
import { generateBadges, ResourceBadge } from "../../k8s/badges";
import { formatDeveloperDateTime } from "../../util/date";
import { isSetLike } from "../../../common/k8s/util";
import {
    ContextMenuButton,
    MenuItem as ContextMenuItem,
} from "../../component/main/ContextMenuButton";
import { useK8sDeleteAction, useK8sRedeployAction } from "../../k8s/actions";
import { useContextMenu } from "../../hook/context-menu";
import { ContextMenuTemplate } from "../../../common/contextmenu";

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

    const openEditor = useEditorOpener();

    const { checkContextLock } = useContextLockHelpers();

    const [showDetails, setShowDetails] = useState(false);
    const [mode, setMode] = useAppParam<"view" | "edit">("editorMode", "view");
    const [isDeleting, setIsDeleting] = useState(false);

    const [expandedItems, setExpandedItems] = useState<string[]>([]);

    const deleteResource = useK8sDeleteAction();
    const redeploy = useK8sRedeployAction();

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
    const onClickDelete = useCallback(async () => {
        if (object) {
            setIsDeleting(true);
            await deleteResource([object]);
            setIsDeleting(false);
        }
    }, [object, setIsDeleting]);

    const onClickShell = useCallback(
        async (containerName: string) => {
            if (!(await checkContextLock())) {
                return;
            }
            openEditor(shellEditor(object, containerName));
        },
        [checkContextLock, openEditor, object]
    );
    const onClickLogs = useCallback(
        (containerName: string) => {
            openEditor(logsEditor(object, containerName));
        },
        [openEditor, object]
    );
    const [isRedeploying, setRedeploying] = useState(false);
    const onClickRedeploy = useCallback(async () => {
        if (object) {
            setRedeploying(true);
            await redeploy([object]);
            setRedeploying(false);
        }
    }, [object, redeploy, setRedeploying]);

    // TODO: wire the log button and the shell button to an associated pod
    const isLoggable = object?.apiVersion === "v1" && object.kind === "Pod";
    const isShellable = object?.apiVersion === "v1" && object.kind === "Pod";
    const isRedeployable = object && isSetLike(object);
    const isScalable =
        object && isSetLike(object) && object.kind !== "DaemonSet";

    const badges: ResourceBadge[] = useMemo(
        () => (object ? generateBadges(object) : []),
        [object]
    );

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
            bottomToolbar={
                <Toolbar>
                    <Button
                        leftIcon={<EditIcon />}
                        onClick={onClickEdit}
                        isDisabled={isDeleting}
                    >
                        Edit
                    </Button>
                    <IconButton
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
                    {isRedeployable && (
                        <IconButton
                            icon={<RepeatIcon />}
                            aria-label="Redeploy"
                            title="Redeploy"
                            onClick={onClickRedeploy}
                            isLoading={isRedeploying}
                            isDisabled={isDeleting}
                        />
                    )}
                    {isScalable && (
                        <ScaleButton object={object} isDisabled={isDeleting} />
                    )}
                    <Box flex="1 0 0"></Box>
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
                {object && <PortForwardingMenu object={object} />}
                {object && <AssociatedPods object={object} />}
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
                    onClick?.(container.name);
                },
            })) ?? [],
        [object, onClick]
    );

    const onMenuAction = useCallback(
        ({ actionId }: { actionId: string }) => {
            containers.find((c) => c.name === actionId)?.onClick();
        },
        [containers]
    );

    if (containers.length === 1) {
        return (
            <IconButton
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
            <ContextMenuButton
                px={1}
                as={IconButton}
                icon={<Icon as={FiTerminal} />}
                aria-label="Shell"
                title="Shell"
                fontWeight="normal"
                isDisabled={isDisabled}
                onMenuAction={onMenuAction}
            >
                {containers.map((container) => (
                    <ContextMenuItem
                        key={container.name}
                        actionId={container.name}
                        label={container.name}
                    />
                ))}
            </ContextMenuButton>
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
                    onClick?.(container.name);
                },
            })) ?? [],
        [object, onClick]
    );

    const onMenuAction = useCallback(
        ({ actionId }: { actionId: string }) => {
            containers.find((c) => c.name === actionId)?.onClick();
        },
        [containers]
    );

    if (containers.length === 1) {
        return (
            <IconButton
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
            <ContextMenuButton
                px={1}
                as={IconButton}
                icon={<Icon as={RiTextWrap} />}
                aria-label="Logs"
                title="Logs"
                fontWeight="normal"
                isDisabled={isDisabled}
                onMenuAction={onMenuAction}
            >
                {containers.map((container) => (
                    <ContextMenuItem
                        key={container.name}
                        actionId={container.name}
                        label={container.name}
                    />
                ))}
            </ContextMenuButton>
        );
    }
};

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

    const [isLoadingHpas, hpas, hpasError] = useK8sListWatch(
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
            } catch (e) {
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
        let targetScale = pausedScaleNumber ?? 1;
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
                <HStack justifyContent="end">
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
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
                </HStack>
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
            variant="solid"
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
    const {
        hasAssociatedPods,
        isLoadingAssociatedPods,
        associatedPods,
        error,
    } = useK8sAssociatedPods(object);

    if (!hasAssociatedPods) {
        return null;
    }

    return (
        <VStack alignItems="stretch">
            <Heading size="sm">Pods</Heading>
            {isLoadingAssociatedPods && <Spinner />}
            {!isLoadingAssociatedPods && associatedPods.length === 0 && (
                <Text fontSize="sm" color="gray">
                    No associated pods.
                </Text>
            )}
            {!isLoadingAssociatedPods && associatedPods.length > 0 && (
                <Table
                    size="sm"
                    sx={{ tableLayout: "fixed" }}
                    width="100%"
                    maxWidth="1000px"
                >
                    <Thead>
                        <Tr>
                            <Th whiteSpace="nowrap" ps={0}>
                                Name
                            </Th>
                            <Th width="150px">Created</Th>
                            <Th width="150px">Actions</Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {associatedPods.map((pod) => (
                            <AssociatedPodRow
                                key={pod.metadata.name}
                                object={pod}
                            />
                        ))}
                    </Tbody>
                </Table>
            )}
        </VStack>
    );
};

const AssociatedPodRow: React.FC<{ object: K8sObject }> = (props) => {
    const { object } = props;
    const creationDate = new Date((object as any).metadata.creationTimestamp);
    const isDeleting = Boolean((object as any).metadata.deletionTimestamp);

    const badges: ResourceBadge[] = useMemo(
        () => generateBadges(object),
        [object]
    );

    const { checkContextLock } = useContextLockHelpers();
    const openEditor = useEditorOpener();

    const onClickShell = useCallback(
        async (containerName: string) => {
            if (!(await checkContextLock())) {
                return;
            }
            openEditor(shellEditor(object, containerName));
        },
        [checkContextLock, openEditor, object]
    );
    const onClickLogs = useCallback(
        (containerName: string) => {
            openEditor(logsEditor(object, containerName));
        },
        [openEditor, object]
    );

    return (
        <Tr>
            <Td ps={0} userSelect="text">
                <HStack p={0}>
                    <Selectable
                        display="block"
                        cursor="inherit"
                        textColor={isDeleting ? "gray.500" : ""}
                        isTruncated
                    >
                        <ResourceEditorLink
                            userSelect="text"
                            editorResource={object}
                        >
                            {object.metadata.name}
                        </ResourceEditorLink>
                    </Selectable>
                    {badges.map((badge) => {
                        const { id, text, variant, details, badgeProps } =
                            badge;
                        const colorScheme = {
                            positive: "green",
                            negative: "red",
                            changing: "orange",
                            other: "gray",
                        }[variant ?? "other"];
                        return (
                            <Badge
                                key={id}
                                colorScheme={colorScheme}
                                title={details ?? text}
                                {...badgeProps}
                            >
                                {text}
                            </Badge>
                        );
                    })}
                </HStack>
            </Td>
            <Td>
                <Selectable display="block" isTruncated>
                    {formatDeveloperDateTime(creationDate)}
                </Selectable>
            </Td>
            <Td>
                <ButtonGroup size="xs">
                    <ShellButton
                        object={object}
                        isDisabled={isDeleting}
                        onClick={onClickShell}
                    />
                    <LogsButton
                        object={object}
                        isDisabled={isDeleting}
                        onClick={onClickLogs}
                    />
                </ButtonGroup>
            </Td>
        </Tr>
    );
};

const PortForwardingMenu: React.FC<{ object: K8sObject }> = (props) => {
    const { object } = props;
    if (!object || object.apiVersion !== "v1" || object.kind !== "Pod") {
        return null;
    }

    const client = useK8sClient();
    const showDialog = useDialog();
    const { checkContextLock } = useContextLockHelpers();

    const [stats, setStats] = useState<Record<string, K8sPortForwardStats>>({});

    const [loading, forwards, _forwardsError] = useK8sPortForwardsWatch(
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
                                    fwd.spec.podName === object.metadata.name &&
                                    fwd.spec.podPort === port.containerPort &&
                                    forwardable
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
                if (!(await checkContextLock())) {
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
        [client, checkContextLock, object, showDialog]
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
                    Pod exposes no ports.
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
        const looksLikeSecureLink = portForward.spec.podPort % 1000 === 443;
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
