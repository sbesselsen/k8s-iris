import {
    Badge,
    BadgeProps,
    Box,
    forwardRef,
    HStack,
    Table,
    Tbody,
    Td,
    Th,
    Thead,
    Tooltip,
    Tr,
    useColorModeValue,
} from "@chakra-ui/react";
import React, { useMemo } from "react";
import { K8sObject } from "../../../common/k8s/client";
import { parseCpu, parseMemory } from "../../../common/k8s/util";
import { resourceMatch } from "../../../common/util/search";
import { k8sSmartCompare } from "../../../common/util/sort";
import { AppTooltip } from "../../component/main/AppTooltip";
import { ScrollBox } from "../../component/main/ScrollBox";
import { Selectable } from "../../component/main/Selectable";
import { useAppSearch } from "../../context/search";
import { useK8sListPoll } from "../../k8s/list-poll";
import { useK8sListWatch } from "../../k8s/list-watch";
import { ResourceEditorLink } from "../resources/ResourceEditorLink";

export const ClusterNodesOverview: React.FC = (props) => {
    const [_loadingNodes, nodes, _nodesError] = useK8sListWatch(
        {
            apiVersion: "v1",
            kind: "Node",
        },
        {},
        []
    );
    const [_loadingNodeMetrics, nodeMetrics, _nodeMetricsError] =
        useK8sListPoll(
            {
                apiVersion: "metrics.k8s.io/v1beta1",
                kind: "NodeMetrics",
            },
            {
                pollInterval: 10000,
            },
            []
        );

    const nodeMetricsByNode: Record<string, K8sObject> = useMemo(
        () =>
            Object.fromEntries(
                (nodeMetrics?.items ?? []).map((metrics) => [
                    metrics.metadata.name,
                    metrics,
                ])
            ),
        [nodeMetrics]
    );

    const { query } = useAppSearch();
    const filteredNodes = useMemo(() => {
        if (!nodes || !query) {
            return nodes?.items ?? [];
        }
        return nodes.items.filter((node) => resourceMatch(query, node));
    }, [nodes, query]);
    const sortedNodes = useMemo(
        () =>
            [...filteredNodes].sort((x, y) =>
                k8sSmartCompare(x.metadata.name, y.metadata.name)
            ),
        [filteredNodes]
    );

    return (
        <ScrollBox pb={10} w="100%">
            <Table
                size="sm"
                sx={{ tableLayout: "fixed" }}
                width="100%"
                maxWidth="1000px"
            >
                <Thead>
                    <Tr>
                        <Th width="20px"></Th>
                        <Th whiteSpace="nowrap">Node</Th>
                        <Th width="100px">CPU</Th>
                        <Th width="100px">Memory</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {sortedNodes.map((node) => (
                        <NodeInfo
                            key={node.metadata.name}
                            node={node}
                            metrics={nodeMetricsByNode[node.metadata.name]}
                        />
                    ))}
                </Tbody>
            </Table>
        </ScrollBox>
    );
};

type NodeInfoProps = {
    node: K8sObject;
    metrics?: K8sObject | undefined;
};

const NodeInfo: React.FC<NodeInfoProps> = React.memo((props) => {
    const { node, metrics } = props;

    const ready = (node as any)?.status?.conditions?.find(
        (c) => c?.type === "Ready"
    )?.status;
    const statusColor =
        ready === "True" ? "green" : ready === "False" ? "red" : "gray";

    const cpu = (metrics as any)?.usage?.cpu
        ? parseCpu((metrics as any)?.usage?.cpu)
        : null;
    const memory = (metrics as any)?.usage?.memory
        ? parseMemory((metrics as any)?.usage?.memory, "Gi")
        : null;

    const totalCpu = (node as any)?.status?.capacity?.cpu
        ? parseCpu((node as any)?.status?.capacity?.cpu)
        : null;
    const totalMemory = (node as any)?.status?.capacity?.memory
        ? parseMemory((node as any)?.status?.capacity?.memory, "Gi")
        : null;

    const creationDate = Date.parse((node.metadata as any).creationTimestamp);
    const isNew =
        !isNaN(creationDate) &&
        new Date().getTime() - creationDate < 2 * 3600 * 1000;

    return (
        <Tr>
            <Td px={2} pb={0} verticalAlign="baseline">
                <Box w="10px" h="10px" borderRadius="full" bg={statusColor} />
            </Td>
            <Td verticalAlign="baseline">
                <HStack>
                    <Selectable isTruncated>
                        <ResourceEditorLink editorResource={node}>
                            {node.metadata.name}
                        </ResourceEditorLink>
                    </Selectable>
                    {isNew && <Badge colorScheme="green">new</Badge>}
                </HStack>
                {(node as any)?.spec?.taints?.length > 0 && (
                    <HStack spacing={1} mt={1}>
                        <TaintsList taints={(node as any)?.spec?.taints} />
                    </HStack>
                )}
            </Td>
            <Td verticalAlign="baseline">
                {totalCpu > 0 && cpu !== null && (
                    <AppTooltip
                        label={
                            cpu.toFixed(1) +
                            " / " +
                            totalCpu.toFixed(1) +
                            " cores"
                        }
                    >
                        <PercentageBadge
                            value={cpu / totalCpu}
                            colorScheme={cpu / totalCpu > 0.8 ? "red" : "gray"}
                            w="100%"
                        />
                    </AppTooltip>
                )}
                {!totalCpu && cpu !== null && <Badge>{cpu.toFixed(1)}</Badge>}
            </Td>
            <Td verticalAlign="baseline">
                {totalMemory > 0 && memory !== null && (
                    <AppTooltip
                        w="100%"
                        label={
                            memory.toFixed(1) +
                            " / " +
                            totalMemory.toFixed(1) +
                            " Gi"
                        }
                    >
                        <PercentageBadge
                            value={memory / totalMemory}
                            colorScheme={
                                memory / totalMemory > 0.8 ? "red" : "gray"
                            }
                            w="100%"
                            textTransform="none"
                        />
                    </AppTooltip>
                )}
                {!totalMemory && memory !== null && (
                    <Badge>{memory.toFixed(1)}</Badge>
                )}
            </Td>
        </Tr>
    );
});

const PercentageBadge = forwardRef<
    {
        value: number;
        label?: string;
        colorScheme: string;
        size?: string;
    } & BadgeProps,
    any
>((props, ref) => {
    const { value, label, colorScheme, size, ...badgeProps } = props;

    const bgColor = useColorModeValue(
        colorScheme + ".100",
        colorScheme + ".700"
    );
    const barColor = useColorModeValue(
        colorScheme + ".500",
        colorScheme + ".400"
    );

    return (
        <Badge
            bg={bgColor}
            position="relative"
            px={0}
            overflow="hidden"
            textAlign="center"
            {...badgeProps}
            ref={ref}
        >
            <Box
                position="absolute"
                zIndex={0}
                bg={barColor}
                w={Math.round(100 * value) + "%"}
                transition="width 500ms ease-in-out"
                h="100%"
            ></Box>
            <Box position="relative" px={2}>
                {label ?? "\u00a0"}
            </Box>
        </Badge>
    );
});

const TaintsList: React.FC<{
    taints: Array<{ key: string; effect: string }>;
}> = (props) => {
    const { taints } = props;

    if (!taints?.length) {
        return null;
    }

    return (
        <>
            {taints.map((taint, index) => (
                <Badge
                    key={index}
                    textTransform="none"
                    verticalAlign="baseline"
                >
                    {taint.key}:{taint.effect}
                </Badge>
            ))}
        </>
    );
};
