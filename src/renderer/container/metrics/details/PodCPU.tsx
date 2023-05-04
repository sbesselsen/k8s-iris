import { Badge } from "@chakra-ui/react";
import React from "react";
import { K8sObject } from "../../../../common/k8s/client";
import { parseCpu } from "../../../../common/k8s/util";
import { AppTooltip } from "../../../component/main/AppTooltip";
import { PercentageBadge } from "../../../component/main/PercentageBadge";
import { useK8sNodeMetrics, useK8sPodMetrics } from "../../../k8s/metrics";

export const PodCPU: React.FC<{ pod: K8sObject }> = (props) => {
    const { pod } = props;

    const metrics = useK8sPodMetrics(pod);

    if (!metrics) {
        return null;
    }

    const totalCpu = ((metrics as any).containers ?? [])
        .map((c: any) => parseCpu(c?.usage?.cpu ?? "0m"))
        .reduce((cpu, total) => cpu + total, 0);
    return <>{String(totalCpu.toFixed(2))}</>;

    // const cpu = (metrics as any)?.usage?.cpu
    //     ? parseCpu((metrics as any)?.usage?.cpu)
    //     : null;

    // const totalCpu = (node as any)?.status?.capacity?.cpu
    //     ? parseCpu((node as any)?.status?.capacity?.cpu)
    //     : null;

    // return (
    //     <>
    //         {totalCpu !== null && totalCpu > 0 && cpu !== null && (
    //             <AppTooltip
    //                 label={
    //                     cpu.toFixed(1) + " / " + totalCpu.toFixed(1) + " cores"
    //                 }
    //             >
    //                 <PercentageBadge
    //                     value={cpu / totalCpu}
    //                     colorScheme={cpu / totalCpu > 0.8 ? "red" : "gray"}
    //                     w="100%"
    //                 />
    //             </AppTooltip>
    //         )}
    //         {!totalCpu && cpu !== null && <Badge>{cpu.toFixed(1)}</Badge>}
    //     </>
    // );
};
