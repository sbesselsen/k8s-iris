import { PropsWithChildren, useEffect, useMemo } from "react";
import { useColorTheme, useColorThemeStore } from "./AppThemeProvider";
import { useOptionalK8sContext } from "../../context/k8s-context";
import { useK8sContextsInfo } from "../../hook/k8s-contexts-info";
import { k8sAccountIdColor } from "../../util/k8s-context-color";

export const AppContextualColorThemeProvider: React.FC<PropsWithChildren> = (
    props
) => {
    const { children } = props;

    const isReady = useColorTheme((t) => t !== null);

    return (
        <>
            <ContextsInfoWatcher />
            {isReady && children}
        </>
    );
};

const ContextsInfoWatcher: React.FC<{}> = () => {
    const [isLoadingContextsInfo, contextsInfo] = useK8sContextsInfo();
    const colorThemeStore = useColorThemeStore();

    const kubeContext = useOptionalK8sContext();

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

    useEffect(() => {
        if (contextualColorTheme) {
            colorThemeStore.set(contextualColorTheme);
        }
    }, [colorThemeStore, contextualColorTheme]);

    return null;
};
