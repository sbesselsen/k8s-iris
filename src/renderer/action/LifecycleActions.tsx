import React, { useCallback } from "react";
import { Action, ActionGroup } from ".";
import { K8sObject, K8sObjectIdentifier } from "../../common/k8s/client";
import { isK8sObject, isSetLike } from "../../common/k8s/util";
import {
    useK8sPauseAction,
    useK8sRedeployAction,
    useK8sResumeAction,
} from "../k8s/actions";

export const LifecycleActions: React.FC<{
    objects: Array<K8sObject | K8sObjectIdentifier>;
}> = ({ objects }) => {
    const allAreSets = objects.every(isSetLike);
    const allAreObjects = objects.every(isK8sObject);
    const allCanScale = objects.every((r) => r.kind !== "DaemonSet");
    const canPause =
        allCanScale &&
        allAreSets &&
        allAreObjects &&
        objects.some((o) => (o as any)?.spec?.replicas > 0);
    const canResume =
        allCanScale &&
        allAreSets &&
        allAreObjects &&
        objects.some((o) => (o as any)?.spec?.replicas === 0);
    const canRedeploy = allAreSets && allAreObjects;

    const pause = useK8sPauseAction();
    const resume = useK8sResumeAction();
    const redeploy = useK8sRedeployAction();

    const onClickPause = useCallback(() => {
        if (canPause) {
            pause(objects);
        }
    }, [canPause, objects, pause]);

    const onClickResume = useCallback(() => {
        if (canResume) {
            resume(objects);
        }
    }, [canResume, objects, resume]);

    const onClickRedeploy = useCallback(() => {
        if (canRedeploy) {
            redeploy(objects);
        }
    }, [canRedeploy, objects, redeploy]);

    return (
        <>
            <ActionGroup>
                {canPause && (
                    <Action id="pause" label="Pause" onClick={onClickPause} />
                )}
                {canResume && (
                    <Action
                        id="resume"
                        label="Resume"
                        onClick={onClickResume}
                    />
                )}
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
