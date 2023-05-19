import {
    Box,
    Code,
    Heading,
    HStack,
    Icon,
    useBreakpointValue,
    VStack,
} from "@chakra-ui/react";
import React, {
    Fragment,
    MutableRefObject,
    ReactNode,
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
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
import {
    useK8sContext,
    useOptionalK8sContext,
} from "../../context/k8s-context";
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
import { FaBomb } from "react-icons/fa";
import { useK8sListWatch } from "../../k8s/list-watch";
import { useKeyListener, useModifierKeyRef } from "../../hook/keyboard";
import { ClusterError } from "./ClusterError";
import { useIpcCall } from "../../hook/ipc";
import {
    AppEditor,
    AppNamespacesSelection,
} from "../../../common/route/app-route";
import { AppToolbar } from "./AppToolbar";
import { ParamNamespace } from "../../context/param";
import { k8sSmartCompare } from "../../../common/util/sort";
import {
    newResourceEditor,
    useAppEditors,
    useAppEditorsStore,
} from "../../context/editors";
import { LazyComponent } from "../../component/main/LazyComponent";
import { HibernateContainer } from "../../context/hibernate";
import { ErrorBoundary } from "../../component/util/ErrorBoundary";
import { useLocalShellEditorOpener } from "../../hook/shell-opener";
import { NoContextError } from "./NoContextError";

const PodLogsEditor = React.lazy(async () => ({
    default: (await import("../editor/PodLogsEditor")).PodLogsEditor,
}));
const PodShellEditor = React.lazy(async () => ({
    default: (await import("../editor/PodShellEditor")).PodShellEditor,
}));
const ClusterOverview = React.lazy(async () => ({
    default: (await import("../cluster/ClusterOverview")).ClusterOverview,
}));
const ResourcesOverview = React.lazy(async () => ({
    default: (await import("../resources/ResourcesOverview")).ResourcesOverview,
}));
const ContextsOverview = React.lazy(async () => ({
    default: (await import("../k8s-context/ContextSelectMenu"))
        .ContextsOverview,
}));
const ResourceEditor = React.lazy(async () => ({
    default: (await import("../editor/ResourceEditor")).ResourceEditor,
}));
const NewResourceEditor = React.lazy(async () => ({
    default: (await import("../editor/ResourceEditor")).NewResourceEditor,
}));
const LocalShellEditor = React.lazy(async () => ({
    default: (await import("../shell/LocalShellEditor")).LocalShellEditor,
}));

const sidebarMainMenuItems: SidebarMainMenuItem[] = [
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
];
const defaultMenuItem = "cluster";

export const RootAppUI: React.FunctionComponent = () => {
    console.log("Render root");

    const colorThemeStore = useColorThemeStore();

    const kubeContext = useOptionalK8sContext();
    usePageTitle(kubeContext ?? "Iris");

    const [isLoadingContextsInfo, contextsInfo] = useK8sContextsInfo();
    const isSidebarVisible = useAppRoute((route) => route.isSidebarVisible);

    const getAppRoute = useAppRouteGetter();
    const setAppRoute = useAppRouteSetter();

    const editorsStore = useAppEditorsStore();
    const [namespacesError, setNamespacesError] = useState<Error | undefined>();

    const searchBoxRef = useRef<HTMLInputElement>();
    const contextSelectMenuRef = useRef<HTMLButtonElement>();

    const ctrlKeyRef = useModifierKeyRef("Control");
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
                    searchBoxRef.current?.focus();
                }
                if (
                    eventType === "keydown" &&
                    metaKeyRef.current &&
                    shiftKeyRef.current &&
                    key === "o"
                ) {
                    contextSelectMenuRef.current?.click();
                }
                if (
                    eventType === "keydown" &&
                    ctrlKeyRef.current &&
                    key === "r"
                ) {
                    contextSelectMenuRef.current?.click();
                }
                if (
                    eventType === "keydown" &&
                    metaKeyRef.current &&
                    !shiftKeyRef.current &&
                    (getAppRoute().menuItem !== "resources" ||
                        getAppRoute().activeEditor) &&
                    key === "n"
                ) {
                    setAppRoute((route) => ({
                        ...route,
                        activeEditor: newResourceEditor(),
                    }));
                }
                if (
                    eventType === "keydown" &&
                    metaKeyRef.current &&
                    key === "b"
                ) {
                    setAppRoute(
                        (route) => ({
                            ...route,
                            isSidebarVisible: !route.isSidebarVisible,
                        }),
                        true
                    );
                }
                if (
                    eventType === "keydown" &&
                    metaKeyRef.current &&
                    key === "w"
                ) {
                    const activeEditorId = getAppRoute().activeEditor?.id;
                    if (
                        activeEditorId &&
                        editorsStore.get().length === 1 &&
                        !getAppRoute().isSidebarVisible
                    ) {
                        // This is a "one-issue window" which is only here to edit this one resource. Just let it close.
                        return;
                    }
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
                        // Show the sidebar after closing a resource to make it clear what the fuck is happening.
                        setAppRoute((route) =>
                            route.isSidebarVisible
                                ? route
                                : { ...route, isSidebarVisible: true }
                        );
                        e.preventDefault();
                    }
                }
            },
            [
                ctrlKeyRef,
                metaKeyRef,
                editorsStore,
                getAppRoute,
                setAppRoute,
                searchBoxRef,
                shiftKeyRef,
            ]
        )
    );

    const contextualColorTheme = useMemo(() => {
        if (isLoadingContextsInfo) {
            return null;
        }
        const contextInfo = contextsInfo?.find(
            (ctx) => ctx.name === kubeContext
        );
        if (!contextInfo) {
            return k8sAccountIdColor(null);
        }
        const accountId = contextInfo.cloudInfo?.accounts?.[0]?.accountId;
        return k8sAccountIdColor(accountId ?? null);
    }, [contextsInfo, isLoadingContextsInfo, kubeContext]);

    const onRequestSidebarVisibilityChange = useCallback(
        (visible: boolean) => {
            setAppRoute((route) => ({ ...route, isSidebarVisible: visible }));
        },
        [setAppRoute]
    );

    useEffect(() => {
        if (
            contextualColorTheme !== null &&
            colorThemeStore.get() !== contextualColorTheme
        ) {
            colorThemeStore.set(contextualColorTheme);
        }
    }, [colorThemeStore, contextualColorTheme]);

    const isContextsList = useAppRoute((r) => r.menuItem === "contexts");

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
                toolbar={<AppToolbar />}
                isSidebarVisible={isSidebarVisible}
                onRequestSidebarVisibilityChange={
                    onRequestSidebarVisibilityChange
                }
                title={
                    <HStack p={2} spacing="2px" maxWidth="300px" mx="auto">
                        <ContextSelectMenu
                            ref={
                                contextSelectMenuRef as MutableRefObject<HTMLButtonElement>
                            }
                        />
                    </HStack>
                }
                search={
                    <Box px={2} py={2}>
                        <AppSearchBox
                            ref={
                                searchBoxRef as MutableRefObject<HTMLInputElement>
                            }
                        />
                    </Box>
                }
                sidebar={
                    kubeContext && (
                        <VStack
                            h="100%"
                            spacing={6}
                            position="relative"
                            alignItems="stretch"
                        >
                            <AppMainMenu />
                            <AppEditors />
                            <AppNamespaces
                                onErrorStateChange={setNamespacesError}
                            />
                        </VStack>
                    )
                }
                content={
                    kubeContext ? (
                        namespacesError && !isContextsList ? (
                            <Box
                                w="100%"
                                height="100%"
                                overflow="hidden scroll"
                                sx={{ scrollbarGutter: "stable" }}
                            >
                                <ClusterError error={namespacesError} />
                            </Box>
                        ) : (
                            <AppContent />
                        )
                    ) : (
                        <NoContextError />
                    )
                }
            />
        </Fragment>
    );
};

