import React, {
    createContext,
    PropsWithChildren,
    ReactElement,
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react";
import { K8sObject, K8sObjectIdentifier } from "../../common/k8s/client";
import { create, createStore } from "../util/state";
import { ContextMenuResult } from "../../common/contextmenu";

type ActionStore = {
    actions: Array<ActionTemplate & { groupId: string }> | null;
};

const { useStore, useStoreValue } = create<ActionStore>({ actions: null });

export type ActionsProviderProps = {
    groups: Array<React.FC>;
};

export const ActionsProvider: React.FC<
    PropsWithChildren<ActionsProviderProps>
> = (props) => {
    const [store] = useState(() => createStore<ActionStore>({ actions: null }));
    const Context = useStore.Context;

    return (
        <Context.Provider value={store}>
            <ActionsProviderInner {...props} />
        </Context.Provider>
    );
};

const ActionsProviderInner: React.FC<
    PropsWithChildren<ActionsProviderProps>
> = (props) => {
    const hasActions = useStoreValue((v) => v !== null);

    const { children, groups } = props;

    return (
        <>
            {hasActions && children}
            {groups.map((Group, i) => (
                <Group key={i} />
            ))}
        </>
    );
};

export function useActionsGetter(): (
    resources: Array<K8sObject | K8sObjectIdentifier>
) => Array<Array<ActionTemplate>> {
    const store = useStore();
    return useCallback(
        (resources) => {
            if (resources.length === 0) {
                return [];
            }
            const groupedActions: Record<string, ActionTemplate[]> = {};
            for (const action of store.get().actions ?? []) {
                if (action.isVisible && !action.isVisible(resources)) {
                    // This action is invisible.
                    continue;
                }
                const { groupId } = action;
                if (!groupedActions[groupId]) {
                    groupedActions[groupId] = [];
                }
                groupedActions[groupId].push(action);
            }
            return Object.values(groupedActions);
        },
        [store]
    );
}

const ActionGroupContext = createContext<string>("");

export type ActionClickResult = Omit<ContextMenuResult, "actionId"> & {
    resources: Array<K8sObject | K8sObjectIdentifier>;
    subOptionId?: string | undefined;
};

export type ActionTemplate = {
    id: string;
    label: string;
    type?: "normal" | "submenu" | "checkbox" | "radio";
    enabled?: boolean;
    checked?: boolean;
    toolTip?: string;
    isVisible?: (resources: Array<K8sObject | K8sObjectIdentifier>) => boolean;
    buttonIcon?: ReactElement;
    subOptions?: (
        resources: Array<K8sObject | K8sObjectIdentifier>
    ) => Array<{ id: string; label: string }>;
    onClick: (result: ActionClickResult) => void | Promise<void>;
};

export const Action: React.FC<PropsWithChildren<ActionTemplate>> = (props) => {
    const groupId = useContext(ActionGroupContext);
    const store = useStore();

    const {
        id,
        label,
        type,
        enabled,
        checked,
        toolTip,
        isVisible,
        buttonIcon,
        subOptions,
        onClick,
    } = props;

    useEffect(() => {
        store.set((value) => ({
            actions: [
                ...(value.actions ?? []),
                {
                    id,
                    label,
                    type,
                    enabled,
                    checked,
                    toolTip,
                    onClick,
                    isVisible,
                    buttonIcon,
                    subOptions,
                    groupId,
                },
            ],
        }));
        return () => {
            store.set((value) => ({
                actions:
                    value.actions === null
                        ? null
                        : value.actions.filter((a) => a.id !== id),
            }));
        };
    }, [
        groupId,
        id,
        label,
        type,
        enabled,
        checked,
        toolTip,
        onClick,
        subOptions,
        store,
    ]);

    return null;
};

let actionGroupIndex = 1;

export const ActionGroup: React.FC<PropsWithChildren<{}>> = ({ children }) => {
    const [actionGroupId] = useState(() => `group-${actionGroupIndex++}`);
    return (
        <ActionGroupContext.Provider value={actionGroupId}>
            {children}
        </ActionGroupContext.Provider>
    );
};
