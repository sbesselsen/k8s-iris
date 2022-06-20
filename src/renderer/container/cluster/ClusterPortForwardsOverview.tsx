import { ChevronDownIcon, ChevronUpIcon } from "@chakra-ui/icons";
import {
    Badge,
    Box,
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
import { useK8sNamespaces } from "../../context/k8s-namespaces";
import { useK8sClient } from "../../k8s/client";
import { useK8sPortForwardsWatch } from "../../k8s/port-forward-watch";
import { ResourceEditorLink } from "../resources/ResourceEditorLink";

export const ClusterPortForwardsOverview: React.FC<{}> = () => {
    const client = useK8sClient();
    useEffect(() => {
        window.k8sClient = client;
    }, [client]);

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

    if (loading) {
        return null;
    }

    return (
        <ScrollBox px={4} py={2} flex="1 0 0">
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

    // Calculate stats.
    const [prevPeriodStats, setPrevPeriodStats] =
        useState<K8sPortForwardStats>();
    const prevStatsRef = useRef<K8sPortForwardStats>();
    useEffect(() => {
        if (!stats) {
            return;
        }
        if (stats !== prevStatsRef.current) {
            setPrevPeriodStats(prevStatsRef.current);
        }
        prevStatsRef.current = stats;
    }, [prevStatsRef, setPrevPeriodStats, stats]);

    const periodStats: PeriodStats | null = useMemo(() => {
        if (!stats || !prevPeriodStats) {
            return null;
        }
        const durationMs = stats.timestampMs - prevPeriodStats.timestampMs;
        const bytesDown = stats.sumBytesDown - prevPeriodStats.sumBytesDown;
        const bytesUp = stats.sumBytesUp - prevPeriodStats.sumBytesUp;
        const bytesDownPerSecond = (bytesDown * 1000) / durationMs;
        const bytesUpPerSecond = (bytesUp * 1000) / durationMs;
        return {
            bytesDownPerSecond,
            bytesUpPerSecond,
            sumBytesDown: stats.sumBytesDown,
            sumBytesUp: stats.sumBytesUp,
        };
    }, [prevPeriodStats, stats]);

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
                <Checkbox
                    colorScheme="primary"
                    isChecked={isSelected}
                    onChange={onChange}
                />
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
                <Selectable>{portForward.localPort}</Selectable>
            </Td>
            {showStats && (
                <Td>
                    {periodStats && <PortForwardStats stats={periodStats} />}
                </Td>
            )}
        </Tr>
    );
};

type PortForwardStatsProps = {
    stats: PeriodStats;
};
const PortForwardStats: React.FC<PortForwardStatsProps> = (props) => {
    const { stats } = props;

    return (
        <HStack spacing={2}>
            <Badge textTransform="none">
                <ChevronUpIcon />
                {displayMi(stats.bytesUpPerSecond)}Mi/s (
                {displayMi(stats.sumBytesDown, 0)}Mi)
            </Badge>
            <Badge textTransform="none">
                <ChevronDownIcon />
                {displayMi(stats.bytesDownPerSecond)}Mi/s (
                {displayMi(stats.sumBytesDown, 0)}Mi)
            </Badge>
        </HStack>
    );
};

function displayMi(bytes: number, fractionDigits = 2): string {
    const mibs = bytes / 1048576;
    return mibs.toLocaleString(undefined, {
        useGrouping: false,
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    });
}
