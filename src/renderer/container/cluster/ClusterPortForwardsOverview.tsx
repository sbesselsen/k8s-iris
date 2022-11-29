import {
    ChevronDownIcon,
    ChevronUpIcon,
    DeleteIcon,
    Icon,
} from "@chakra-ui/icons";
import {
    Badge,
    Button,
    Checkbox,
    HStack,
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
import React, {
    ChangeEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
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

    return (
        <Tr>
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
                    <Selectable>{portForward.localPort}</Selectable>
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
            if (!(await checkContextLock())) {
                return;
            }
            const detail =
                portForwards.length === 1
                    ? `Are you sure you want to stop this port forward?`
                    : `Are you sure you want to stop these ${portForwards.length.toLocaleString()} port forwards?`;
            const result = await showDialog({
                title: "Confirm deletion",
                message: "Are you sure?",
                detail,
                buttons: ["Yes", "No"],
            });
            if (result.response === 0) {
                setIsDeleting(true);
                await Promise.all(
                    portForwards.map((fwd) => client.stopPortForward(fwd.id))
                );
                onClearSelection?.();
                setIsDeleting(false);
            }
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
