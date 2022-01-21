import {
    Box,
    Button,
    Menu,
    MenuButton,
    MenuDivider,
    MenuItemOption,
    MenuList,
    MenuOptionGroup,
    Spinner,
    useDisclosure,
} from "@chakra-ui/react";
import React, { ChangeEvent, useCallback, useMemo, useState } from "react";
import { MenuInput } from "../../component/MenuInput";
import { useAppRouteActions } from "../../context/route";
import { ChevronDownIcon } from "@chakra-ui/icons";
import { k8sSmartCompare } from "../../../common/util/sort";
import { menuGroupStylesHack } from "../../theme";
import { searchMatch } from "../../../common/util/search";
import { useK8sNamespaces } from "../../context/k8s-namespaces";
import { useK8sListWatch } from "../../k8s/list-watch";

export const NamespacesSelectMenu: React.FC = () => {
    const selectedNamespaces = useK8sNamespaces();
    const { selectNamespaces } = useAppRouteActions();

    const [isLoading, namespacesList] = useK8sListWatch(
        {
            apiVersion: "v1",
            kind: "Namespace",
        },
        []
    );

    const [searchValue, setSearchValue] = useState("");

    const namespaces = useMemo(
        () =>
            (
                namespacesList?.items.map((item) => item.metadata.name) ??
                selectedNamespaces
            ).sort(k8sSmartCompare),
        [namespacesList]
    );
    const filteredNamespaces = useMemo(
        () => namespaces.filter((ns) => searchMatch(searchValue, ns)),
        [namespaces, searchValue]
    );

    const { isOpen, onOpen, onClose } = useDisclosure();

    const onChangeSearchInput = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            setSearchValue(e.target.value);
        },
        [setSearchValue]
    );

    const onPressSearchEnter = useCallback(() => {
        if (filteredNamespaces.length === 1) {
            selectNamespaces(filteredNamespaces);
            onClose();
        }
    }, [filteredNamespaces, onClose, selectNamespaces]);

    return (
        <Menu
            isOpen={isOpen}
            onOpen={onOpen}
            onClose={onClose}
            closeOnSelect={false}
        >
            <MenuButton as={Button} rightIcon={<ChevronDownIcon />}>
                {selectedNamespaces.join(", ") || "Namespaces"}
            </MenuButton>
            <MenuList
                maxHeight="300px"
                overflowY="scroll"
                sx={menuGroupStylesHack}
            >
                <MenuInput
                    placeholder="Search"
                    value={searchValue}
                    onChange={onChangeSearchInput}
                    onPressEnter={onPressSearchEnter}
                />
                <MenuDivider />
                {isLoading && (
                    <Box p={4}>
                        <Spinner />
                    </Box>
                )}
                <MenuOptionGroup
                    type="checkbox"
                    value={selectedNamespaces}
                    onChange={selectNamespaces as any}
                >
                    {filteredNamespaces.map((ns) => (
                        <MenuItemOption value={ns}>{ns}</MenuItemOption>
                    ))}
                </MenuOptionGroup>
            </MenuList>
        </Menu>
    );
};