const AppSearchBox = React.forwardRef<HTMLInputElement, {}>((props, ref) => {
    const searchStore = useAppSearchStore();
    const searchValue = useAppSearch();

    const setSearchValue = useCallback(
        (query: string) => {
            searchStore.set({ query });
        },
        [searchStore]
    );

    const shouldShowIcon = useBreakpointValue({ base: false, sm: true });

    return (
        <SearchInput
            shouldShowIcon={shouldShowIcon}
            value={searchValue.query}
            onChange={setSearchValue}
            ref={ref}
        />
    );
});

const AppMainMenu: React.FC<{}> = () => {
    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);
    const getAppRoute = useAppRouteGetter();
    const setAppRoute = useAppRouteSetter();

    const menuItem = useAppRoute((route) => route.menuItem ?? defaultMenuItem);
    const selectedEditor = useAppRoute((route) => route.activeEditor)?.id;

    const onChangeMenuItemSelection = useCallback(
        (menuItem: string, requestNewWindow = false) => {
            const newRoute = {
                ...getAppRoute(),
                menuItem,
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
        [createWindow, getAppRoute, setAppRoute]
    );

    return (
        <SidebarMainMenu
            items={sidebarMainMenuItems}
            selection={selectedEditor ? undefined : menuItem}
            onChangeSelection={onChangeMenuItemSelection}
        />
    );
};

const AppEditors: React.FC<{}> = () => {
    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);
    const getAppRoute = useAppRouteGetter();
    const setAppRoute = useAppRouteSetter();
    const metaKeyRef = useModifierKeyRef("Meta");

    const editors = useAppEditors();
    const editorsStore = useAppEditorsStore();

    const selectedEditor = useAppRoute((route) => route.activeEditor?.id);

    const onChangeSelectedEditor = useCallback(
        (id: string | undefined) => {
            if (metaKeyRef.current) {
                if (id) {
                    // Open a window with only the specified editor.
                    createWindow({
                        route: {
                            ...getAppRoute(),
                            isSidebarVisible: false,
                            activeEditor:
                                editors.find((editor) => editor.id === id) ??
                                null,
                        },
                    });
                }
            } else {
                setAppRoute((route) => ({
                    ...route,
                    activeEditor:
                        editors.find((editor) => editor.id === id) ?? null,
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
        const editor = newResourceEditor();
        if (metaKeyRef.current) {
            createWindow({
                route: {
                    ...getAppRoute(),
                    activeEditor: editor,
                    isSidebarVisible: false,
                },
            });
        } else {
            setAppRoute((route) => ({
                ...route,
                activeEditor: editor,
            }));
        }
    }, [createWindow, getAppRoute, setAppRoute, metaKeyRef]);

    const onPressCreateShell = useLocalShellEditorOpener();

    return (
        <SidebarEditorsMenu
            items={editors}
            selection={selectedEditor}
            onChangeSelection={onChangeSelectedEditor}
            onCloseEditor={onCloseEditor}
            onPressCreate={onPressCreate}
            onPressCreateShell={onPressCreateShell}
        />
    );
};

const AppNamespaces: React.FC<{
    onErrorStateChange: (error: Error | undefined) => void;
}> = (props) => {
    const { onErrorStateChange } = props;

    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);
    const getAppRoute = useAppRouteGetter();
    const setAppRoute = useAppRouteSetter();
    const namespacesSelection = useAppRoute((route) => route.namespaces);

    const [loadingNamespaces, namespaces, namespacesError] = useK8sListWatch(
        {
            apiVersion: "v1",
            kind: "Namespace",
        },
        {},
        []
    );

    const sortedNamespaces = useMemo(
        () =>
            [...(namespaces?.items ?? [])].sort((x, y) =>
                k8sSmartCompare(x.metadata.name, y.metadata.name)
            ),
        [namespaces]
    );

    // Propagate errors to parent component.
    const prevErrorRef = useRef<any>();
    useEffect(() => {
        if (prevErrorRef.current !== namespacesError) {
            onErrorStateChange(namespacesError);
            prevErrorRef.current = namespacesError;
        }
    }, [namespacesError, onErrorStateChange, prevErrorRef]);

    const onChangeNamespacesSelection = useCallback(
        (
            namespaces: AppNamespacesSelection,
            options: {
                requestNewWindow: boolean;
                requestBrowse: boolean;
            }
        ) => {
            const { requestNewWindow, requestBrowse } = options;
            const oldRoute = getAppRoute();
            let menuItem = oldRoute.menuItem;
            let menuTab = oldRoute.menuTab;
            let activeEditor = oldRoute.activeEditor;
            if (requestBrowse && (menuItem !== "resources" || activeEditor)) {
                // If the user clicks a single namespace, open the workloads overview.
                activeEditor = null;
                menuItem = "resources";
                menuTab = { ...menuTab, [menuItem]: "workloads" };
            }

            if (requestNewWindow) {
                createWindow({
                    route: {
                        ...oldRoute,
                        activeEditor,
                        menuItem,
                        menuTab,
                        namespaces,
                    },
                });
            } else {
                return setAppRoute(
                    () => ({
                        ...oldRoute,
                        activeEditor,
                        menuItem,
                        menuTab,
                        namespaces,
                    }),
                    !requestBrowse
                );
            }
        },
        [createWindow, getAppRoute, setAppRoute]
    );

    const onClickAddNamespace = useCallback(
        (options: { requestNewWindow: boolean }) => {
            const { requestNewWindow } = options;
            const editor = newResourceEditor({
                apiVersion: "v1",
                kind: "Namespace",
            });
            console.log({ requestNewWindow });
            if (requestNewWindow) {
                createWindow({
                    route: {
                        ...getAppRoute(),
                        isSidebarVisible: false,
                        activeEditor: editor,
                    },
                });
            } else {
                setAppRoute((route) => ({
                    ...route,
                    activeEditor: editor,
                }));
            }
        },
        [createWindow, getAppRoute, setAppRoute]
    );

    return (
        <SidebarNamespacesMenu
            selection={namespacesSelection}
            onChangeSelection={onChangeNamespacesSelection}
            onClickAddNamespace={onClickAddNamespace}
            isLoading={loadingNamespaces}
            namespaces={sortedNamespaces}
        />
    );
};

const appComponents: Record<string, ReactNode> = {
    resources: <ResourcesOverview />,
    cluster: <ClusterOverview />,
    contexts: <ContextsOverview />,
};

const AppContent: React.FC<{}> = () => {
    const editor = useAppRoute((route) => route.activeEditor)?.id;
    const menuItem = useAppRoute((route) => route.menuItem ?? defaultMenuItem);
    const editorDefs = useAppEditors();

    // Use the context in here to give everything a full state reset upon context change.
    // It ain't pretty but not using this would cause unacceptable slowness in this scenario:
    // * Open cluster A
    // * Open workloads overview
    // * Open cluster B
    // * Click a namespace in the left bar
    // Because the workloads overview remained active in the background (the default behaviour of LazyComponent + HibernateContainer),
    // it would fetch *all* resources in the entire cluster and then slowly filter that back to only the resources in the namespace.
    // I want a better solution.
    const context = useK8sContext();

    return (
        <Fragment key={context}>
            {Object.entries(appComponents).map(([key, component]) => {
                const isActive = key === menuItem && !editor;

                return (
                    <LazyComponent key={key} isActive={isActive}>
                        <ParamNamespace name={key}>
                            <HibernateContainer hibernate={!isActive}>
                                <AppContentContainer isVisible={isActive}>
                                    {component}
                                </AppContentContainer>
                            </HibernateContainer>
                        </ParamNamespace>
                    </LazyComponent>
                );
            })}
            {editorDefs.map((editorDef) => (
                <AppContentEditor
                    key={editorDef.id}
                    editor={editorDef}
                    isSelected={editorDef.id === editor}
                />
            ))}
        </Fragment>
    );
};

const AppContentError: React.FC<{ error: any }> = (props) => {
    const { error } = props;
    return (
        <HStack
            alignItems="start"
            spacing={4}
            mt={6}
            ms={4}
            me={12}
            maxWidth="800px"
        >
            <Box>
                <Icon as={FaBomb} w={10} h={10} />
            </Box>
            <VStack flex="1 0 0" alignItems="start">
                <Heading size="sm">Error</Heading>
                <Code variant="large" fontSize="sm" userSelect="text">
                    {error.message}
                </Code>
            </VStack>
        </HStack>
    );
};

const AppContentContainer: React.FC<{ isVisible: boolean }> = (props) => {
    const { isVisible, children } = props;
    const renderError = useCallback((error: any) => {
        return <AppContentError error={error} />;
    }, []);
    return (
        <VStack
            flex="1 0 0"
            alignItems="stretch"
            w="100%"
            h="100%"
            display={isVisible ? "flex" : "none"}
        >
            <ErrorBoundary renderError={renderError}>
                <Suspense fallback={<Box />}>{children}</Suspense>
            </ErrorBoundary>
        </VStack>
    );
};

const AppContentEditor: React.FC<{ editor: AppEditor; isSelected: boolean }> =
    React.memo((props) => {
        const { editor, isSelected } = props;

        return (
            <ParamNamespace name={`editor:${editor.id}`}>
                <HibernateContainer hibernate={!isSelected}>
                    <AppContentContainer isVisible={isSelected}>
                        {editor.type === "resource" && (
                            <ResourceEditor editorResource={editor} />
                        )}
                        {editor.type === "new-resource" && (
                            <NewResourceEditor
                                editorId={editor.id}
                                resourceType={
                                    editor.apiVersion && editor.kind
                                        ? {
                                              apiVersion: editor.apiVersion,
                                              kind: editor.kind,
                                          }
                                        : undefined
                                }
                            />
                        )}
                        {editor.type === "pod-shell" && (
                            <PodShellEditor
                                name={editor.name}
                                namespace={editor.namespace}
                                containerName={editor.containerName}
                            />
                        )}
                        {editor.type === "pod-logs" && (
                            <PodLogsEditor
                                name={editor.name}
                                namespace={editor.namespace}
                                containerName={editor.containerName}
                            />
                        )}
                        {editor.type === "local-shell" && <LocalShellEditor />}
                    </AppContentContainer>
                </HibernateContainer>
            </ParamNamespace>
        );
    });
