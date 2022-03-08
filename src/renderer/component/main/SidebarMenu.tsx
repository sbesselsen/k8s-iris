import {
    Box,
    Button,
    ButtonGroup,
    Heading,
    Icon,
    Menu,
    useColorModeValue,
} from "@chakra-ui/react";
import React, { ElementType, ReactNode, useCallback } from "react";
import { BsCheckCircleFill, BsCircle } from "react-icons/bs";
import { K8sObject, K8sObjectList } from "../../../common/k8s/client";
import { AppNamespacesSelection } from "../../../common/route/app-route";
import { useColorTheme } from "../../context/color-theme";
import { BoxMenuList } from "../BoxMenuList";
import { GhostMenuItem } from "../GhostMenuItem";

export type SidebarMainMenuItem = {
    id: string;
    iconType?: ElementType;
    title: ReactNode;
};

export type SidebarMainMenuProps = {
    items: SidebarMainMenuItem[];
};

export const SidebarMainMenu: React.FC<SidebarMainMenuProps> = (props) => {
    const { items } = props;

    const { colorScheme } = useColorTheme();

    const iconColor = useColorModeValue(
        colorScheme + ".700",
        colorScheme + ".300"
    );
    const iconSize = 4;

    const itemTextColor = useColorModeValue(colorScheme + ".900", "white");

    const buildMenuItem = (item: SidebarMainMenuItem) => {
        const icon = item.iconType ? (
            <Icon
                verticalAlign="middle"
                w={iconSize}
                h={iconSize}
                as={item.iconType}
                color={iconColor}
            />
        ) : null;
        return (
            <GhostMenuItem
                color={itemTextColor}
                px={4}
                icon={icon}
                key={item.id}
            >
                {item.title}
            </GhostMenuItem>
        );
    };

    return (
        <Menu isOpen={true}>
            <BoxMenuList mt={2}>{items.map(buildMenuItem)}</BoxMenuList>
        </Menu>
    );
};

export type SidebarNamespacesMenuProps = {
    isLoading?: boolean;
    namespaces?: K8sObjectList<K8sObject> | undefined;
    selection: AppNamespacesSelection;
    onChangeSelection: (selection: AppNamespacesSelection) => void;
};

export const SidebarNamespacesMenu: React.FC<SidebarNamespacesMenuProps> = (
    props
) => {
    const {
        isLoading = false,
        onChangeSelection,
        namespaces,
        selection,
    } = props;

    const onClickAll = useCallback(() => {
        onChangeSelection({
            ...selection,
            mode: "all",
        });
    }, [selection, onChangeSelection]);
    const onClickSelected = useCallback(() => {
        onChangeSelection({
            ...selection,
            mode: "selected",
        });
    }, [selection, onChangeSelection]);

    const { colorScheme } = useColorTheme();

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

    const itemTextColor = useColorModeValue(colorScheme + ".900", "white");

    const namespacesToggleBorderColor = colorScheme + ".500";
    const namespacesToggleHoverColor = useColorModeValue(
        "white",
        colorScheme + ".700"
    );

    const selectedSet = new Set(selection.selected);

    const buildMenuItem = (namespace: K8sObject) => {
        const name = namespace.metadata.name;
        return (
            <GhostMenuItem
                color={itemTextColor}
                px={4}
                icon={selectedSet.has(name) ? checkedIcon : uncheckedIcon}
                key={name}
                fontSize="sm"
                py={1}
                sx={{
                    "& > span:last-child": {
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    },
                }}
            >
                {name}
            </GhostMenuItem>
        );
    };

    return (
        <Menu isOpen={true}>
            <Heading
                textColor={colorScheme + ".500"}
                fontWeight="semibold"
                letterSpacing="wide"
                fontSize="xs"
                textTransform="uppercase"
                px={4}
                pt={4}
            >
                Namespaces
            </Heading>
            <BoxMenuList
                mt={6}
                display="flex"
                flex="1 0 0"
                flexDirection="column"
            >
                <Box px={4} flex="0 0 0">
                    <ButtonGroup variant="outline" size="xs" isAttached pb={2}>
                        <Button
                            mr="-1px"
                            borderColor={namespacesToggleBorderColor}
                            textColor={itemTextColor}
                            isActive={selection.mode === "all"}
                            _active={{
                                bg: namespacesToggleBorderColor,
                                textColor: "white",
                            }}
                            _hover={{
                                bg: namespacesToggleHoverColor,
                            }}
                            onClick={onClickAll}
                        >
                            All
                        </Button>
                        <Button
                            borderColor={namespacesToggleBorderColor}
                            textColor={itemTextColor}
                            isActive={selection.mode === "selected"}
                            isLoading={isLoading}
                            _active={{
                                bg: namespacesToggleBorderColor,
                                textColor: "white",
                            }}
                            _hover={{
                                bg: namespacesToggleHoverColor,
                            }}
                            onClick={onClickSelected}
                        >
                            Selected
                        </Button>
                    </ButtonGroup>
                </Box>
                <Box
                    flex="1 0 0"
                    overflow="hidden scroll"
                    py={2}
                    sx={{ scrollbarGutter: "stable" }}
                >
                    {(namespaces?.items ?? []).map(buildMenuItem)}
                </Box>
            </BoxMenuList>
        </Menu>
    );
};
