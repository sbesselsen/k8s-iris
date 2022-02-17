import { Box, chakra, HStack } from "@chakra-ui/react";
import React, { Fragment } from "react";
import { OverviewStyle, useAppRoute } from "../../context/route";
import { usePageTitle } from "../../hook/page-title";
import { ContextSelectMenu } from "../k8s-context/ContextSelectMenu";
import { NamespacesSelectMenu } from "../k8s-namespace/NamespacesSelectMenu";
import { Sticky, stickToTopAndScrollDown } from "react-unstuck";
import { OverviewStyleSelectMenu } from "../overview-style/OverviewStyleSelectMenu";
import { ClusterError } from "./ClusterError";
import { useK8sStatus } from "../../hook/k8s-status";

const ChakraSticky = chakra(Sticky);

const OverviewComponents: Record<OverviewStyle, React.FC> = {
    cluster_info: () => <Box>cluster_info</Box>,
    cluster_nodes: () => <Box>cluster_nodes</Box>,
    applications: () => <Box>applications</Box>,
    custom_objects: () => <Box>custom_objects</Box>,
};

export const RootAppUI: React.FunctionComponent = () => {
    const { context, overviewStyle } = useAppRoute();
    const { status, error } = useK8sStatus();

    usePageTitle(context);

    const Overview = OverviewComponents[overviewStyle];

    return (
        <Fragment>
            <ChakraSticky
                behavior={stickToTopAndScrollDown}
                bg="rgba(255, 255, 255, 0.8)"
                backdropFilter="blur(4px)"
            >
                <HStack spacing={2} padding={2}>
                    <ContextSelectMenu />
                    <NamespacesSelectMenu />
                    <OverviewStyleSelectMenu />
                </HStack>
            </ChakraSticky>
            {status === "error" && <ClusterError error={error} />}
            {status === "ok" && (
                <Box minHeight="100vh">
                    <Overview />
                </Box>
            )}
        </Fragment>
    );
};
