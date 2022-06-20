import { ChevronDownIcon, ChevronUpIcon } from "@chakra-ui/icons";
import { Badge, HStack, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { K8sPortForwardStats } from "../../../common/k8s/client";

export type PeriodStats = {
    bytesDownPerSecond: number;
    bytesUpPerSecond: number;
    sumBytesDown: number;
    sumBytesUp: number;
    numConnections: number;
};

export type PortForwardStatsProps = {
    stats: PeriodStats;
};

export const PortForwardStats: React.FC<PortForwardStatsProps> = (props) => {
    const { stats } = props;

    return (
        <HStack spacing={2}>
            <Badge textTransform="none" fontWeight="500">
                <Text display="inline" me={1} fontWeight="400">
                    #
                </Text>
                {stats.numConnections}
            </Badge>
            <Badge textTransform="none" fontWeight="500">
                <ChevronUpIcon />
                {displayBytes(stats.bytesUpPerSecond)}/s (
                {displayBytes(stats.sumBytesUp, 0)})
            </Badge>
            <Badge textTransform="none" fontWeight="500">
                <ChevronDownIcon />
                {displayBytes(stats.bytesDownPerSecond)}/s (
                {displayBytes(stats.sumBytesDown, 0)})
            </Badge>
        </HStack>
    );
};

export function usePeriodStats(
    stats: K8sPortForwardStats | null | undefined
): PeriodStats | null {
    const [prevPeriodStats, setPrevPeriodStats] =
        useState<K8sPortForwardStats>();
    const prevStatsRef = useRef<K8sPortForwardStats>();
    useEffect(() => {
        if (!stats) {
            return;
        }
        if (stats !== prevStatsRef.current) {
            setPrevPeriodStats(prevStatsRef.current);
        }
        prevStatsRef.current = stats;
    }, [prevStatsRef, setPrevPeriodStats, stats]);

    const periodStats: PeriodStats | null = useMemo(() => {
        if (!stats || !prevPeriodStats) {
            return null;
        }
        const durationMs = stats.timestampMs - prevPeriodStats.timestampMs;
        const bytesDown = stats.sumBytesDown - prevPeriodStats.sumBytesDown;
        const bytesUp = stats.sumBytesUp - prevPeriodStats.sumBytesUp;
        const bytesDownPerSecond = (bytesDown * 1000) / durationMs;
        const bytesUpPerSecond = (bytesUp * 1000) / durationMs;
        return {
            bytesDownPerSecond,
            bytesUpPerSecond,
            sumBytesDown: stats.sumBytesDown,
            sumBytesUp: stats.sumBytesUp,
            numConnections: stats.numConnections,
        };
    }, [prevPeriodStats, stats]);
    return periodStats;
}

function displayBytes(bytes: number, fractionDigits = 2): string {
    let mibs = bytes / 1048576;
    let unit = "Mi";
    let minFractionDigits = fractionDigits;
    let maxFractionDigits = fractionDigits;
    if (mibs > 10) {
        maxFractionDigits = Math.min(1, maxFractionDigits);
        if (mibs > 100) {
            maxFractionDigits = 0;
            if (mibs > 1024) {
                unit = "Gi";
                mibs /= 1024;
                minFractionDigits = 1;
                maxFractionDigits = 1;
                if (mibs > 10) {
                    minFractionDigits = 0;
                    maxFractionDigits = 0;
                }
            }
        }
    }
    return (
        mibs.toLocaleString(undefined, {
            useGrouping: true,
            minimumFractionDigits: Math.min(
                minFractionDigits,
                maxFractionDigits
            ),
            maximumFractionDigits: maxFractionDigits,
        }) + unit
    );
}
