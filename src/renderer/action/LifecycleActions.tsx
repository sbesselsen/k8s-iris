import React, { useCallback } from "react";
import { Action, ActionClickResult, ActionGroup } from ".";
import { K8sObject, K8sObjectIdentifier } from "../../common/k8s/client";
import { isK8sObject, isSetLike } from "../../common/k8s/util";
import {
    useK8sPauseAction,
    useK8sRedeployAction,
    useK8sResumeAction,
} from "../k8s/actions";

export const LifecycleActions: React.FC<{}> = () => {
    const isPauseVisible = useCallback(
        (resources: Array<K8sObject | K8sObjectIdentifier>) => {
            const allAreSets = resources.every(isSetLike);
            const allAreObjects = resources.every(isK8sObject);
            const allCanScale = resources.every((r) => r.kind !== "DaemonSet");
            return (
                allCanScale &&
                allAreSets &&
                allAreObjects &&
                resources.some((o) => (o as any)?.spec?.replicas > 0)
            );
        },
        []
    );
    const isResumeVisible = useCallback(
        (resources: Array<K8sObject | K8sObjectIdentifier>) => {
            const allAreSets = resources.every(isSetLike);
            const allAreObjects = resources.every(isK8sObject);
            const allCanScale = resources.every((r) => r.kind !== "DaemonSet");
            return (
                allCanScale &&
                allAreSets &&
                allAreObjects &&
                resources.some((o) => (o as any)?.spec?.replicas === 0)
            );
        },
        []
    );
    const isRedeployVisible = useCallback(
        (resources: Array<K8sObject | K8sObjectIdentifier>) => {
            const allAreSets = resources.every(isSetLike);
            const allAreObjects = resources.every(isK8sObject);
            return allAreSets && allAreObjects;
        },
        []
    );

    const pause = useK8sPauseAction();
    const resume = useK8sResumeAction();
    const redeploy = useK8sRedeployAction();

    const onClickPause = useCallback(
        (result: ActionClickResult) => {
            const { resources } = result;
            if (resources.every(isK8sObject)) {
                pause(resources);
            }
        },
        [pause]
    );

    const onClickResume = useCallback(
        (result: ActionClickResult) => {
            const { resources } = result;
            if (resources.every(isK8sObject)) {
                resume(resources);
            }
        },
        [resume]
    );

    const onClickRedeploy = useCallback(
        (result: ActionClickResult) => {
            const { resources } = result;
            if (resources.every(isK8sObject)) {
                redeploy(resources);
            }
        },
        [redeploy]
    );

    return (
        <>
            <ActionGroup>
                <Action
                    id="pause"
                    label="Pause"
                    isVisible={isPauseVisible}
                    onClick={onClickPause}
                />
                <Action
                    id="resume"
                    label="Resume"
                    isVisible={isResumeVisible}
                    onClick={onClickResume}
                />
                <Action
                    id="redeploy"
                    label="Redeploy"
                    isVisible={isRedeployVisible}
                    onClick={onClickRedeploy}
                />
            </ActionGroup>
        </>
    );
};
