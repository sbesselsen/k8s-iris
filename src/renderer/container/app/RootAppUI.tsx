import {
    Box,
    Button,
    Input,
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

export const RootAppUI: React.FunctionComponent = () => {
    const { context } = useAppRoute();

    usePageTitle(context);

    return (
        <Fragment>
            <ContextSelectMenu />
            <NamespacesSelectMenu />
            <Menu>
                <MenuButton as={Button} rightIcon={<ChevronDownIcon />}>
                    View
                </MenuButton>
                <MenuList>
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
        </Fragment>
    );
};
