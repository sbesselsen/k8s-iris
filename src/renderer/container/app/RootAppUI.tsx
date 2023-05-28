import { Box, Code, Heading, HStack, Icon, VStack } from "@chakra-ui/react";
import React, {
    Fragment,
    PropsWithChildren,
    ReactNode,
    Suspense,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import {
    useAppRoute,
    useAppRouteGetter,
    useAppRouteSetter,
} from "../../context/route";
import { usePageTitle } from "../../hook/page-title";
import { AppFrame } from "../../component/main/AppFrame";
import {
    useK8sContext,
    useOptionalK8sContext,
} from "../../context/k8s-context";
import { FaBomb } from "react-icons/fa";
import {
    K8sListWatchStoreValue,
    useK8sListWatchStore,
} from "../../k8s/list-watch";
import { useKeyListener, useModifierKeyRef } from "../../hook/keyboard";
import { ClusterError } from "./ClusterError";
import { AppEditor } from "../../../common/route/app-route";
import { AppToolbar } from "./AppToolbar";
import { ParamNamespace } from "../../context/param";
import {
    newResourceEditor,
    useAppEditors,
    useAppEditorsStore,
} from "../../context/editors";
import { LazyComponent } from "../../component/main/LazyComponent";
import { HibernateContainer } from "../../context/hibernate";
import { ErrorBoundary } from "../../component/util/ErrorBoundary";
import { NoContextError } from "./NoContextError";
import { AppSidebar, defaultMenuItem } from "../sidebar/AppSidebar";

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
    default: (await import("../k8s-context/ContextsOverview")).ContextsOverview,
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

export const RootAppUI: React.FunctionComponent = () => {
    console.log("Render root");

    const kubeContext = useOptionalK8sContext();
    usePageTitle(kubeContext ?? "Iris");

    const getAppRoute = useAppRouteGetter();
    const setAppRoute = useAppRouteSetter();

    const editorsStore = useAppEditorsStore();

    // Watch for errors.
    const [namespacesError, setNamespacesError] = useState<Error | undefined>();

    const searchBoxRef = useRef<HTMLInputElement>();

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

    const isContextsList = useAppRoute((r) => r.menuItem === "contexts");

    useEffect(() => {
        document.body.classList.toggle("app-ui-mounted");
    }, []);

    return (
        <Fragment>
            {kubeContext && <ErrorWatcher onChangeError={setNamespacesError} />}
            <AppFrame
                toolbar={<AppToolbar />}
                sidebar={kubeContext && <AppSidebar />}
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

const ErrorWatcher: React.FC<{
    onChangeError: (err: Error | undefined) => void;
}> = (props) => {
    const { onChangeError } = props;

    const prevErrorRef = useRef<Error | undefined>();

    const namespacesStore = useK8sListWatchStore(
        {
            apiVersion: "v1",
            kind: "Namespace",
        },
        {},
        []
    );
    useEffect(() => {
        const listener = (v: K8sListWatchStoreValue) => {
            if (v.error !== prevErrorRef.current) {
                prevErrorRef.current = v.error;
                onChangeError(v.error);
            }
        };
        listener(namespacesStore.get());
        namespacesStore.subscribe(listener);
        return () => {
            namespacesStore.unsubscribe(listener);
        };
    }, [onChangeError, prevErrorRef, namespacesStore]);

    return null;
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

const AppContentContainer: React.FC<
    PropsWithChildren<{ isVisible: boolean }>
> = (props) => {
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
