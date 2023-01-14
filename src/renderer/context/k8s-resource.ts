import React, {
    createElement,
    Fragment,
    PropsWithChildren,
    ReactNode,
    useCallback,
    useState,
} from "react";
import { K8sObject, K8sObjectIdentifier } from "../../common/k8s/client";
import { objSameRef } from "../../common/k8s/util";
import { apply, diff } from "../../common/util/diff";
import { useK8sListWatchListener } from "../k8s/list-watch";
import { create, createStore, transformUseStoreValue } from "../util/state";

type ResourceStoreValue = {
    resource: K8sObject | undefined;
    error: any | undefined;
    isLoading: boolean;
};

const loadingStoreValue: ResourceStoreValue = {
    resource: undefined,
    error: undefined,
    isLoading: true,
};

const { useStore, useStoreValue, useStoreValueGetter } =
    create<ResourceStoreValue>(loadingStoreValue);

export const useResourceValue = transformUseStoreValue(useStoreValue, (v) => {
    if (!v.resource) {
        throw new Error(
            "Cannot call useResoureValue() if no resource is provided"
        );
    }
    return v.resource;
});

export const useResourceGetter: () => () => K8sObject = () => {
    const getter = useStoreValueGetter();
    return useCallback(() => {
        const { resource } = getter();
        if (!resource) {
            throw new Error(
                "Cannot call useResourceGetter() if no resource is provided"
            );
        }
        return resource;
    }, [getter]);
};

export type ResourceContextProps = PropsWithChildren<{
    objectIdentifier: K8sObjectIdentifier;
    renderError?: (error: any) => ReactNode;
    renderLoading?: () => ReactNode;
    renderNotFound?: () => ReactNode;
}>;

export const ResourceContext: React.FC<ResourceContextProps> = (props) => {
    const {
        objectIdentifier,
        renderError,
        renderLoading,
        renderNotFound,
        children,
    } = props;
    const [store] = useState(() =>
        createStore<ResourceStoreValue>(loadingStoreValue)
    );

    const { apiVersion, kind, namespace, name } = objectIdentifier;

    useK8sListWatchListener(
        {
            apiVersion: apiVersion,
            kind: kind,
            ...(namespace ? { namespaces: [namespace] } : {}),
            fieldSelector: [{ name: "metadata.name", value: name }],
        },
        {
            onUpdate(message) {
                let resource: K8sObject | undefined = message.list.items[0];
                const { resource: prevResource } = store.get();
                if (!prevResource && !resource) {
                    // Nothing changed.
                    return;
                }
                if (
                    resource &&
                    prevResource &&
                    objSameRef(resource, prevResource)
                ) {
                    // Do a diff/apply so unchanged parts of the resource remain equal.
                    // This can improve rendering performance.
                    const resourceDiff = diff(prevResource, resource);
                    if (resourceDiff === null) {
                        // Nothing changed.
                        return;
                    }
                    resource = apply(prevResource, resourceDiff) as K8sObject;
                }
                store.set({ resource, error: undefined, isLoading: false });
            },
            onWatchError(error) {
                store.set({ resource: undefined, error, isLoading: false });
            },
        },
        [apiVersion, kind, namespace, name, store]
    );

    return createElement(
        useStore.Context.Provider,
        { value: store },
        createElement(
            ResourceContextInner,
            { renderError, renderLoading, renderNotFound },
            children
        )
    );
};

export const ResourceInjector: React.FC<{
    render: (resource: K8sObject) => ReactNode;
}> = (props) => {
    const { render } = props;
    const resource = useResourceValue();
    return createElement(Fragment, {}, render(resource));
};

type ResourceContextInnerProps = PropsWithChildren<{
    renderError?: (error: any) => ReactNode;
    renderLoading?: () => ReactNode;
    renderNotFound?: () => ReactNode;
}>;

const renderEmpty = () => null;
const ResourceContextInner: React.FC<ResourceContextInnerProps> = (props) => {
    const {
        renderError = renderEmpty,
        renderLoading = renderEmpty,
        renderNotFound = renderEmpty,
        children,
    } = props;
    const isLoading = useStoreValue((v) => v.isLoading);
    const error = useStoreValue((v) => v.error);
    const hasResource = useStoreValue((v) => !!v.resource);
    if (isLoading) {
        return createElement(Fragment, {}, renderLoading());
    }
    if (error) {
        return createElement(Fragment, {}, renderError(error));
    }
    if (!hasResource) {
        return createElement(Fragment, {}, renderNotFound());
    }
    return createElement(Fragment, {}, children);
};
