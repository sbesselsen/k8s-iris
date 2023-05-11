import { Badge } from "@chakra-ui/react";
import React from "react";
import { K8sObject } from "../../../../common/k8s/client";
import { parseMemory } from "../../../../common/k8s/util";
import { AppTooltip } from "../../../component/main/AppTooltip";
import { PercentageBadge } from "../../../component/main/PercentageBadge";
import { useK8sNodeMetrics } from "../../../k8s/metrics";

export const NodeMemory: React.FC<{ node: K8sObject }> = (props) => {
    const { node } = props;

    const metrics = useK8sNodeMetrics(node);

    const memory = (metrics as any)?.usage?.memory
        ? parseMemory((metrics as any)?.usage?.memory, "Gi")
        : null;

    const totalMemory = (node as any)?.status?.capacity?.memory
        ? parseMemory((node as any)?.status?.capacity?.memory, "Gi")
        : null;

    return (
        <>
            {totalMemory !== null && totalMemory > 0 && memory !== null && (
                <AppTooltip
                    w="100%"
                    label={
                        memory.toFixed(1) +
                        " / " +
                        totalMemory.toFixed(1) +
                        " Gi"
                    }
                >
                    <PercentageBadge
                        value={memory / totalMemory}
                        colorScheme={
                            memory / totalMemory > 0.8 ? "red" : "gray"
                        }
                        minWidth="50px"
                        w="100%"
                        textTransform="none"
                    />
                </AppTooltip>
            )}
            {!totalMemory && memory !== null && (
                <Badge fontWeight="medium">{memory.toFixed(1)}</Badge>
            )}
        </>
    );
};
