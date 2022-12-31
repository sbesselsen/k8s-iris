import React, {
    createContext,
    MouseEventHandler,
    PropsWithChildren,
    useCallback,
    useContext,
    useMemo,
    useRef,
} from "react";
import { ContextMenuTemplate } from "../../../common/contextmenu";
import { K8sObject, K8sObjectIdentifier } from "../../../common/k8s/client";
import { toK8sObjectIdentifierString } from "../../../common/k8s/util";
import {
    ActionClickResult,
    ActionsCollector,
    ActionTemplate,
} from "../../action";
import { useIpcCall } from "../../hook/ipc";

const ResourceContextMenuContext = createContext<{
    getResources: () => Array<K8sObject | K8sObjectIdentifier>;
} | null>(null);

export type ResourceContextMenuProps = PropsWithChildren<{
    object?:
        | K8sObject
        | K8sObjectIdentifier
        | (() => K8sObject | K8sObjectIdentifier);
    objects?:
        | Array<K8sObject | K8sObjectIdentifier>
        | (() => Array<K8sObject | K8sObjectIdentifier>);
}>;

const getEmptyParentResources: () => Array<
    K8sObject | K8sObjectIdentifier
> = () => [];

export const ResourceContextMenu: React.FC<ResourceContextMenuProps> = (
    props
) => {
    const parentContext = useContext(ResourceContextMenuContext);
    const getParentResources =
        parentContext?.getResources ?? getEmptyParentResources;

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

    const subContext = useMemo(() => ({ getResources }), [getResources]);

    const popup = useIpcCall((ipc) => ipc.contextMenu.popup);
    const getActionsRef = useRef<
        (
            resources: Array<K8sObject | K8sObjectIdentifier>
        ) => Array<Array<ActionTemplate>>
    >(() => []);

    const onContextMenu: MouseEventHandler = useCallback(
        (e) => {
            e.preventDefault();
            e.stopPropagation();

            const resources = getResources();
            let parentResources = getParentResources();

            // If my resources are not a strict subset of my parent resources, ignore the parent resources.
            // Otherwise it gets confusing when I right-click a deselected item.
            const parentResourceIds = new Set(
                parentResources.map(toK8sObjectIdentifierString)
            );
            if (
                !resources.every((r) =>
                    parentResourceIds.has(toK8sObjectIdentifierString(r))
                )
            ) {
                parentResources = [];
            }

            const actionHandlers: Record<
                string,
                (result: ActionClickResult) => void | Promise<void>
            > = {};

            function menuTemplateFromActions(
                actions: ActionTemplate[][]
            ): ContextMenuTemplate {
                const menuTemplate: ContextMenuTemplate = [];
                for (const actionGroup of actions) {
                    for (const action of actionGroup) {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const { onClick, isVisible, ...menuItemProps } = action;
                        menuTemplate.push({
                            ...menuItemProps,
                            actionId: action.id,
                        });
                        actionHandlers[action.id] = onClick;
                    }
                    menuTemplate.push({ type: "separator" });
                }
                if (menuTemplate.length > 0) {
                    menuTemplate.pop();
                }
                return menuTemplate;
            }

            const actions = getActionsRef.current?.(resources);
            let menuTemplate = menuTemplateFromActions(actions);

            let handlerResources = resources;

            if (parentResources.length > resources.length) {
                // We also have resources from a parent context.
                const combinedActions =
                    getActionsRef.current?.(parentResources);
                menuTemplate = menuTemplateFromActions(combinedActions);
                handlerResources = parentResources;
            }

            if (menuTemplate.length > 0 && handlerResources.length > 1) {
                menuTemplate.unshift({
                    enabled: false,
                    label: `${handlerResources.length.toLocaleString()} selected items`,
                });
            }

            popup({
                menuTemplate,
            }).then((result) => {
                if (result.actionId) {
                    actionHandlers[result.actionId]?.({
                        ...result,
                        resources: handlerResources,
                    });
                }
            });
        },
        [getActionsRef, getParentResources, getResources, popup]
    );

    const mappedChildren = React.Children.map(children, (child: any) =>
        React.cloneElement(child, {
            onContextMenu,
        })
    );

    return (
        <>
            <ResourceContextMenuContext.Provider value={subContext}>
                {mappedChildren}
            </ResourceContextMenuContext.Provider>
            <ActionsCollector getActionsRef={getActionsRef} />
        </>
    );
};
