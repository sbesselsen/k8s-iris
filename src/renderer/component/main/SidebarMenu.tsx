import {
    Box,
    Button,
    ButtonGroup,
    Heading,
    Icon,
    Menu,
    MenuItemOption,
    MenuOptionGroup,
    useColorModeValue,
    VStack,
} from "@chakra-ui/react";
import React, { ElementType, ReactNode, useCallback } from "react";
import { BsCheckCircleFill, BsCircle } from "react-icons/bs";
import { K8sObject } from "../../../common/k8s/client";
import { AppNamespacesSelection } from "../../../common/route/app-route";
import { useColorTheme } from "../../context/color-theme";
import { useWindowFocusValue } from "../../hook/window-focus";
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

    return (
        <VStack mt={6} spacing={0}>
            {items.map((item) => (
                <SidebarMenuButton
                    key={item.id}
                    item={item}
                    isSelected={item.id === "resources"}
                />
            ))}
        </VStack>
    );
};

type SidebarMenuButtonProps = {
    item: SidebarMainMenuItem;
    isSelected?: boolean;
};

const SidebarMenuButton: React.FC<SidebarMenuButtonProps> = (props) => {
    const { item, isSelected = false } = props;

    const { colorScheme } = useColorTheme();

    const iconSize = 4;

    const itemTextColor = useColorModeValue(
        useWindowFocusValue(colorScheme + ".900", colorScheme + ".500"),
        useWindowFocusValue("white", colorScheme + ".400")
    );
    const iconColor = itemTextColor;
    const selectedTextColor = useWindowFocusValue(
        "white",
        colorScheme + ".400"
    );
    const hoverBackgroundColor = useColorModeValue(
        colorScheme + ".50",
        colorScheme + ".700"
    );
    const selectedBackgroundColor = useColorModeValue(
        useWindowFocusValue(colorScheme + ".500", colorScheme + ".500"),
        useWindowFocusValue(colorScheme + ".500", colorScheme + ".600")
    );
    const icon = item.iconType ? (
        <Icon
            verticalAlign="middle"
            w={iconSize}
            h={iconSize}
            as={item.iconType}
            color={isSelected ? selectedTextColor : iconColor}
        />
    ) : null;
    return (
        <Button
            bg="transparent"
            textColor={itemTextColor}
            px={4}
            leftIcon={icon}
            w="100%"
            justifyContent="start"
            fontWeight="normal"
            borderRadius={0}
            transition="none"
            _hover={{
                bg: hoverBackgroundColor,
            }}
            _active={{
                textColor: selectedTextColor,
                bg: selectedBackgroundColor,
            }}
            isActive={isSelected}
        >
            {item.title}
        </Button>
    );
};

export type SidebarNamespacesMenuProps = {
    isLoading?: boolean;
    namespaces: K8sObject[] | undefined;
    selection: AppNamespacesSelection;
    onChangeSelection: (selection: AppNamespacesSelection) => void;
};

export const SidebarNamespacesMenu: React.FC<SidebarNamespacesMenuProps> = (
    props
) => {
    const {
        isLoading = false,
        onChangeSelection,
        namespaces = [],
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

    const itemTextColor = useColorModeValue(colorScheme + ".900", "white");

    const namespacesToggleBorderColor = colorScheme + ".500";
    const namespacesToggleHoverColor = useColorModeValue(
        colorScheme + ".50",
        colorScheme + ".700"
    );

    const buildMenuItem = (namespace: K8sObject) => {
        const name = namespace.metadata.name;
        return (
            <MenuItemOption
                color={itemTextColor}
                px={4}
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
            </MenuItemOption>
        );
    };

    return (
        <Menu isOpen={true} closeOnBlur={false} closeOnSelect={false}>
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

            <Box px={4} flex="0 0 0">
                <ButtonGroup variant="outline" size="xs" isAttached>
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
            <BoxMenuList
                mt={6}
                display="flex"
                flex="1 0 0"
                flexDirection="column"
                overflow="hidden scroll"
                sx={{ scrollbarGutter: "stable" }}
                pb={2}
            >
                <MenuOptionGroup>
                    {namespaces.map(buildMenuItem)}
                </MenuOptionGroup>
            </BoxMenuList>
        </Menu>
    );
};
