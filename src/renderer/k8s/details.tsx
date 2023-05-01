import { Box, Link, List, ListItem, Text } from "@chakra-ui/react";
import React, { MouseEvent, ReactNode, useCallback } from "react";
import { K8sObject, K8sResourceTypeIdentifier } from "../../common/k8s/client";
import { isSetLike } from "../../common/k8s/util";
import { AppTooltip } from "../component/main/AppTooltip";
import { useIpcCall } from "../hook/ipc";

export type ResourceDetailCommon = {
    id: string;
    header: ReactNode;
    valueFor: (resource: K8sObject) => ReactNode;
    importance?: number;
};

export type ResourceDetail = ResourceColumn | ResourceBox;

export type ResourceColumn = ResourceDetailCommon & {
    style: "column";
    widthUnits: number;
};
export type ResourceBox = ResourceDetailCommon & {
    style: "box";
};

export function isResourceColumn(
    detail: ResourceDetail
): detail is ResourceColumn {
    return detail.style === "column";
}
export function isResourceBox(detail: ResourceDetail): detail is ResourceBox {
    return detail.style === "box";
}

export function generateResourceDetails(
    resourceType: K8sResourceTypeIdentifier
): ResourceDetail[] {
    return [
        generateSetSizeDetails,
        generateIngressDetails,
        generateNodeDetails,
    ].flatMap((f) => f(resourceType));
}

function generateSetSizeDetails(
    resourceType: K8sResourceTypeIdentifier
): ResourceDetail[] {
    const output: ResourceDetail[] = [];
    if (isSetLike(resourceType) && resourceType.kind !== "DaemonSet") {
        output.push({
            id: "resource-set-scale",
            header: "Scale",
            importance: 1,
            style: "column",
            widthUnits: 1,
            valueFor(resource) {
                const r = resource as any;
                if (r.spec?.replicas === undefined) {
                    return null;
                }
                const scales: string[] = [];
                scales.push(`target: ${r.spec?.replicas}`);
                if (
                    r.metadata.annotations?.[
                        "irisapp.dev/original-replicas"
                    ] !== undefined
                ) {
                    scales.push(
                        `original: ${r.metadata.annotations["irisapp.dev/original-replicas"]}`
                    );
                }
                if (r.status?.readyReplicas !== undefined) {
                    scales.push(`ready: ${r.status?.readyReplicas}`);
                }
                if (r.status?.unavailableReplicas !== undefined) {
                    scales.push(
                        `unavailable: ${r.status?.unavailableReplicas}`
                    );
                }
                const current =
                    (r.status?.replicas ?? 0) -
                    (r.status?.unavailableReplicas ?? 0);
                if (r.status?.replicas !== undefined) {
                    scales.push(`total: ${r.status?.replicas}`);
                }
                return (
                    <AppTooltip label={<Box>{scales.join(", ")}</Box>}>
                        <Box>
                            {current ?? 0}/{r.spec?.replicas ?? 0}
                        </Box>
                    </AppTooltip>
                );
            },
        });
    }
    return output;
}

function generateIngressDetails(
    resourceType: K8sResourceTypeIdentifier
): ResourceDetail[] {
    const output: ResourceDetail[] = [];
    if (
        resourceType.kind === "Ingress" &&
        resourceType.apiVersion.match(/^(extensions|networking.k8s.io)\//)
    ) {
        output.push({
            id: "ingress-urls",
            header: "Scale",
            importance: 1,
            style: "box",
            valueFor(resource) {
                const r = resource as any;
                const hasTls = (r.spec?.tls ?? []).length > 0;
                const protocol = hasTls ? "https" : "http";
                const urls: string[] = (r.spec?.rules ?? []).flatMap(
                    (rule: any) =>
                        (rule?.http?.paths ?? []).flatMap((path: any) => {
                            if (rule.host) {
                                const url =
                                    protocol +
                                    "://" +
                                    rule.host +
                                    (path?.path ?? "");
                                return [url];
                            }
                            return [];
                        })
                );
                return (
                    <List>
                        {urls.map((url, index) => (
                            <ListItem key={index}>
                                <IngressHostLink url={url} />
                            </ListItem>
                        ))}
                    </List>
                );
            },
        });
    }
    return output;
}

export const IngressHostLink: React.FC<{ url: string }> = (props) => {
    const { url } = props;
    const ipcOpenUrl = useIpcCall((ipc) => ipc.app.openUrlInBrowser);
    const onClick = useCallback(
        (e: MouseEvent) => {
            e.preventDefault();
            ipcOpenUrl({ url });
        },
        [ipcOpenUrl, url]
    );

    return (
        <Link
            href={url}
            isExternal
            onClick={onClick}
            fontSize="xs"
            textColor="gray"
        >
            {url}
        </Link>
    );
};

function generateNodeDetails(
    resourceType: K8sResourceTypeIdentifier
): ResourceDetail[] {
    const output: ResourceDetail[] = [];
    if (resourceType.apiVersion === "v1" && resourceType.kind === "Node") {
        output.push({
            id: "node-arch",
            header: "Arch",
            importance: 1,
            style: "column",
            widthUnits: 1,
            valueFor(node) {
                const labels = node.metadata.labels ?? {};
                return (
                    labels["kubernetes.io/arch"] ??
                    labels["beta.kubernetes.io/arch"]
                );
            },
        });
        output.push({
            id: "node-instance",
            header: "Instance",
            importance: 1,
            style: "column",
            widthUnits: 2,
            valueFor(node) {
                const labels = node.metadata.labels ?? {};
                return (
                    labels["node.kubernetes.io/instance-type"] ??
                    labels["beta.kubernetes.io/instance-type"]
                );
            },
        });
        output.push({
            id: "node-zone",
            header: "Zone",
            importance: 1,
            style: "column",
            widthUnits: 2,
            valueFor(node) {
                const labels = node.metadata.labels ?? {};
                return (
                    labels["topology.kubernetes.io/zone"] ??
                    labels["failure-domain.beta.kubernetes.io/zone"]
                );
            },
        });
        output.push({
            id: "node-version",
            header: "Version",
            importance: 1,
            style: "column",
            widthUnits: 2,
            valueFor(node) {
                const version = (node as any).status?.nodeInfo?.kubeletVersion;
                if (!version) {
                    return null;
                }
                return (
                    <Text userSelect="text" isTruncated>
                        {version}
                    </Text>
                );
            },
        });
    }
    return output;
}
