import { Box, HStack, VStack } from "@chakra-ui/react";
import React, {
    Fragment,
    ReactNode,
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
} from "react";
import {
    useAppRoute,
    useAppRouteGetter,
    useAppRouteSetter,
} from "../../context/route";
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
    SidebarEditorsMenu,
    SidebarNamespacesMenu,
} from "../../component/main/SidebarMenu";
import { SiKubernetes } from "react-icons/si";
import { BsBox } from "react-icons/bs";
import { useK8sListWatch } from "../../k8s/list-watch";
import { useKeyListener, useModifierKeyRef } from "../../hook/keyboard";
import { ClusterError } from "./ClusterError";
import { useIpcCall } from "../../hook/ipc";
import { AppNamespacesSelection } from "../../../common/route/app-route";
import { AppToolbar } from "./AppToolbar";
import { ParamNamespace, useAppParam } from "../../context/param";
import { k8sSmartCompare } from "../../../common/util/sort";
import { ContextUnlockButton } from "../k8s-context/ContextUnlockButton";
import { useAppEditors, useAppEditorsSetter } from "../../context/editors";

const ClusterOverview = React.lazy(async () => ({
    default: (await import("../cluster/ClusterOverview")).ClusterOverview,
}));
const ResourcesOverview = React.lazy(async () => ({
    default: (await import("../resources/ResourcesOverview")).ResourcesOverview,
}));
const ResourceEditor = React.lazy(async () => ({
    default: (await import("../editor/ResourceEditor")).ResourceEditor,
}));

export const RootAppUI: React.FunctionComponent = () => {
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

    const namespacesSelection = useAppRoute((route) => route.namespaces);
    const [menuItem, setMenuItem] = useAppParam("menuItem", "cluster");

    const getAppRoute = useAppRouteGetter();
    const setAppRoute = useAppRouteSetter();

    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);

    const [loadingNamespaces, namespaces, namespacesError] = useK8sListWatch(
        {
            apiVersion: "v1",
            kind: "Namespace",
        },
        {},
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
                        ...getAppRoute(),
                        namespaces,
                    },
                });
            } else {
                const oldRoute = getAppRoute();
                const createHistoryItem =
                    namespaces.mode !== oldRoute.namespaces.mode ||
                    (namespaces.mode === "selected" &&
                        namespaces.selected.length === 1);
                return setAppRoute(
                    () => ({ ...oldRoute, namespaces }),
                    !createHistoryItem
                );
            }
        },
        [createWindow, getAppRoute, setAppRoute]
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

    const selectedEditor = useAppEditors((editors) => editors.selected);
    const setAppEditors = useAppEditorsSetter();

    const onChangeMenuItemSelection = useCallback(
        (selection: string, requestNewWindow: boolean = false) => {
            if (requestNewWindow) {
                createWindow({
                    route: setMenuItem.asRoute(
                        selection,
                        setAppEditors.asRoute((editors) => ({
                            ...editors,
                            selected: undefined,
                        }))
                    ),
                });
            } else {
                setAppEditors((editors) => ({
                    ...editors,
                    selected: undefined,
                }));
                setMenuItem(selection);
            }
        },
        [createWindow, setAppEditors, setMenuItem]
    );

    const sortedNamespaces = useMemo(
        () =>
            [...(namespaces?.items ?? [])].sort((x, y) =>
                k8sSmartCompare(x.metadata.name, y.metadata.name)
            ),
        [namespaces]
    );

    const isReady = contextualColorTheme !== null;

    const editors = useAppEditors((editors) => editors.items ?? []);

    const onChangeSelectedEditor = useCallback(
        (id: string | undefined) => {
            if (metaKeyRef.current) {
                if (id) {
                    // Open a window with only the specified editor.
                    createWindow({
                        route: setAppEditors.asRoute((editors) => ({
                            ...editors,
                            selected: id,
                            items: editors.items?.filter((e) => e.id === id),
                        })),
                    });
                }
            } else {
                setAppEditors((editors) => ({ ...editors, selected: id }));
            }
        },
        [createWindow, metaKeyRef, setAppEditors]
    );

    const onCloseEditor = useCallback(
        (id: string) => {
            setAppEditors((editors) => ({
                ...editors,
                selected:
                    editors.selected === id ? undefined : editors.selected,
                items: editors.items?.filter((editor) => editor.id !== id),
            }));
        },
        [setAppEditors]
    );

    useEffect(() => {
        document.body.classList.toggle("app-ui-mounted", isReady);
    }, [isReady]);

    if (!isReady) {
        return null;
    }

    return (
        <Fragment>
            <AppFrame
                toolbar={<AppToolbar />}
                title={
                    <HStack p={2} spacing="2px" maxWidth="350px" mx="auto">
                        <ContextSelectMenu ref={contextSelectMenuRef} />
                        <ContextUnlockButton />
                    </HStack>
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
                    <VStack
                        h="100%"
                        spacing={6}
                        position="relative"
                        alignItems="stretch"
                    >
                        <SidebarMainMenu
                            items={sidebarMainMenuItems}
                            selection={selectedEditor ? undefined : menuItem}
                            onChangeSelection={onChangeMenuItemSelection}
                        />
                        {editors.length > 0 && (
                            <SidebarEditorsMenu
                                items={editors}
                                selection={selectedEditor}
                                onChangeSelection={onChangeSelectedEditor}
                                onCloseEditor={onCloseEditor}
                            />
                        )}
                        <SidebarNamespacesMenu
                            selection={namespacesSelection}
                            onChangeSelection={onChangeNamespacesSelection}
                            isLoading={loadingNamespaces}
                            namespaces={sortedNamespaces}
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
                        <AppContent
                            menuItem={menuItem}
                            editor={selectedEditor}
                        />
                    )
                }
            />
        </Fragment>
    );
};

const appComponents: Record<string, ReactNode> = {
    resources: <ResourcesOverview />,
    cluster: <ClusterOverview />,
};

type AppContentProps = {
    menuItem: string | undefined;
    editor: string | undefined;
};

const AppContent: React.FC<AppContentProps> = (props) => {
    const { editor, menuItem } = props;

    const editorDefs = useAppEditors((editors) => editors.items ?? []);
    const editorDef = useMemo(
        () => editorDefs.find((e) => e.id === editor),
        [editor, editorDefs]
    );

    return (
        <Suspense fallback={<Box />}>
            {menuItem && !editor && (
                <ParamNamespace name={menuItem}>
                    {appComponents[menuItem] ?? <Box />}
                </ParamNamespace>
            )}
            {editor && (
                <ParamNamespace name="editor">
                    <ResourceEditor editorResource={editorDef} />
                </ParamNamespace>
            )}
        </Suspense>
    );
};
