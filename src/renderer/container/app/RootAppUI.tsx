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
import {
    AppEditor,
    AppNamespacesSelection,
    AppRoute,
} from "../../../common/route/app-route";
import { AppToolbar } from "./AppToolbar";
import { ParamNamespace, useAppParam } from "../../context/param";
import { k8sSmartCompare } from "../../../common/util/sort";
import { ContextUnlockButton } from "../k8s-context/ContextUnlockButton";
import { useAppEditors, useAppEditorsStore } from "../../context/editors";

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

    const editors = useAppEditors();
    const editorsStore = useAppEditorsStore();

    const getAppRoute = useAppRouteGetter();
    const setAppRoute = useAppRouteSetter();

    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);

    const searchStore = useAppSearchStore();
    const searchValue = useAppSearch();
    const searchBoxRef = useRef<HTMLInputElement>();
    const contextSelectMenuRef = useRef<HTMLButtonElement>();

    const createNewEditor = useCallback(() => {
        console.log("new");
    }, [editorsStore]);

    const metaKeyRef = useModifierKeyRef("Meta");
    const shiftKeyRef = useModifierKeyRef("Shift");
    useKeyListener(
        useCallback(
            (eventType, key, e) => {
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
                if (
                    eventType === "keydown" &&
                    metaKeyRef.current &&
                    key === "n"
                ) {
                    createNewEditor();
                }
                if (
                    eventType === "keydown" &&
                    metaKeyRef.current &&
                    key === "w"
                ) {
                    const activeEditorId = getAppRoute().activeEditor?.id;
                    if (activeEditorId) {
                        // Close the current editor.
                        let nextActiveEditor: AppEditor;
                        editorsStore.set((editors) => {
                            const removeEditorIndex = editors.findIndex(
                                (e) => e.id === activeEditorId
                            );
                            if (removeEditorIndex === -1) {
                                return editors;
                            }
                            const updatedEditors = editors.filter(
                                (_, i) => i !== removeEditorIndex
                            );
                            nextActiveEditor =
                                updatedEditors[
                                    Math.min(
                                        removeEditorIndex,
                                        updatedEditors.length - 1
                                    )
                                ];
                            setAppRoute(
                                (route) => ({
                                    ...route,
                                    activeEditor: nextActiveEditor ?? null,
                                }),
                                true
                            );
                            return updatedEditors;
                        });
                        e.preventDefault();
                    }
                }
            },
            [
                createNewEditor,
                metaKeyRef,
                editorsStore,
                getAppRoute,
                setAppRoute,
                searchBoxRef,
            ]
        )
    );

    const namespacesSelection = useAppRoute((route) => route.namespaces);
    const [menuItem, setMenuItem] = useAppParam("menuItem", "cluster");

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
                title: "Browse",
            },
        ],
        []
    );

    const selectedEditor = useAppRoute((route) => route.activeEditor)?.id;

    const onChangeMenuItemSelection = useCallback(
        (selection: string, requestNewWindow: boolean = false) => {
            const newRoute: AppRoute = {
                ...setMenuItem.asRoute(selection),
                activeEditor: null,
            };
            if (requestNewWindow) {
                createWindow({
                    route: newRoute,
                });
            } else {
                setAppRoute(() => newRoute);
            }
        },
        [createWindow, setMenuItem]
    );

    const sortedNamespaces = useMemo(
        () =>
            [...(namespaces?.items ?? [])].sort((x, y) =>
                k8sSmartCompare(x.metadata.name, y.metadata.name)
            ),
        [namespaces]
    );

    const isReady = contextualColorTheme !== null;

    const onChangeSelectedEditor = useCallback(
        (id: string | undefined) => {
            if (metaKeyRef.current) {
                if (id) {
                    // Open a window with only the specified editor.
                    createWindow({
                        route: {
                            ...getAppRoute(),
                            activeEditor: editors.find(
                                (editor) => editor.id === id
                            ),
                        },
                    });
                }
            } else {
                setAppRoute((route) => ({
                    ...route,
                    activeEditor: editors.find((editor) => editor.id === id),
                }));
            }
        },
        [createWindow, editors, metaKeyRef, getAppRoute, setAppRoute]
    );

    const onCloseEditor = useCallback(
        (id: string) => {
            editorsStore.set((editors) =>
                editors.filter((editor) => editor.id !== id)
            );
        },
        [editorsStore]
    );

    const onPressCreate = useCallback(() => {
        createNewEditor();
    }, [createNewEditor]);

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
                        <SidebarEditorsMenu
                            items={editors}
                            selection={selectedEditor}
                            onChangeSelection={onChangeSelectedEditor}
                            onCloseEditor={onCloseEditor}
                            onPressCreate={onPressCreate}
                        />
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

    const editorDefs = useAppEditors();
    const editorDef = useMemo(
        () => editorDefs.find((e) => e.id === editor),
        [editor, editorDefs]
    );

    return (
        <Suspense fallback={<Box />}>
            {menuItem && !editorDef && (
                <ParamNamespace name={menuItem}>
                    {appComponents[menuItem] ?? <Box />}
                </ParamNamespace>
            )}
            {editorDef && (
                <ParamNamespace name="editor">
                    <ResourceEditor editorResource={editorDef} />
                </ParamNamespace>
            )}
        </Suspense>
    );
};
