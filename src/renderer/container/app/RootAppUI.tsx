import {
    Box,
    Button,
    ButtonGroup,
    Checkbox,
    CheckboxGroup,
    Heading,
    HStack,
    Menu,
    MenuItem,
    MenuList,
    Stack,
    useDisclosure,
} from "@chakra-ui/react";
import React, {
    Children,
    createContext,
    Fragment,
    ReactElement,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
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
import { AppFrame } from "../../component/AppFrame";

const OverviewComponents: Record<OverviewStyle, React.FC> = {
    cluster_info: ClusterInfoOverview,
    cluster_nodes: () => <Box>cluster_nodes</Box>,
    applications: () => <Box>applications</Box>,
    custom_objects: () => <Box>custom_objects</Box>,
};

export const RootAppUI: React.FunctionComponent = () => {
    const { context } = useAppRoute();

    usePageTitle(context);

    return (
        <Fragment>
            <AppFrame
                title={
                    <Box p={1}>
                        <ContextSelectMenu />
                    </Box>
                }
                header={<Box>hi</Box>}
                sidebar={
                    <Box position="relative">
                        <Menu isOpen={true}>
                            <MenuList
                                bg="transparent"
                                border="transparent"
                                boxShadow="none"
                                width="100%"
                            >
                                <MenuItem>aap</MenuItem>
                                <MenuItem>schaap</MenuItem>
                                <MenuItem>blaat</MenuItem>
                            </MenuList>
                        </Menu>
                    </Box>
                }
                content={<Box>{repeat(200, <p>right</p>)}</Box>}
                colorScheme="green"
            />
        </Fragment>
    );
};

const repeat = (n: number, content: ReactElement): Array<ReactElement> => {
    return [...Array(n)].map((_, i) => <Fragment key={i}>{content}</Fragment>);
};
