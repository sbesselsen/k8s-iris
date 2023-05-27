import { VStack } from "@chakra-ui/react";
import React, { useCallback, useMemo } from "react";
import {
    useAppRoute,
    useAppRouteGetter,
    useAppRouteSetter,
} from "../../context/route";
import { ContextSelectMenu } from "../k8s-context/ContextSelectMenu";
import {
    SidebarMainMenu,
    SidebarMainMenuItem,
    SidebarEditorsMenu,
    SidebarNamespacesMenu,
} from "../../component/main/SidebarMenu";
import { SiKubernetes } from "react-icons/si";
import { BsBox } from "react-icons/bs";
import { useK8sListWatch } from "../../k8s/list-watch";
import { useModifierKeyRef } from "../../hook/keyboard";
import { useIpcCall } from "../../hook/ipc";
import { AppNamespacesSelection } from "../../../common/route/app-route";
import { k8sSmartCompare } from "../../../common/util/sort";
import {
    newResourceEditor,
    useAppEditors,
    useAppEditorsStore,
} from "../../context/editors";
import { useLocalShellEditorOpener } from "../../hook/shell-opener";

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
export const defaultMenuItem = "cluster";

export const AppSidebar: React.FC<{}> = () => {
    return (
        <VStack
            px={2}
            h="100%"
            spacing={1}
            position="relative"
            alignItems="stretch"
        >
            <ContextSelectMenu />
            <AppMainMenu />
            <AppEditors />
            <AppNamespaces />
        </VStack>
    );
};

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

const AppNamespaces: React.FC<{}> = () => {
    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);
    const getAppRoute = useAppRouteGetter();
    const setAppRoute = useAppRouteSetter();
    const namespacesSelection = useAppRoute((route) => route.namespaces);

    const [loadingNamespaces, namespaces] = useK8sListWatch(
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
