import {
    Box,
    Button,
    chakra,
    HStack,
    Menu,
    MenuButton,
    MenuDivider,
    MenuGroup,
    MenuItem,
    MenuList,
} from "@chakra-ui/react";
import { ChevronDownIcon } from "@chakra-ui/icons";
import React, { Fragment } from "react";
import { useAppRoute } from "../../context/route";
import { usePageTitle } from "../../hook/page-title";
import { ContextSelectMenu } from "../k8s-context/ContextSelectMenu";
import { NamespacesSelectMenu } from "../k8s-namespace/NamespacesSelectMenu";
import { menuGroupStylesHack } from "../../theme";
import { Sticky, stickToTopAndScrollDown } from "react-unstuck";

const ChakraSticky = chakra(Sticky);

export const RootAppUI: React.FunctionComponent = () => {
    const { context } = useAppRoute();

    usePageTitle(context);

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
                    <Menu>
                        <MenuButton
                            as={Button}
                            rightIcon={<ChevronDownIcon />}
                            variant="ghost"
                        >
                            View
                        </MenuButton>
                        <MenuList sx={menuGroupStylesHack}>
                            <MenuGroup title="Cluster">
                                <MenuItem>Info</MenuItem>
                                <MenuItem>Nodes</MenuItem>
                            </MenuGroup>
                            <MenuDivider />
                            <MenuGroup title="Workloads">
                                <MenuItem>Applications</MenuItem>
                            </MenuGroup>
                            <MenuDivider />
                            <MenuGroup title="Objects">
                                <MenuItem>Custom objects</MenuItem>
                            </MenuGroup>
                        </MenuList>
                    </Menu>
                </HStack>
            </ChakraSticky>
            <Box>
                {Array(50)
                    .fill(0)
                    .map((_, i) => (
                        <p key={i}>test {i}</p>
                    ))}
            </Box>
        </Fragment>
    );
};
