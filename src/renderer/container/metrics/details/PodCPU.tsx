import { Badge } from "@chakra-ui/react";
import React, { useMemo } from "react";
import { K8sObject } from "../../../../common/k8s/client";
import { metricsPerContainer, parseCpu } from "../../../../common/k8s/util";
import { useK8sPodMetrics } from "../../../k8s/metrics";

export const PodCPU: React.FC<{ pod: K8sObject }> = (props) => {
    const { pod } = props;

    const metrics = useK8sPodMetrics(pod);

    const containerMetrics = useMemo(
        () => (metrics ? metricsPerContainer(pod, metrics) : []),
        [metrics, pod]
    );

    const alerts = useMemo(() => {
        return containerMetrics.flatMap((m) => {
            if ((m.cpu.limitFraction ?? 0) >= 0.8) {
                return [
                    {
                        level: "warning",
                        text: `${m.containerName} is at ${(
                            (m.cpu.limitFraction ?? 0) * 100
                        ).toFixed(0)}% of its limits`,
                    },
                ];
            }
            if ((m.cpu.requestFraction ?? 0) > 1) {
                return [
                    {
                        level: "notice",
                        text: `${m.containerName} is at ${(
                            (m.cpu.requestFraction ?? 0) * 100
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

    const totalCpu = (((metrics as any)?.containers ?? []) as any[])
        .map((c: any) => parseCpu(c?.usage?.cpu ?? "0m") ?? 0)
        .reduce((cpu, total) => cpu + total, 0);
    return (
        <Badge fontWeight="medium" title={alertsText} colorScheme={colorScheme}>
            {metrics ? String(totalCpu.toFixed(2)) : "-"}
        </Badge>
    );
};
