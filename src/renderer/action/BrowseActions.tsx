import React, { useCallback, useMemo } from "react";
import { Action, ActionGroup } from ".";
import { K8sObject, K8sObjectIdentifier } from "../../common/k8s/client";
import { toK8sObjectIdentifier } from "../../common/k8s/util";
import { useAppRouteGetter, useAppRouteSetter } from "../context/route";
import { useIpcCall } from "../hook/ipc";

export const BrowseActions: React.FC<{
    objects: Array<K8sObject | K8sObjectIdentifier>;
}> = ({ objects }) => {
    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);
    const getAppRoute = useAppRouteGetter();
    const setAppRoute = useAppRouteSetter();

    const allowBrowse = useMemo(
        () =>
            objects.length === 1 &&
            objects.every(
                (obj) => obj.kind === "Namespace" && obj.apiVersion === "v1"
            ),
        [objects]
    );

    const onClickBrowse = useCallback(() => {
        const identifier = toK8sObjectIdentifier(objects[0]);
        setAppRoute((route) => ({
            ...route,
            activeEditor: null,
            namespaces: {
                mode: "selected",
                selected: [identifier.name],
            },
            menuItem: "resources",
            menuTab: { ...route.menuTab, resources: "workloads" },
        }));
    }, [objects, setAppRoute]);

    const onClickBrowseInNewWindow = useCallback(() => {
        const identifier = toK8sObjectIdentifier(objects[0]);
        const route = getAppRoute();
        createWindow({
            route: {
                ...route,
                activeEditor: null,
                namespaces: {
                    mode: "selected",
                    selected: [identifier.name],
                },
                menuItem: "resources",
                menuTab: { ...route.menuTab, resources: "workloads" },
            },
        });
    }, [objects, createWindow, getAppRoute]);

    if (!allowBrowse) {
        return null;
    }

    return (
        <ActionGroup>
            <Action id="browse" label="Browse" onClick={onClickBrowse} />
            <Action
                id="browseInNewWindow"
                label="Browse in New Window"
                onClick={onClickBrowseInNewWindow}
            />
        </ActionGroup>
    );
};
