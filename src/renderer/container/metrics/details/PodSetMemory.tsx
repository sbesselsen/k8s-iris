import { Badge } from "@chakra-ui/react";
import React, { useMemo } from "react";
import { K8sObject } from "../../../../common/k8s/client";
import { metricsPerContainer, parseMemory } from "../../../../common/k8s/util";
import { createAssociatedPodsFilter } from "../../../k8s/associated-pods";
import { useK8sPodNamespacesMetrics } from "../../../k8s/metrics";

export const PodSetMemory: React.FC<{ podSet: K8sObject }> = (props) => {
    const { podSet } = props;

    const namespacePodMetrics = useK8sPodNamespacesMetrics([
        podSet.metadata.namespace as string,
    ]);

    const metricsFilter = useMemo(
        () => createAssociatedPodsFilter(podSet),
        [podSet]
    );
    const metrics = useMemo(
        () => namespacePodMetrics.filter(metricsFilter),
        [namespacePodMetrics, metricsFilter]
    );

    const containerMetrics = useMemo(
        () =>
            metrics.map((m) => ({
                name: m.metadata.name,
                metrics: metricsPerContainer((podSet as any).spec.template, m),
            })),
        [metrics, podSet]
    );

    const alerts = useMemo(() => {
        return containerMetrics
            .flatMap(({ name, metrics }) =>
                metrics.map((m) => ({ name, ...m }))
            )
            .flatMap((m) => {
                if ((m.memory.limitFraction ?? 0) >= 0.8) {
                    return [
                        {
                            level: "warning",
                            text: `${m.name}: ${m.containerName} is at ${(
                                (m.memory.limitFraction ?? 0) * 100
                            ).toFixed(0)}% of its limits`,
                        },
                    ];
                }
                if ((m.memory.requestFraction ?? 0) > 1) {
                    return [
                        {
                            level: "notice",
                            text: `${m.name}: ${m.containerName} is at ${(
                                (m.memory.requestFraction ?? 0) * 100
                            ).toFixed(0)}% of its requests`,
                        },
                    ];
                }
                return [];
            });
    }, [containerMetrics]);

    const alertsText = alerts.map((a) => a.text).join("; ");

    const hasWarning = alerts.some((a) => a.level === "warning");
    const hasNotice = alerts.some((a) => a.level === "notice");

    const colorScheme = hasWarning ? "red" : hasNotice ? "yellow" : "gray";

    if (!metrics) {
        return null;
    }

    const totalMemory = metrics
        .flatMap((metrics) => ((metrics as any).containers ?? []) as any[])
        .map((c: any) => parseMemory(c?.usage?.memory ?? "0Mi", "Mi") ?? 0)
        .reduce((memory, total) => memory + total, 0);
    return (
        <Badge
            textTransform="none"
            title={alertsText}
            colorScheme={colorScheme}
        >
            {String(totalMemory.toFixed(0))}Mi
        </Badge>
    );
};
