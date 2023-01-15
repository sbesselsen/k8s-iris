import { Icon } from "@chakra-ui/icons";
import React, { useCallback } from "react";
import { BsViewList } from "react-icons/bs";
import { Action, ActionClickResult, ActionGroup } from ".";
import { K8sObject, K8sObjectIdentifier } from "../../common/k8s/client";
import { toK8sObjectIdentifier } from "../../common/k8s/util";
import { useAppRouteGetter, useAppRouteSetter } from "../context/route";
import { useIpcCall } from "../hook/ipc";

export const BrowseActions: React.FC<{}> = () => {
    const createWindow = useIpcCall((ipc) => ipc.app.createWindow);
    const getAppRoute = useAppRouteGetter();
    const setAppRoute = useAppRouteSetter();

    const isVisible = useCallback(
        (resources: Array<K8sObject | K8sObjectIdentifier>) =>
            resources.length === 1 &&
            resources.every(
                (obj) => obj.kind === "Namespace" && obj.apiVersion === "v1"
            ),
        []
    );

    const onClickBrowse = useCallback(
        (result: ActionClickResult) => {
            const identifier = toK8sObjectIdentifier(result.resources[0]);
            if (result.metaKey) {
                const route = getAppRoute();
                createWindow({
                    route: {
                        ...route,
                        activeEditor: null,
                        isSidebarVisible: false,
                        namespaces: {
                            mode: "selected",
                            selected: [identifier.name],
                        },
                        menuItem: "resources",
                        menuTab: { ...route.menuTab, resources: "workloads" },
                    },
                });
            } else {
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
            }
        },
        [createWindow, getAppRoute, setAppRoute]
    );

    return (
        <ActionGroup>
            <Action
                id="browse"
                label="Browse"
                isVisible={isVisible}
                onClick={onClickBrowse}
                buttonIcon={<Icon as={BsViewList} />}
            />
        </ActionGroup>
    );
};
