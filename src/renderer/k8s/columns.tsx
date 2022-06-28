import { Box, Spinner } from "@chakra-ui/react";
import { ReactNode } from "react";
import { K8sObject, K8sResourceTypeIdentifier } from "../../common/k8s/client";
import { isSetLike } from "../../common/k8s/util";
import { AppTooltip } from "../component/main/AppTooltip";

export type ResourceColumn = {
    id: string;
    header: ReactNode;
    widthUnits: number;
    valueFor: (resource: K8sObject) => ReactNode;
    importance?: number;
};

export function generateResourceColumns(
    resourceType: K8sResourceTypeIdentifier
): ResourceColumn[] {
    return [generateSetSizeColumns].flatMap((f) => f(resourceType));
}

function generateSetSizeColumns(
    resourceType: K8sResourceTypeIdentifier
): ResourceColumn[] {
    const output: ResourceColumn[] = [];
    if (isSetLike(resourceType)) {
        output.push({
            id: "resource-set-scale",
            header: "Scale",
            importance: 1,
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
