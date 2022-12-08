import React, {
    createContext,
    MutableRefObject,
    PropsWithChildren,
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react";
import { K8sObject, K8sObjectIdentifier } from "../../common/k8s/client";
import { create, createStore } from "../util/state";
import { EditActions } from "./EditActions";
import { OpenActions } from "./OpenActions";

type ActionStore = {
    actions: Array<ActionTemplate & { groupId: string }>;
};

const { useStore } = create<ActionStore>({ actions: [] });

const ActionGroupContext = createContext<string>("");

export const ActionsCollector: React.FC<{
    objects: Array<K8sObject | K8sObjectIdentifier>;
    getActionsRef: MutableRefObject<() => Array<Array<ActionTemplate>>>;
}> = ({ objects, getActionsRef }) => {
    const ActionStoreContext = useStore.Context;
    const [store] = useState(() => createStore<ActionStore>({ actions: [] }));

    const getActions = useCallback(() => {
        const groupedActions: Record<string, ActionTemplate[]> = {};
        for (const action of store.get().actions) {
            const { groupId } = action;
            if (!groupedActions[groupId]) {
                groupedActions[groupId] = [];
            }
            groupedActions[groupId].push(action);
        }
        return Object.values(groupedActions);
    }, [store]);
    getActionsRef.current = getActions;

    if (objects.length === 0) {
        return null;
    }

    return (
        <ActionStoreContext.Provider value={store}>
            <OpenActions objects={objects} />
            <EditActions objects={objects} />
        </ActionStoreContext.Provider>
    );
};

export type ActionTemplate = {
    id: string;
    label: string;
    type?: "normal" | "submenu" | "checkbox" | "radio";
    enabled?: boolean;
    checked?: boolean;
    toolTip?: string;
    onClick: () => void | Promise<void>;
};

export const Action: React.FC<ActionTemplate> = (props) => {
    const groupId = useContext(ActionGroupContext);
    const store = useStore();

    const { id, label, type, enabled, checked, toolTip, onClick } = props;

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
                    groupId,
                },
            ],
        }));
        return () => {
            store.set((value) => ({
                actions: value.actions.filter((a) => a.id !== id),
            }));
        };
    }, [groupId, id, label, type, enabled, checked, toolTip, onClick, store]);

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
