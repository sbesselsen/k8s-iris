import React, { useMemo } from "react";

import { ScrollBox } from "../../component/main/ScrollBox";

import { useK8sListWatch } from "../../k8s/list-watch";
import { useK8sContextsInfo } from "../../hook/k8s-contexts-info";
import { useK8sContext } from "../../context/k8s-context";
import {
    Heading,
    Table,
    Tbody,
    Td,
    Text,
    Th,
    Tr,
    useColorModeValue,
} from "@chakra-ui/react";
import { Selectable } from "../../component/main/Selectable";
import { K8sObject } from "../../../common/k8s/client";
import { parseCpu, parseMemory } from "../../../common/k8s/util";

export const ClusterInfoOverview: React.FC = () => {
    const [_isLoadingNodes, nodes, _nodesError] = useK8sListWatch(
        {
            apiVersion: "v1",
            kind: "Node",
        },
        {},
        []
    );

    const context = useK8sContext();

    const [_loadingContexts, contextsInfo] = useK8sContextsInfo(true);
    const contextInfo = contextsInfo.find((info) => info.name === context);

    const title = contextInfo?.cluster ?? context;

    const headingColor = useColorModeValue("primary.900", "white");

    return (
        <ScrollBox px={4} py={2}>
            <Heading textColor={headingColor} size="sm" mb={2} isTruncated>
                Cluster
            </Heading>
            <Table size="sm">
                <Tbody>
                    <Tr>
                        <StatTh>Name</StatTh>
                        <StatTd>
                            <Selectable>{title}</Selectable>
                        </StatTd>
                    </Tr>
                    <Tr>
                        <StatTh>Nodes</StatTh>
                        <StatTd>
                            <Selectable>{nodes?.items.length ?? ""}</Selectable>
                        </StatTd>
                    </Tr>
                </Tbody>
            </Table>

            <Heading
                textColor={headingColor}
                size="sm"
                mt={6}
                mb={2}
                isTruncated
            >
                Capacity
            </Heading>
            {nodes && <CapacityTable nodes={nodes?.items} />}
        </ScrollBox>
    );
};

function sum(numbers: number[]): number {
    return numbers.reduce((x, y) => x + y, 0);
}

const CapacityTable: React.FC<{ nodes: K8sObject[] }> = (props) => {
    const { nodes } = props;

    const cpu = useMemo(
        () =>
            sum(
                nodes.map((node) =>
                    parseCpu((node as any)?.status?.capacity?.cpu ?? "0")
                )
            ),
        [nodes]
    );

    const memory = useMemo(
        () =>
            sum(
                nodes.map((node) =>
                    parseMemory(
                        (node as any)?.status?.capacity?.memory ?? "0",
                        "Gi"
                    )
                )
            ),
        [nodes]
    );

    const storage = useMemo(
        () =>
            sum(
                nodes.map((node) =>
                    parseMemory(
                        (node as any)?.status?.capacity?.[
                            "ephemeral-storage"
                        ] ?? "0",
                        "Gi"
                    )
                )
            ),
        [nodes]
    );

    if (!nodes) {
        return null;
    }

    return (
        <Table size="sm">
            <Tbody>
                <Tr>
                    <StatTh>CPU</StatTh>
                    <StatTd>
                        <Selectable>{cpu === 0 ? "" : cpu}</Selectable>
                    </StatTd>
                </Tr>
                <Tr>
                    <StatTh>Memory</StatTh>
                    <StatTd>
                        <Selectable>
                            {memory === 0
                                ? ""
                                : `${memory.toLocaleString(undefined, {
                                      maximumFractionDigits: 2,
                                      minimumFractionDigits: 1,
                                  })} Gi`}
                        </Selectable>
                    </StatTd>
                </Tr>
                <Tr>
                    <StatTh>Storage</StatTh>
                    <StatTd>
                        <Selectable>
                            {storage === 0
                                ? ""
                                : `${storage.toLocaleString(undefined, {
                                      maximumFractionDigits: 2,
                                      minimumFractionDigits: 1,
                                  })} Gi`}
                        </Selectable>
                    </StatTd>
                </Tr>
            </Tbody>
        </Table>
    );
};

const StatTh: React.FC<{}> = ({ children, ...props }) => {
    return (
        <Th
            width="0"
            whiteSpace="nowrap"
            textAlign="left"
            verticalAlign="baseline"
            ps={0}
            py={2}
            minWidth="150px"
            {...props}
        >
            <Text isTruncated>{children}</Text>
        </Th>
    );
};
const StatTd: React.FC<{}> = ({ children, ...props }) => {
    return (
        <Td verticalAlign="baseline" py={2} {...props}>
            <Text isTruncated>{children}&nbsp;</Text>
        </Td>
    );
};
