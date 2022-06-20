import React, { useCallback, useMemo } from "react";

import { ScrollBox } from "../../component/main/ScrollBox";

import { useK8sListWatch } from "../../k8s/list-watch";
import { useK8sContextsInfo } from "../../hook/k8s-contexts-info";
import { useK8sContext } from "../../context/k8s-context";
import {
    Button,
    Heading,
    Icon,
    IconButton,
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
import { Toolbar } from "../../component/main/Toolbar";
import { FiTerminal } from "react-icons/fi";
import { useEditorOpener } from "../../hook/editor-link";

const cloudProviderNames: Record<string, string> = {
    aws: "AWS",
    azure: "Azure",
    gcp: "Google Cloud Platform",
    local: "Local development",
};
const cloudServiceNames: Record<string, string> = {
    colima: "colima",
    eks: "EKS",
};

let localShellIndex = 1;

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

    const [_loadingContexts, contextsInfo] = useK8sContextsInfo();
    const contextInfo = contextsInfo.find((info) => info.name === context);

    const title = contextInfo?.cluster ?? context;

    const cloudProviderTitle = contextInfo?.cloudInfo?.cloudProvider
        ? cloudProviderNames[contextInfo.cloudInfo.cloudProvider] ??
          contextInfo.cloudInfo.cloudProvider
        : "Cloud";

    const headingColor = useColorModeValue("primary.900", "white");

    const openEditor = useEditorOpener();
    const onClickLocalShell = useCallback(() => {
        const index = localShellIndex++;
        openEditor({
            id: `local-shell:${index}`,
            name: "Shell" + (index === 1 ? "" : ` (${index})`),
            type: "local-shell",
        });
    }, [openEditor]);

    return (
        <ScrollBox
            px={4}
            py={2}
            bottomToolbar={
                <Toolbar>
                    <Button
                        colorScheme="primary"
                        leftIcon={<Icon as={FiTerminal} />}
                        fontWeight="normal"
                        onClick={onClickLocalShell}
                    >
                        Local shell
                    </Button>
                </Toolbar>
            }
        >
            <Heading textColor={headingColor} size="sm" mb={2} isTruncated>
                Cluster
            </Heading>
            <Table size="sm" sx={{ tableLayout: "fixed" }}>
                <Tbody>
                    <Tr>
                        <StatTh>Name</StatTh>
                        <StatTd>
                            <Selectable>{title}</Selectable>
                        </StatTd>
                    </Tr>
                    {contextInfo?.cluster !== contextInfo?.name && (
                        <Tr>
                            <StatTh>Cluster</StatTh>
                            <StatTd>{contextInfo.cluster}</StatTd>
                        </Tr>
                    )}
                    {contextInfo?.user !== contextInfo?.name && (
                        <Tr>
                            <StatTh>User</StatTh>
                            <StatTd>{contextInfo.user}</StatTd>
                        </Tr>
                    )}
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

            <Heading
                textColor={headingColor}
                size="sm"
                mt={6}
                mb={2}
                isTruncated
            >
                {cloudProviderTitle}
            </Heading>

            <Table size="sm" sx={{ tableLayout: "fixed" }}>
                <Tbody>
                    {contextInfo?.cloudInfo?.cloudService && (
                        <Tr>
                            <StatTh>Service</StatTh>
                            <StatTd>
                                {cloudServiceNames[
                                    contextInfo.cloudInfo.cloudService
                                ] ?? contextInfo.cloudInfo.cloudService}
                            </StatTd>
                        </Tr>
                    )}
                    {contextInfo.cloudInfo?.region && (
                        <Tr>
                            <StatTh>Region</StatTh>
                            <StatTd>{contextInfo.cloudInfo?.region}</StatTd>
                        </Tr>
                    )}

                    {contextInfo.cloudInfo?.accounts?.map((account, index) => (
                        <Tr key={account.accountId + ":" + account.accountName}>
                            <StatTh>{index === 0 ? "Account" : ""}</StatTh>
                            <StatTd>
                                <Selectable>
                                    {[account.accountId, account.accountName]
                                        .filter((t) => t)
                                        .join(" / ")}
                                </Selectable>
                            </StatTd>
                        </Tr>
                    ))}
                </Tbody>
            </Table>
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

    if (!nodes) {
        return null;
    }

    return (
        <Table size="sm" sx={{ tableLayout: "fixed" }}>
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
            </Tbody>
        </Table>
    );
};

const StatTh: React.FC<{}> = ({ children, ...props }) => {
    return (
        <Th
            width="150px"
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
