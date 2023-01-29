import { TriangleDownIcon } from "@chakra-ui/icons";
import { IconButton } from "@chakra-ui/react";
import React, {
    createContext,
    MouseEventHandler,
    PropsWithChildren,
    useCallback,
    useContext,
    useMemo,
} from "react";
import {
    ContextMenuOptions,
    ContextMenuTemplate,
} from "../../../common/contextmenu";
import { K8sObject, K8sObjectIdentifier } from "../../../common/k8s/client";
import { toK8sObjectIdentifierString } from "../../../common/k8s/util";
import {
    ActionClickResult,
    ActionTemplate,
    useActionsGetter,
} from "../../action";
import { useIpcCall } from "../../hook/ipc";

const ResourceContextMenuContext = createContext<{
    getResources: () => Array<K8sObject | K8sObjectIdentifier>;
    onContextMenu: MouseEventHandler;
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

    const popup = useIpcCall((ipc) => ipc.contextMenu.popup);
    const getActions = useActionsGetter();

    const onContextMenu: MouseEventHandler = useCallback(
        (e) => {
            e.preventDefault();
            e.stopPropagation();

            const isContextMenuButtonClick =
                e.currentTarget?.classList?.contains(
                    "resource-context-menu-trigger"
                ) ?? false;

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
                actions: ActionTemplate[][],
                actionResources: Array<K8sObject | K8sObjectIdentifier>
            ): ContextMenuTemplate {
                const menuTemplate: ContextMenuTemplate = [];
                for (const actionGroup of actions) {
                    for (const action of actionGroup) {
                        /* eslint-disable @typescript-eslint/no-unused-vars */
                        const {
                            onClick,
                            isVisible,
                            subOptions,
                            buttonIcon,
                            ...menuItemProps
                        } = action;
                        /* eslint-enable */
                        const actionSubOptions = subOptions?.(actionResources);
                        if (actionSubOptions !== undefined) {
                            console.log(
                                actionSubOptions.map(({ id, label }) => ({
                                    id,
                                    actionId: `${action.id}::${id}`,
                                    label,
                                }))
                            );
                            menuTemplate.push({
                                ...menuItemProps,
                                type: "submenu",
                                submenu: actionSubOptions.map(
                                    ({ id, label }) => ({
                                        id,
                                        actionId: `${action.id}::${id}`,
                                        label,
                                    })
                                ),
                            });
                            for (const option of actionSubOptions) {
                                actionHandlers[`${action.id}::${option.id}`] = (
                                    result
                                ) => {
                                    onClick({
                                        ...result,
                                        subOptionId: option.id,
                                    });
                                };
                            }
                        } else {
                            menuTemplate.push({
                                ...menuItemProps,
                                actionId: action.id,
                            });
                            actionHandlers[action.id] = onClick;
                        }
                    }
                    menuTemplate.push({ type: "separator" });
                }
                if (menuTemplate.length > 0) {
                    menuTemplate.pop();
                }
                return menuTemplate;
            }

            const actions = getActions(resources);
            let menuTemplate = menuTemplateFromActions(actions, resources);

            let handlerResources = resources;

            if (parentResources.length > resources.length) {
                // We also have resources from a parent context.
                const combinedActions = getActions(parentResources);
                menuTemplate = menuTemplateFromActions(
                    combinedActions,
                    parentResources
                );
                handlerResources = parentResources;
            }

            if (menuTemplate.length > 0 && handlerResources.length > 1) {
                menuTemplate.unshift({
                    enabled: false,
                    label: `${handlerResources.length.toLocaleString()} selected items`,
                });
            }

            const contextMenuOptions: ContextMenuOptions = {};
            if (isContextMenuButtonClick) {
                const rect = e.currentTarget.getBoundingClientRect();
                contextMenuOptions.position = {
                    x: Math.round(rect.left),
                    y: Math.round(rect.bottom),
                };
            }

            popup({
                menuTemplate,
                options: contextMenuOptions,
            }).then((result) => {
                if (result.actionId) {
                    actionHandlers[result.actionId]?.({
                        ...result,
                        resources: handlerResources,
                    });
                }
            });
        },
        [getActions, getParentResources, getResources, popup]
    );

    const subContext = useMemo(
        () => ({ getResources, onContextMenu }),
        [getResources, onContextMenu]
    );

    const mappedChildren = React.Children.map(children, (child: any) => {
        if (typeof child === "string") {
            return child;
        }
        return React.cloneElement(child, {
            onContextMenu,
        });
    });

    return (
        <ResourceContextMenuContext.Provider value={subContext}>
            {mappedChildren}
        </ResourceContextMenuContext.Provider>
    );
};

export const ResourceContextMenuTriggerButton: React.FC<{}> = () => {
    const context = useContext(ResourceContextMenuContext);
    if (!context) {
        throw new Error(
            "Cannot use ResourceContextMenuTriggerButton outside ResourceContextMenu container"
        );
    }
    return (
        <IconButton
            aria-label="Actions"
            title="Actions"
            onClick={context.onContextMenu}
            variant="unstyled"
            className="resource-context-menu-trigger"
            p={0}
            minWidth={6}
            h={4}
            size="xs"
            colorScheme="gray"
            _focus={{}}
            _focusVisible={{
                boxShadow: "outline",
            }}
            __css={{
                "&, & *": {
                    cursor: "pointer",
                },
            }}
            icon={<TriangleDownIcon w={2} h={2} />}
        />
    );
};
