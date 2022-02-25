import { Box, Heading, HStack } from "@chakra-ui/react";
import React, { Fragment } from "react";
import { OverviewStyle, useAppRoute } from "../../context/route";
import { usePageTitle } from "../../hook/page-title";
import { ContextSelectMenu } from "../k8s-context/ContextSelectMenu";
import { NamespacesSelectMenu } from "../k8s-namespace/NamespacesSelectMenu";
import { OverviewStyleSelectMenu } from "../overview-style/OverviewStyleSelectMenu";
import { ClusterError } from "./ClusterError";
import { useK8sStatus } from "../../hook/k8s-status";
import { ClusterInfoOverview } from "../cluster-info/ClusterInfoOverview";
import { useK8sContextColorScheme } from "../../hook/k8s-context-color-scheme";
import { useIsDev } from "../../hook/dev";

const OverviewComponents: Record<OverviewStyle, React.FC> = {
    cluster_info: ClusterInfoOverview,
    cluster_nodes: () => <Box>cluster_nodes</Box>,
    applications: () => <Box>applications</Box>,
    custom_objects: () => <Box>custom_objects</Box>,
};

export const RootAppUI: React.FunctionComponent = () => {
    const { context, overviewStyle } = useAppRoute();
    const { status, error } = useK8sStatus();

    const colors = useK8sContextColorScheme();

    usePageTitle(context);

    const isDev = useIsDev();

    const Overview = OverviewComponents[overviewStyle];

    return (
        <Fragment>
            <Box
                width="300px"
                height="100vh"
                bg={colors.background}
                overflowY="scroll"
                position="fixed"
                top="0"
                left="0"
                p={2}
            >
                <ContextSelectMenu />
                {isDev && (
                    <Heading
                        textAlign="center"
                        fontSize="md"
                        textTransform="uppercase"
                        my={3}
                    >
                        Development version
                    </Heading>
                )}
            </Box>
            <Box paddingStart="300px">
                <HStack spacing={2} padding={2}>
                    <NamespacesSelectMenu />
                    <OverviewStyleSelectMenu />
                </HStack>
                {status === "error" && <ClusterError error={error} />}
                {status === "ok" && (
                    <Box minHeight="calc(100vh - 60px)">
                        <Overview />
                    </Box>
                )}
            </Box>
        </Fragment>
    );
};
