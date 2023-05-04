import {
    Badge,
    Box,
    HStack,
    Link,
    List,
    ListItem,
    Text,
} from "@chakra-ui/react";
import React, {
    MouseEvent,
    MouseEventHandler,
    ReactNode,
    useCallback,
} from "react";
import { K8sObject, K8sResourceTypeIdentifier } from "../../common/k8s/client";
import { isSetLike } from "../../common/k8s/util";
import { AppTooltip } from "../component/main/AppTooltip";
import { NodeCPU } from "../container/metrics/details/NodeCPU";
import { NodeMemory } from "../container/metrics/details/NodeMemory";
import { PodCPU } from "../container/metrics/details/PodCPU";
import { PodMemory } from "../container/metrics/details/PodMemory";
import { ResourceEditorLink } from "../container/resources/ResourceEditorLink";
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
        generatePodDetails,
        generatePvcDetails,
        generatePvDetails,
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
            header: "URL",
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

    const popup = useIpcCall((ipc) => ipc.contextMenu.popup);

    const onContextMenu: MouseEventHandler = useCallback(() => {
        popup({
            menuTemplate: [
                { label: "Open", actionId: "open" },
                { label: "Copy URL", actionId: "copy-url" },
                { label: "Copy Host Name", actionId: "copy-hostname" },
            ],
        }).then(({ actionId }) => {
            switch (actionId) {
                case "open":
                    ipcOpenUrl({ url });
                    break;
                case "copy-url":
                    navigator.clipboard.writeText(url);
                    break;
                case "copy-hostname":
                    navigator.clipboard.writeText(
                        url.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
                    );
                    break;
            }
        });
    }, [ipcOpenUrl, url, popup]);

    return (
        <Link
            href={url}
            isExternal
            onClick={onClick}
            fontSize="xs"
            textColor="gray"
            onContextMenu={onContextMenu}
        >
            {url}
        </Link>
    );
};

function generatePodDetails(
    resourceType: K8sResourceTypeIdentifier
): ResourceDetail[] {
    const output: ResourceDetail[] = [];
    if (resourceType.apiVersion === "v1" && resourceType.kind === "Pod") {
        output.push({
            id: "pod-cpu",
            header: "CPU",
            importance: 1,
            style: "column",
            widthUnits: 1,
            valueFor(pod) {
                return <PodCPU pod={pod} />;
            },
        });
        output.push({
            id: "pod-memory",
            header: "Mem",
            importance: 1,
            style: "column",
            widthUnits: 1,
            valueFor(pod) {
                return <PodMemory pod={pod} />;
            },
        });
    }
    return output;
}

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
                    <Text title={version} userSelect="text" isTruncated>
                        {version}
                    </Text>
                );
            },
        });
        output.push({
            id: "node-cpu",
            header: "CPU",
            importance: 1,
            style: "column",
            widthUnits: 2,
            valueFor(node) {
                return <NodeCPU node={node} />;
            },
        });
        output.push({
            id: "node-memory",
            header: "Memory",
            importance: 1,
            style: "column",
            widthUnits: 2,
            valueFor(node) {
                return <NodeMemory node={node} />;
            },
        });
        output.push({
            id: "node-taints",
            header: "Taints",
            importance: 1,
            style: "box",
            valueFor(node) {
                const taints: Array<{ key: string; effect: string }> =
                    (node as any)?.spec?.taints ?? [];

                if (taints.length === 0) {
                    return null;
                }

                return (
                    <HStack>
                        {taints.map((taint, index) => (
                            <Badge
                                key={index}
                                textTransform="none"
                                verticalAlign="baseline"
                            >
                                {taint.key}:{taint.effect}
                            </Badge>
                        ))}
                    </HStack>
                );
            },
        });
    }
    return output;
}

function generatePvcDetails(
    resourceType: K8sResourceTypeIdentifier
): ResourceDetail[] {
    const output: ResourceDetail[] = [];
    if (
        resourceType.apiVersion === "v1" &&
        resourceType.kind === "PersistentVolumeClaim"
    ) {
        output.push({
            id: "pvc-class",
            header: "Class",
            importance: 1,
            style: "column",
            widthUnits: 2,
            valueFor(pvc) {
                const name = (pvc as any).spec?.storageClassName;
                if (!name) {
                    return null;
                }
                return (
                    <Text title={name} userSelect="text" isTruncated>
                        {name}
                    </Text>
                );
            },
        });
        output.push({
            id: "pvc-volume",
            header: "Volume",
            importance: 1,
            style: "box",
            valueFor(pvc) {
                const name = (pvc as any).spec?.volumeName;
                if (!name) {
                    return null;
                }
                const editorResource = {
                    apiVersion: "v1",
                    kind: "PersistentVolume",
                    name,
                };
                return (
                    <ResourceEditorLink
                        fontSize="xs"
                        textColor="gray"
                        userSelect="text"
                        isTruncated
                        showMenuAffordance={false}
                        editorResource={editorResource}
                    >
                        {name}
                    </ResourceEditorLink>
                );
            },
        });
    }
    return output;
}

function generatePvDetails(
    resourceType: K8sResourceTypeIdentifier
): ResourceDetail[] {
    const output: ResourceDetail[] = [];
    if (
        resourceType.apiVersion === "v1" &&
        resourceType.kind === "PersistentVolume"
    ) {
        output.push({
            id: "pv-class",
            header: "Class",
            importance: 1,
            style: "column",
            widthUnits: 2,
            valueFor(pv) {
                const name = (pv as any).spec?.storageClassName;
                if (!name) {
                    return null;
                }
                return (
                    <Text title={name} userSelect="text" isTruncated>
                        {name}
                    </Text>
                );
            },
        });
        output.push({
            id: "pv-claim",
            header: "Claim",
            importance: 1,
            style: "box",
            valueFor(pvc) {
                const ref = (pvc as any).spec?.claimRef;
                if (!ref) {
                    return null;
                }
                const editorResource = {
                    apiVersion: "v1",
                    kind: "PersistentVolumeClaim",
                    name: ref.name,
                    namespace: ref.namespace,
                };
                return (
                    <ResourceEditorLink
                        fontSize="xs"
                        textColor="gray"
                        userSelect="text"
                        isTruncated
                        showMenuAffordance={false}
                        editorResource={editorResource}
                    >
                        {ref.name}
                    </ResourceEditorLink>
                );
            },
        });
    }
    return output;
}
