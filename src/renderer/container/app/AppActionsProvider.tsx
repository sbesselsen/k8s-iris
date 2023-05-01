import React, { PropsWithChildren } from "react";
import { ActionsProvider } from "../../action";
import { BrowseActions } from "../../action/BrowseActions";
import { EditActions } from "../../action/EditActions";
import { InspectActions } from "../../action/InspectActions";
import { LifecycleActions } from "../../action/LifecycleActions";
import { TextActions } from "../../action/TextActions";
import { useOptionalK8sContext } from "../../context/k8s-context";

const actionGroups = [
    BrowseActions,
    EditActions,
    TextActions,
    LifecycleActions,
    InspectActions,
];

const emptyGroups: Array<React.FC<{}>> = [];

export const AppActionsProvider: React.FC<PropsWithChildren<{}>> = (props) => {
    const { children } = props;

    // Only load action groups once we have a context, otherwise we error out on useK8sContext() inside the actions.
    const context = useOptionalK8sContext();

    return (
        <ActionsProvider groups={context ? actionGroups : emptyGroups}>
            {children}
        </ActionsProvider>
    );
};
