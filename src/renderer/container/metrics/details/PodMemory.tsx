import { Badge } from "@chakra-ui/react";
import React from "react";
import { K8sObject } from "../../../../common/k8s/client";
import { parseMemory } from "../../../../common/k8s/util";
import { AppTooltip } from "../../../component/main/AppTooltip";
import { PercentageBadge } from "../../../component/main/PercentageBadge";
import { useK8sNodeMetrics, useK8sPodMetrics } from "../../../k8s/metrics";

export const PodMemory: React.FC<{ pod: K8sObject }> = (props) => {
    const { pod } = props;

    const metrics = useK8sPodMetrics(pod);

    if (!metrics) {
        return null;
    }

    const totalMemory = ((metrics as any).containers ?? [])
        .map((c: any) => parseMemory(c?.usage?.memory ?? "0Mi", "Mi"))
        .reduce((memory, total) => memory + total, 0);
    return <>{String(totalMemory.toFixed(1))}Mi</>;

    // const memory = (metrics as any)?.usage?.memory
    //     ? parseMemory((metrics as any)?.usage?.memory, "Gi")
    //     : null;

    // const totalMemory = (node as any)?.status?.capacity?.memory
    //     ? parseMemory((node as any)?.status?.capacity?.memory, "Gi")
    //     : null;

    // return (
    //     <>
    //         {totalMemory !== null && totalMemory > 0 && memory !== null && (
    //             <AppTooltip
    //                 w="100%"
    //                 label={
    //                     memory.toFixed(1) +
    //                     " / " +
    //                     totalMemory.toFixed(1) +
    //                     " Gi"
    //                 }
    //             >
    //                 <PercentageBadge
    //                     value={memory / totalMemory}
    //                     colorScheme={
    //                         memory / totalMemory > 0.8 ? "red" : "gray"
    //                     }
    //                     w="100%"
    //                     textTransform="none"
    //                 />
    //             </AppTooltip>
    //         )}
    //         {!totalMemory && memory !== null && (
    //             <Badge>{memory.toFixed(1)}</Badge>
    //         )}
    //     </>
    // );
};
