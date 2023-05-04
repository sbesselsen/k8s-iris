import { Badge } from "@chakra-ui/react";
import React, { useMemo } from "react";
import { K8sObject } from "../../../../common/k8s/client";
import { metricsPerContainer, parseMemory } from "../../../../common/k8s/util";
import { useK8sPodMetrics } from "../../../k8s/metrics";

export const PodMemory: React.FC<{ pod: K8sObject }> = (props) => {
    const { pod } = props;

    const metrics = useK8sPodMetrics(pod);

    const containerMetrics = useMemo(
        () => (metrics ? metricsPerContainer(pod, metrics) : []),
        [metrics, pod]
    );

    const alerts = useMemo(() => {
        return containerMetrics.flatMap((m) => {
            if ((m.memory.limitFraction ?? 0) >= 0.8) {
                return [
                    {
                        level: "warning",
                        text: `${m.containerName} is at ${(
                            (m.memory.limitFraction ?? 0) * 100
                        ).toFixed(0)}% of its limits`,
                    },
                ];
            }
            if ((m.memory.requestFraction ?? 0) > 1) {
                return [
                    {
                        level: "notice",
                        text: `${m.containerName} is at ${(
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

    const totalMemory = (((metrics as any).containers ?? []) as any[])
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
