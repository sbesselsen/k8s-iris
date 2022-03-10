import { Box, VStack } from "@chakra-ui/react";
import React, {
    Fragment,
    ReactElement,
    useCallback,
    useEffect,
    useMemo,
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

export const RootAppUI: React.FunctionComponent = () => {
    const { context } = useAppRoute();
    const colorThemeStore = useColorThemeStore();

    const kubeContext = useK8sContext();
    usePageTitle(context);

    const [loadingContextsInfo, contextsInfo] = useK8sContextsInfo();

    const searchStore = useAppSearchStore();
    const searchValue = useAppSearch();

    const { namespaces: namespacesSelection } = useAppRoute();
    const { selectNamespaces } = useAppRouteActions();

    const [loadingNamespaces, namespaces, namespacesError] = useK8sListWatch(
        {
            apiVersion: "v1",
            kind: "Namespace",
        },
        []
    );

    const setSearchValue = useCallback(
        (query: string) => {
            searchStore.set({ query });
        },
        [searchStore]
    );

    const contextualColorTheme = useMemo(() => {
        const contextInfo = contextsInfo?.find((ctx) => ctx.name === context);
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
                        <ContextSelectMenu />
                    </Box>
                }
                search={
                    <Box px={2} py={2}>
                        <SearchInput
                            value={searchValue.query}
                            onChange={setSearchValue}
                        />
                    </Box>
                }
                sidebar={
                    <VStack h="100%" position="relative" alignItems="stretch">
                        <SidebarMainMenu items={sidebarMainMenuItems} />
                        <SidebarNamespacesMenu
                            selection={namespacesSelection}
                            onChangeSelection={selectNamespaces}
                            isLoading={loadingNamespaces}
                            namespaces={namespaces?.items ?? []}
                        />
                    </VStack>
                }
                content={<Box>{repeat(200, <p>right</p>)}</Box>}
            />
        </Fragment>
    );
};

const repeat = (n: number, content: ReactElement): Array<ReactElement> => {
    return [...Array(n)].map((_, i) => <Fragment key={i}>{content}</Fragment>);
};
