import { DeleteIcon, Icon } from "@chakra-ui/icons";
import {
    Button,
    Checkbox,
    HStack,
    Link,
    Table,
    Tbody,
    Td,
    Text,
    Th,
    Thead,
    Tr,
    useBreakpointValue,
} from "@chakra-ui/react";
import { HiOutlineGlobeAlt } from "react-icons/hi";
import React, { ChangeEvent, useCallback, useMemo, useState } from "react";
import {
    K8sObjectIdentifier,
    K8sPortForwardEntry,
    K8sPortForwardStats,
} from "../../../common/k8s/client";
import { ScrollBox } from "../../component/main/ScrollBox";
import { Selectable } from "../../component/main/Selectable";
import { Toolbar } from "../../component/main/Toolbar";
import { useK8sNamespaces } from "../../context/k8s-namespaces";
import { useK8sClient } from "../../k8s/client";
import { useK8sPortForwardsWatch } from "../../k8s/port-forward-watch";
import { ResourceEditorLink } from "../resources/ResourceEditorLink";
import { useKeyListener, useModifierKeyRef } from "../../hook/keyboard";
import { useDialog } from "../../hook/dialog";
import { useContextLockHelpers } from "../../context/context-lock";
import {
    PortForwardStats,
    usePeriodStats,
} from "../../component/k8s/PortForwardStats";
import { useIpcCall } from "../../hook/ipc";
import { ContextMenuTemplate } from "../../../common/contextmenu";
import { useContextMenu } from "../../hook/context-menu";

export const ClusterPortForwardsOverview: React.FC<{}> = () => {
    const client = useK8sClient();

    const [selectedForwardIds, setSelectedForwardIds] = useState<string[]>([]);
    const [stats, setStats] = useState<Record<string, K8sPortForwardStats>>({});

    const [loading, forwards, _forwardsError] = useK8sPortForwardsWatch(
        {
            onStats(stats) {
                setStats(stats);
            },
        },
        [setStats]
    );

    const namespaces = useK8sNamespaces();
    const showNamespace = namespaces.mode === "all";
    const filteredForwards = useMemo(
        () =>
            [...forwards].filter(
                (fwd) =>
                    namespaces.mode === "all" ||
                    namespaces.selected.includes(fwd.spec.namespace)
            ),
        [forwards, namespaces]
    );

    const onChangeSelectAll = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            const selectAll = e.target.checked;
            setSelectedForwardIds(
                selectAll ? filteredForwards.map((fwd) => fwd.id) : []
            );
        },
        [filteredForwards, setSelectedForwardIds]
    );

    const showStats = useBreakpointValue({ base: false, lg: true }) ?? false;

    // TODO: search
    const onSelectHandlers = useMemo(
        () =>
            Object.fromEntries(
                forwards.map((fwd) => [
                    fwd.id,
                    (selected: boolean) => {
                        setSelectedForwardIds((ids) => {
                            if (selected === ids.includes(fwd.id)) {
                                return ids;
                            }
                            return selected
                                ? [...ids, fwd.id]
                                : ids.filter((id) => id !== fwd.id);
                        });
                    },
                ])
            ),
        [forwards, setSelectedForwardIds]
    );

    const onClearSelection = useCallback(() => {
        setSelectedForwardIds([]);
    }, [setSelectedForwardIds]);

    const selectedForwards = useMemo(
        () =>
            filteredForwards.filter((fwd) =>
                selectedForwardIds.includes(fwd.id)
            ),
        [filteredForwards, selectedForwardIds]
    );

    if (loading) {
        return null;
    }

    return (
        <ScrollBox
            flex="1 0 0"
            bottomToolbar={
                <PortForwardsToolbar
                    portForwards={selectedForwards}
                    onClearSelection={onClearSelection}
                />
            }
        >
            <Table
                size="sm"
                sx={{ tableLayout: "fixed" }}
                width="100%"
                maxWidth="1000px"
            >
                <Thead>
                    <Tr>
                        <Th ps={2} width="40px">
                            <Checkbox
                                colorScheme="gray"
                                isIndeterminate={
                                    selectedForwardIds.length > 0 &&
                                    selectedForwardIds.length <
                                        filteredForwards.length
                                }
                                isChecked={
                                    selectedForwardIds.length > 0 &&
                                    selectedForwardIds.length ===
                                        filteredForwards.length
                                }
                                onChange={onChangeSelectAll}
                            />
                        </Th>
                        <Th ps={0} whiteSpace="nowrap">
                            Pod
                        </Th>
                        {showNamespace && <Th width="130px">Namespace</Th>}
                        <Th width="70px">Port</Th>
                        <Th width="80px">Local</Th>
                        {showStats && <Th width="300px">Stats</Th>}
                    </Tr>
                </Thead>
                <Tbody>
                    {filteredForwards.length === 0 && (
                        <Tr>
                            <Td>&nbsp;</Td>
                            <Td
                                ps={0}
                                colSpan={
                                    3 +
                                    (showNamespace ? 1 : 0) +
                                    (showStats ? 1 : 0)
                                }
                            >
                                <Text color="gray">
                                    No active port forwarding.
                                </Text>
                            </Td>
                        </Tr>
                    )}
                    {filteredForwards.map((forward) => (
                        <PortForwardRow
                            portForward={forward}
                            showNamespace={showNamespace}
                            showStats={showStats}
                            stats={stats[forward.id] ?? null}
                            key={forward.id}
                            isSelected={selectedForwardIds.includes(forward.id)}
                            onChangeSelect={onSelectHandlers[forward.id]}
                        />
                    ))}
                </Tbody>
            </Table>
        </ScrollBox>
    );
};

