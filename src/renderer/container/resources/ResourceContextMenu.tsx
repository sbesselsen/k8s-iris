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
    object: K8sObject | K8sObjectIdentifier;
}>;

export const ResourceContextMenu: React.FC<ResourceContextMenuProps> = (
    props
) => {
    const { object, children } = props;
    const objects = useMemo(() => [object], [object]);

    const popup = useIpcCall((ipc) => ipc.contextMenu.popup);
    const getActionsRef = useRef<() => Array<Array<ActionTemplate>>>(() => []);

    const onContextMenu: MouseEventHandler = useCallback(
        (e) => {
            e.preventDefault();
            const actions = getActionsRef.current?.();
            if (!actions || actions.length === 0) {
                return;
            }
            const menuTemplate: ContextMenuTemplate = [];
            const actionHandlers: Record<
                string,
                (result: ActionClickResult) => void | Promise<void>
            > = {};
            for (const actionGroup of actions) {
                for (const action of actionGroup) {
                    const { onClick, ...menuItemProps } = action;
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
                    actionHandlers[result.actionId]?.(result);
                }
            });
        },
        [getActionsRef, popup]
    );

    const mappedChildren = React.Children.map(children, (child: any) =>
        React.cloneElement(child, {
            onContextMenu,
        })
    );

    return (
        <>
            {mappedChildren}
            <ActionsCollector objects={objects} getActionsRef={getActionsRef} />
        </>
    );
};
