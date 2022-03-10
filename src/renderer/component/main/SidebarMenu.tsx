import {
    Box,
    Button,
    ButtonGroup,
    Checkbox,
    CheckboxGroup,
    Collapse,
    Heading,
    Icon,
    useColorModeValue,
    VStack,
} from "@chakra-ui/react";
import React, { ElementType, Fragment, ReactNode, useCallback } from "react";
import { K8sObject } from "../../../common/k8s/client";
import { AppNamespacesSelection } from "../../../common/route/app-route";
import { useColorTheme } from "../../context/color-theme";
import { useWindowFocusValue } from "../../hook/window-focus";

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

    const opacity = useWindowFocusValue(1.0, 0.5);

    return (
        <VStack mt={6} spacing={0} opacity={opacity}>
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

    const itemTextColor = useColorModeValue(colorScheme + ".900", "white");
    const iconColor = itemTextColor;
    const selectedTextColor = "white";
    const hoverBackgroundColor = useColorModeValue(
        colorScheme + ".50",
        colorScheme + ".700"
    );
    const selectedBackgroundColor = useColorModeValue(
        colorScheme + ".500",
        colorScheme + ".500"
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

    const opacity = useWindowFocusValue(1.0, 0.5);

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

    const checkboxBorderColor = useColorModeValue(
        colorScheme + ".300",
        colorScheme + ".700"
    );

    const buildMenuItem = (namespace: K8sObject) => {
        const name = namespace.metadata.name;
        return (
            <Checkbox
                color={itemTextColor}
                px={4}
                key={name}
                size="sm"
                value={name}
                py={1}
                borderColor={checkboxBorderColor}
                flexShrink="0"
                isTruncated
            >
                <Box>{name}</Box>
            </Checkbox>
        );
    };

    return (
        <Fragment>
            <Heading
                textColor={colorScheme + ".500"}
                fontWeight="semibold"
                letterSpacing="wide"
                fontSize="xs"
                textTransform="uppercase"
                opacity={opacity}
                px={4}
                pt={4}
            >
                Namespaces
            </Heading>

            <Box px={4} flex="0 0 0" opacity={opacity}>
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
            <Box
                flex="1 0 0"
                overflow="hidden scroll"
                sx={{ scrollbarGutter: "stable" }}
                opacity={opacity}
            >
                <Collapse in={selection.mode === "selected"}>
                    <CheckboxGroup colorScheme={colorScheme}>
                        <VStack alignItems="start" spacing={0} pb={4}>
                            {namespaces.map(buildMenuItem)}
                        </VStack>
                    </CheckboxGroup>
                </Collapse>
            </Box>
        </Fragment>
    );
};