type PortForwardRowProps = {
    portForward: K8sPortForwardEntry;
    showNamespace: boolean;
    showStats: boolean;
    stats?: K8sPortForwardStats | null;
    isSelected?: boolean;
    onChangeSelect?: (selected: boolean) => void;
};

type PeriodStats = {
    bytesDownPerSecond: number;
    bytesUpPerSecond: number;
    sumBytesDown: number;
    sumBytesUp: number;
    numConnections: number;
};

const PortForwardRow: React.FC<PortForwardRowProps> = (props) => {
    const {
        portForward,
        isSelected,
        onChangeSelect,
        showNamespace,
        showStats,
        stats,
    } = props;

    const client = useK8sClient();

    const onChange = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            onChangeSelect?.(e.target.checked);
        },
        [onChangeSelect]
    );

    const periodStats = usePeriodStats(stats);

    const podResource: K8sObjectIdentifier = useMemo(
        () => ({
            apiVersion: "v1",
            kind: "Pod",
            name: portForward.spec.podName,
            namespace: portForward.spec.namespace,
        }),
        [portForward]
    );

    const openInBrowser = useIpcCall((ipc) => ipc.app.openUrlInBrowser);

    const portForwardHostPort = useMemo(
        () => (portForward ? `localhost:${portForward.localPort}` : null),
        [portForward]
    );
    const portForwardUrl = useMemo(() => {
        if (!portForward) {
            return null;
        }
        const looksLikeSecureLink = portForward.localPort % 1000 === 443;
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

    const onClickStop = useCallback(() => {
        client.stopPortForward(portForward.id);
    }, [portForward, client]);

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
        []
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
        <Tr onContextMenu={onContextMenu}>
            <Td ps={2} verticalAlign="baseline">
                <Checkbox isChecked={isSelected} onChange={onChange} />
            </Td>
            <Td ps={0} verticalAlign="baseline" userSelect="text">
                <ResourceEditorLink
                    userSelect="text"
                    display="block"
                    editorResource={podResource}
                    isTruncated
                >
                    {portForward.spec.podName}
                </ResourceEditorLink>
            </Td>
            {showNamespace && (
                <Td verticalAlign="baseline">
                    <Selectable display="block" isTruncated>
                        {portForward.spec.namespace}
                    </Selectable>
                </Td>
            )}
            <Td verticalAlign="baseline" userSelect="text">
                <Selectable>{portForward.spec.podPort}</Selectable>
            </Td>
            <Td verticalAlign="baseline" userSelect="text">
                <HStack>
                    {!portForward.spec.localOnly && (
                        <Icon
                            as={HiOutlineGlobeAlt}
                            aria-label="Shared on the network"
                            title="Shared on the network"
                        />
                    )}
                    <Selectable>
                        <Link
                            textDecoration="underline"
                            onClick={onClickLocalPort}
                        >
                            {portForward.localPort}
                        </Link>
                    </Selectable>
                </HStack>
            </Td>
            {showStats && (
                <Td>
                    {periodStats && <PortForwardStats stats={periodStats} />}
                </Td>
            )}
        </Tr>
    );
};

type PortForwardsToolbarProps = {
    portForwards: K8sPortForwardEntry[];
    onClearSelection?: () => void;
};

const PortForwardsToolbar: React.FC<PortForwardsToolbarProps> = (props) => {
    const { portForwards, onClearSelection } = props;

    const { checkContextLock } = useContextLockHelpers();
    const showDialog = useDialog();
    const client = useK8sClient();

    const [isDeleting, setIsDeleting] = useState(false);
    const onClickDelete = useCallback(() => {
        (async () => {
            setIsDeleting(true);
            await Promise.all(
                portForwards.map((fwd) => client.stopPortForward(fwd.id))
            );
            onClearSelection?.();
            setIsDeleting(false);
        })();
    }, [checkContextLock, portForwards, setIsDeleting, showDialog]);

    const metaKeyRef = useModifierKeyRef("Meta");
    useKeyListener(
        useCallback(
            (event, key) => {
                if (event === "keydown" && key === "Delete") {
                    if (portForwards?.length > 0) {
                        onClickDelete();
                    }
                }
            },
            [onClickDelete, metaKeyRef, portForwards]
        )
    );

    return (
        <Toolbar>
            {portForwards.length > 0 && (
                <Button
                    leftIcon={<DeleteIcon />}
                    onClick={onClickDelete}
                    isLoading={isDeleting}
                >
                    Stop
                </Button>
            )}
        </Toolbar>
    );
};
