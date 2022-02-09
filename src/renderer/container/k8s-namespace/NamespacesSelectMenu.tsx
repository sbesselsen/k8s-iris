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
import { useModifierKeyRef } from "../../hook/keyboard";
import { useK8sContext } from "../../context/k8s-context";
import { useIpcCall } from "../../hook/ipc";

export const NamespacesSelectMenu: React.FC = () => {
    const selectedNamespaces = useK8sNamespaces();
    const { selectNamespaces } = useAppRouteActions();

    const context = useK8sContext();

    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);

    const [isLoading, namespacesList] = useK8sListWatch(
        {
            apiVersion: "v1",
            kind: "Namespace",
        },
        []
    );

    const metaKeyPressedRef = useModifierKeyRef("Meta");
    const shiftKeyPressedRef = useModifierKeyRef("Shift");

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

    const onChange = useCallback(
        (namespaces: string[]) => {
            if (shiftKeyPressedRef.current) {
                // We are selecting/deselecting multiple namespaces. Continue.
                selectNamespaces(namespaces);
                return;
            }

            let clickedNamespaces: string[] = [];

            // We are selecting/deselecting only one namespace.
            clickedNamespaces = selectedNamespaces.filter(
                (ns) => !namespaces.includes(ns)
            );
            if (clickedNamespaces.length === 0) {
                clickedNamespaces = namespaces.filter(
                    (ns) => !selectedNamespaces.includes(ns)
                );
            }
            if (clickedNamespaces.length === 0) {
                // Didn't select or deselect anything.
                return;
            }

            if (metaKeyPressedRef.current) {
                // Open in a new window.
                createWindow({
                    context,
                    namespaces: clickedNamespaces,
                });
            } else {
                selectNamespaces(clickedNamespaces);
                onClose();
            }
        },
        [context, createWindow, onClose, selectNamespaces, selectedNamespaces]
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
            <MenuButton
                as={Button}
                rightIcon={<ChevronDownIcon />}
                variant="ghost"
            >
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
                    onChange={onChange as any}
                >
                    {filteredNamespaces.map((ns) => (
                        <MenuItemOption value={ns}>{ns}</MenuItemOption>
                    ))}
                </MenuOptionGroup>
            </MenuList>
        </Menu>
    );
};
