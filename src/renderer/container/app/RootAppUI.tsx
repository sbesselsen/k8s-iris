import {
    Box,
    Icon,
    Menu,
    MenuGroup,
    useColorModeValue,
} from "@chakra-ui/react";
import React, { Fragment, ReactElement, useEffect, useMemo } from "react";
import { useAppRoute } from "../../context/route";
import { usePageTitle } from "../../hook/page-title";
import { ContextSelectMenu } from "../k8s-context/ContextSelectMenu";
import { ClusterError } from "./ClusterError";
import { useK8sStatus } from "../../hook/k8s-status";
import { ClusterInfoOverview } from "../cluster-info/ClusterInfoOverview";
import { useIsDev } from "../../hook/dev";
import { AppFrame } from "../../component/AppFrame";
import { BoxMenuList } from "../../component/BoxMenuList";
import { GhostMenuItem } from "../../component/GhostMenuItem";
import { useColorTheme, useColorThemeStore } from "../../context/color-theme";
import { BsCheckCircleFill, BsCircle } from "react-icons/bs";
import { SiKubernetes } from "react-icons/si";
import { useK8sContext } from "../../context/k8s-context";
import { useK8sContextsInfo } from "../../hook/k8s-contexts-info";
import { k8sAccountIdColor } from "../../util/k8s-context-color";

export const RootAppUI: React.FunctionComponent = () => {
    const { context } = useAppRoute();
    const colorThemeStore = useColorThemeStore();
    const kubeContext = useK8sContext();
    const [loadingContextsInfo, contextsInfo] = useK8sContextsInfo();

    const contextualColorTheme = useMemo(() => {
        const contextInfo = contextsInfo?.find((ctx) => ctx.name === context);
        if (!contextInfo) {
            return null;
        }
        const accountId = contextInfo.cloudInfo?.accounts?.[0]?.accountId;
        return k8sAccountIdColor(accountId ?? null);
    }, [contextsInfo, kubeContext]);

    useEffect(() => {
        if (
            contextualColorTheme !== null &&
            colorThemeStore.get() !== contextualColorTheme
        ) {
            colorThemeStore.set(contextualColorTheme);
        }
    }, [colorThemeStore, contextualColorTheme]);

    usePageTitle(context);

    if (loadingContextsInfo) {
        return null;
    }

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
                        <TestMenu />
                    </Box>
                }
                content={<Box>{repeat(200, <p>right</p>)}</Box>}
            />
        </Fragment>
    );
};

const repeat = (n: number, content: ReactElement): Array<ReactElement> => {
    return [...Array(n)].map((_, i) => <Fragment key={i}>{content}</Fragment>);
};

const TestMenu: React.FC = () => {
    const { colorScheme } = useColorTheme();
    const menuGroupStyles = useMemo(
        () => ({
            ".chakra-menu__group__title": {
                color: colorScheme + ".500",
                fontWeight: "semibold",
                letterSpacing: "wide",
                fontSize: "xs",
                textTransform: "uppercase",
                marginStart: 4,
            },
        }),
        [colorScheme]
    );

    const iconColor = useColorModeValue(
        colorScheme + ".700",
        colorScheme + ".300"
    );
    const iconSize = 4;
    const checkedIcon = (
        <Icon
            verticalAlign="middle"
            w={iconSize}
            h={iconSize}
            as={BsCheckCircleFill}
            color={iconColor}
        />
    );
    const uncheckedIcon = (
        <Icon
            verticalAlign="middle"
            w={iconSize}
            h={iconSize}
            as={BsCircle}
            color={iconColor}
        />
    );

    const clusterIcon = (
        <Icon
            verticalAlign="middle"
            w={iconSize}
            h={iconSize}
            as={SiKubernetes}
            color={iconColor}
        />
    );

    const itemTextColor = useColorModeValue(
        colorScheme + ".900",
        colorScheme + ".200"
    );

    return (
        <Menu isOpen={true}>
            <BoxMenuList sx={menuGroupStyles}>
                <MenuGroup title="Cluster">
                    <GhostMenuItem
                        color={itemTextColor}
                        px={4}
                        icon={clusterIcon}
                    >
                        Cluster info
                    </GhostMenuItem>
                </MenuGroup>
                <MenuGroup title="Namespaces">
                    <GhostMenuItem
                        color={itemTextColor}
                        px={4}
                        icon={checkedIcon}
                    >
                        aap
                    </GhostMenuItem>
                    <GhostMenuItem
                        color={itemTextColor}
                        px={4}
                        icon={uncheckedIcon}
                    >
                        schaap
                    </GhostMenuItem>
                    <GhostMenuItem
                        color={itemTextColor}
                        px={4}
                        icon={uncheckedIcon}
                    >
                        blaat
                    </GhostMenuItem>
                    <GhostMenuItem
                        color={itemTextColor}
                        px={4}
                        icon={uncheckedIcon}
                    >
                        casper
                    </GhostMenuItem>
                    <GhostMenuItem
                        color={itemTextColor}
                        px={4}
                        icon={uncheckedIcon}
                    >
                        stella
                    </GhostMenuItem>
                    <GhostMenuItem
                        color={itemTextColor}
                        px={4}
                        icon={uncheckedIcon}
                    >
                        mama
                    </GhostMenuItem>
                    <GhostMenuItem
                        color={itemTextColor}
                        px={4}
                        icon={uncheckedIcon}
                    >
                        papa
                    </GhostMenuItem>
                </MenuGroup>
            </BoxMenuList>
        </Menu>
    );
};
