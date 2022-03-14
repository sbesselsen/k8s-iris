import { Box, VStack } from "@chakra-ui/react";
import React, {
    Fragment,
    ReactElement,
    useCallback,
    useEffect,
    useMemo,
    useRef,
} from "react";
import { useAppRoute, useAppRouteActions } from "../../context/route";
import { usePageTitle } from "../../hook/page-title";
import { ContextSelectMenu } from "../k8s-context/ContextSelectMenu";
import { AppFrame } from "../../component/main/AppFrame";
import { useColorThemeStore } from "../../context/color-theme";
import { useK8sContext } from "../../context/k8s-context";
import { useK8sContextsInfo } from "../../hook/k8s-contexts-info";
import { k8sAccountIdColor } from "../../util/k8s-context-color";
import { SearchInput } from "../../component/main/SearchInput";
import { useAppSearch, useAppSearchStore } from "../../context/search";
import {
    SidebarMainMenu,
    SidebarMainMenuItem,
    SidebarNamespacesMenu,
} from "../../component/main/SidebarMenu";
import { SiKubernetes } from "react-icons/si";
import { BsBox } from "react-icons/bs";
import { useK8sListWatch } from "../../k8s/list-watch";
import { useKeyListener, useModifierKeyRef } from "../../hook/keyboard";
import { ClusterError } from "./ClusterError";
import { useIpcCall } from "../../hook/ipc";
import { AppNamespacesSelection } from "../../../common/route/app-route";
import { ResourcesOverview } from "../resources/ResourcesOverview";

export const RootAppUI: React.FunctionComponent = () => {
    const appRoute = useAppRoute();
    const colorThemeStore = useColorThemeStore();

    const kubeContext = useK8sContext();
    usePageTitle(kubeContext);

    const [_loadingContextsInfo, contextsInfo] = useK8sContextsInfo();

    const searchStore = useAppSearchStore();
    const searchValue = useAppSearch();
    const searchBoxRef = useRef<HTMLInputElement>();
    const contextSelectMenuRef = useRef<HTMLButtonElement>();

    const metaKeyRef = useModifierKeyRef("Meta");
    const shiftKeyRef = useModifierKeyRef("Shift");
    useKeyListener(
        useCallback(
            (eventType, key) => {
                if (
                    eventType === "keydown" &&
                    metaKeyRef.current &&
                    key === "f"
                ) {
                    searchBoxRef.current.focus();
                }
                if (
                    eventType === "keydown" &&
                    metaKeyRef.current &&
                    shiftKeyRef.current &&
                    key === "o"
                ) {
                    contextSelectMenuRef.current.click();
                }
            },
            [metaKeyRef, searchBoxRef]
        )
    );

    const { namespaces: namespacesSelection, menuItem } = useAppRoute();
    const { selectNamespaces, selectMenuItem } = useAppRouteActions();

    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);

    const [loadingNamespaces, namespaces, namespacesError] = useK8sListWatch(
        {
            apiVersion: "v1",
            kind: "Namespace",
        },
        []
    );

    const onChangeNamespacesSelection = useCallback(
        (
            namespaces: AppNamespacesSelection,
            requestNewWindow: boolean = false
        ) => {
            if (requestNewWindow) {
                createWindow({
                    route: {
                        ...appRoute,
                        namespaces,
                    },
                });
            } else {
                selectNamespaces(namespaces);
            }
        },
        [appRoute, createWindow, selectNamespaces]
    );

    const setSearchValue = useCallback(
        (query: string) => {
            searchStore.set({ query });
        },
        [searchStore]
    );

    const contextualColorTheme = useMemo(() => {
        const contextInfo = contextsInfo?.find(
            (ctx) => ctx.name === kubeContext
        );
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

    const sidebarMainMenuItems: SidebarMainMenuItem[] = useMemo(
        () => [
            {
                id: "cluster",
                iconType: SiKubernetes,
                title: "Cluster",
            },
            {
                id: "resources",
                iconType: BsBox,
                title: "Resources",
            },
        ],
        []
    );

    const onChangeMenuItemSelection = useCallback(
        (selection: string, requestNewWindow: boolean = false) => {
            if (requestNewWindow) {
                createWindow({
                    route: {
                        ...appRoute,
                        menuItem: selection,
                    },
                });
            } else {
                selectMenuItem(selection);
            }
        },
        [createWindow, selectMenuItem]
    );

    const isReady = contextualColorTheme !== null;

    useEffect(() => {
        document.body.classList.toggle("app-ui-mounted", isReady);
    }, [isReady]);

    if (!isReady) {
        return null;
    }

    return (
        <Fragment>
            <AppFrame
                title={
                    <Box p={2} maxWidth="300px" mx="auto">
                        <ContextSelectMenu ref={contextSelectMenuRef} />
                    </Box>
                }
                search={
                    <Box px={2} py={2}>
                        <SearchInput
                            value={searchValue.query}
                            onChange={setSearchValue}
                            ref={searchBoxRef}
                        />
                    </Box>
                }
                sidebar={
                    <VStack h="100%" position="relative" alignItems="stretch">
                        <SidebarMainMenu
                            items={sidebarMainMenuItems}
                            selection={menuItem}
                            onChangeSelection={onChangeMenuItemSelection}
                        />
                        <SidebarNamespacesMenu
                            selection={namespacesSelection}
                            onChangeSelection={onChangeNamespacesSelection}
                            isLoading={loadingNamespaces}
                            namespaces={namespaces?.items ?? []}
                        />
                    </VStack>
                }
                content={
                    namespacesError ? (
                        <Box
                            w="100%"
                            height="100%"
                            overflow="hidden scroll"
                            sx={{ scrollbarGutter: "stable" }}
                        >
                            <ClusterError error={namespacesError} />
                        </Box>
                    ) : (
                        <ResourcesOverview />
                    )
                }
            />
        </Fragment>
    );
};

const repeat = (n: number, content: ReactElement): Array<ReactElement> => {
    return [...Array(n)].map((_, i) => <Fragment key={i}>{content}</Fragment>);
};
