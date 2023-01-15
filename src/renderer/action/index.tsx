import React, {
    createContext,
    MutableRefObject,
    PropsWithChildren,
    ReactElement,
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react";
import { K8sObject, K8sObjectIdentifier } from "../../common/k8s/client";
import { create, createStore } from "../util/state";
import { EditActions } from "./EditActions";
import { BrowseActions } from "./BrowseActions";
import { ContextMenuResult } from "../../common/contextmenu";
import { LifecycleActions } from "./LifecycleActions";
import { InspectActions } from "./InspectActions";

type ActionStore = {
    actions: Array<ActionTemplate & { groupId: string }>;
};

const { useStore } = create<ActionStore>({ actions: [] });

const ActionGroupContext = createContext<string>("");

export const ActionsCollector: React.FC<{
    getActionsRef: MutableRefObject<
        (
            resources: Array<K8sObject | K8sObjectIdentifier>
        ) => Array<Array<ActionTemplate>>
    >;
}> = ({ getActionsRef }) => {
    const ActionStoreContext = useStore.Context;
    const [store] = useState(() => createStore<ActionStore>({ actions: [] }));

    const getActions = useCallback(
        (resources: Array<K8sObject | K8sObjectIdentifier>) => {
            const groupedActions: Record<string, ActionTemplate[]> = {};
            for (const action of store.get().actions) {
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
    getActionsRef.current = getActions;

    return (
        <ActionStoreContext.Provider value={store}>
            <BrowseActions />
            <EditActions />
            <LifecycleActions />
            <InspectActions />
        </ActionStoreContext.Provider>
    );
};

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
                ...value.actions,
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
                actions: value.actions.filter((a) => a.id !== id),
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
