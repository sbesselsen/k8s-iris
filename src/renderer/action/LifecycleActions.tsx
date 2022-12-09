import React, { useCallback } from "react";
import { Action, ActionGroup } from ".";
import { K8sObject, K8sObjectIdentifier } from "../../common/k8s/client";
import { isK8sObject, isSetLike } from "../../common/k8s/util";
import { useK8sRedeployAction } from "../k8s/actions";

export const LifecycleActions: React.FC<{
    objects: Array<K8sObject | K8sObjectIdentifier>;
}> = ({ objects }) => {
    const allAreSets = objects.every(isSetLike);
    const allAreObjects = objects.every(isK8sObject);
    const canRedeploy = allAreSets && allAreObjects;

    const redeploy = useK8sRedeployAction();

    const onClickRedeploy = useCallback(() => {
        if (canRedeploy) {
            redeploy(objects);
        }
    }, [canRedeploy, objects, redeploy]);

    return (
        <>
            <ActionGroup>
                {canRedeploy && (
                    <Action
                        id="redeploy"
                        label="Redeploy"
                        onClick={onClickRedeploy}
                    />
                )}
            </ActionGroup>
        </>
    );
};
