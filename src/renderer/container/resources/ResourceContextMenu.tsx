import React, {
    MouseEventHandler,
    PropsWithChildren,
    useCallback,
    useMemo,
    useRef,
} from "react";
import { ContextMenuTemplate } from "../../../common/contextmenu";
import { K8sObject, K8sObjectIdentifier } from "../../../common/k8s/client";
import {
    ActionClickResult,
    ActionsCollector,
    ActionTemplate,
} from "../../action";
import { useIpcCall } from "../../hook/ipc";

export type ResourceContextMenuProps = PropsWithChildren<{
    object?:
        | K8sObject
        | K8sObjectIdentifier
        | (() => K8sObject | K8sObjectIdentifier);
    objects?:
        | Array<K8sObject | K8sObjectIdentifier>
        | (() => Array<K8sObject | K8sObjectIdentifier>);
}>;

export const ResourceContextMenu: React.FC<ResourceContextMenuProps> = (
    props
) => {
    const { object, objects, children } = props;
    const getResources = useCallback(() => {
        if (typeof objects === "function") {
            return objects();
        }
        if (objects) {
            return objects;
        }
        if (typeof object === "function") {
            return [object()];
        }
        if (object) {
            return [object];
        }
        return [];
    }, [object, objects]);

    const popup = useIpcCall((ipc) => ipc.contextMenu.popup);
    const getActionsRef = useRef<
        (
            resources: Array<K8sObject | K8sObjectIdentifier>
        ) => Array<Array<ActionTemplate>>
    >(() => []);

    const onContextMenu: MouseEventHandler = useCallback(
        (e) => {
            e.preventDefault();
            const resources = getResources();
            const actions = getActionsRef.current?.(resources);
            if (!actions || actions.length === 0) {
                return;
            }
            e.stopPropagation();

            const menuTemplate: ContextMenuTemplate = [];
            const actionHandlers: Record<
                string,
                (result: ActionClickResult) => void | Promise<void>
            > = {};
            for (const actionGroup of actions) {
                for (const action of actionGroup) {
                    const { onClick, isVisible, ...menuItemProps } = action;
                    menuTemplate.push({
                        ...menuItemProps,
                        actionId: action.id,
                    });
                    actionHandlers[action.id] = onClick;
                }
                menuTemplate.push({ type: "separator" });
            }
            menuTemplate.pop();

            popup({
                menuTemplate,
            }).then((result) => {
                if (result.actionId) {
                    actionHandlers[result.actionId]?.({ ...result, resources });
                }
            });
        },
        [getActionsRef, getResources, popup]
    );

    const mappedChildren = React.Children.map(children, (child: any) =>
        React.cloneElement(child, {
            onContextMenu,
        })
    );

    return (
        <>
            {mappedChildren}
            <ActionsCollector getActionsRef={getActionsRef} />
        </>
    );
};
