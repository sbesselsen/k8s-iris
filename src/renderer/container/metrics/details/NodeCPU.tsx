import { Badge } from "@chakra-ui/react";
import React from "react";
import { K8sObject } from "../../../../common/k8s/client";
import { parseCpu } from "../../../../common/k8s/util";
import { AppTooltip } from "../../../component/main/AppTooltip";
import { PercentageBadge } from "../../../component/main/PercentageBadge";
import { useK8sNodeMetrics } from "../../../k8s/metrics";

export const NodeCPU: React.FC<{ node: K8sObject }> = (props) => {
    const { node } = props;

    const metrics = useK8sNodeMetrics(node);

    const cpu = (metrics as any)?.usage?.cpu
        ? parseCpu((metrics as any)?.usage?.cpu)
        : null;

    const totalCpu = (node as any)?.status?.capacity?.cpu
        ? parseCpu((node as any)?.status?.capacity?.cpu)
        : null;

    return (
        <>
            {totalCpu !== null && totalCpu > 0 && cpu !== null && (
                <AppTooltip
                    label={
                        cpu.toFixed(1) + " / " + totalCpu.toFixed(1) + " cores"
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
        </>
    );
};
