import {
    Box,
    Button,
    ButtonGroup,
    Icon,
    Input,
    InputGroup,
    InputRightElement,
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
import { BsCheckCircleFill, BsCircle, BsBox } from "react-icons/bs";
import { SiKubernetes } from "react-icons/si";
import { useK8sContext } from "../../context/k8s-context";
import { useK8sContextsInfo } from "../../hook/k8s-contexts-info";
import { k8sAccountIdColor } from "../../util/k8s-context-color";
import { CheckIcon, SearchIcon } from "@chakra-ui/icons";
import { useWindowFocusValue } from "../../hook/window-focus";

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

    const { colorScheme } = contextualColorTheme ?? { colorScheme: "gray" };

    const searchBackground = useColorModeValue(
        colorScheme + useWindowFocusValue(".100", ".300"),
        colorScheme + useWindowFocusValue(".800", ".900")
    );
    const searchFocusedBackground = useColorModeValue("white", "black");
    const itemTextColor = useColorModeValue(colorScheme + ".900", "white");
    const itemPlaceholderColor = useColorModeValue(
        useWindowFocusValue(colorScheme + ".600", colorScheme + ".600"),
        useWindowFocusValue(colorScheme + ".100", colorScheme + ".400")
    );

    const iconColor = itemPlaceholderColor;

    if (loadingContextsInfo) {
        return null;
    }

    return (
        <Fragment>
            <AppFrame
                title={
                    <Box p={2} maxWidth="300px" mx="auto">
                        <ContextSelectMenu />
                    </Box>
                }
                search={
                    <Box px={2} py={2}>
                        <InputGroup size="sm">
                            <Input
                                placeholder="Search"
                                borderRadius="md"
                                bg={searchBackground}
                                border={0}
                                transition="none"
                                textColor={itemTextColor}
                                _placeholder={{
                                    textColor: itemPlaceholderColor,
                                }}
                                _focus={{
                                    bg: searchFocusedBackground,
                                }}
                                sx={{ WebkitAppRegion: "no-drag" }}
                            />
                            <InputRightElement
                                children={<SearchIcon />}
                                color={iconColor}
                            />
                        </InputGroup>
                    </Box>
                }
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
    const resourcesIcon = (
        <Icon
            verticalAlign="middle"
            w={iconSize}
            h={iconSize}
            as={BsBox}
            color={iconColor}
        />
    );

    const itemTextColor = useColorModeValue(colorScheme + ".900", "white");

    const namespacesToggleBorderColor = colorScheme + ".500";

    return (
        <Fragment>
            <Menu isOpen={true}>
                <BoxMenuList sx={menuGroupStyles} mt={2}>
                    <GhostMenuItem
                        color={itemTextColor}
                        px={4}
                        icon={clusterIcon}
                    >
                        Cluster
                    </GhostMenuItem>
                    <GhostMenuItem
                        color={itemTextColor}
                        px={4}
                        icon={resourcesIcon}
                    >
                        Resources
                    </GhostMenuItem>
                </BoxMenuList>
            </Menu>
            <Menu isOpen={true}>
                <BoxMenuList sx={menuGroupStyles} mt={6}>
                    <MenuGroup title="Namespaces">
                        <Box px={4}>
                            <ButtonGroup variant="outline" size="xs" isAttached>
                                <Button
                                    mr="-1px"
                                    borderColor={namespacesToggleBorderColor}
                                    textColor={itemTextColor}
                                >
                                    All
                                </Button>
                                <Button
                                    borderColor={namespacesToggleBorderColor}
                                    textColor={itemTextColor}
                                >
                                    Selected
                                </Button>
                            </ButtonGroup>
                        </Box>
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
        </Fragment>
    );
};
