import * as k8s from "@kubernetes/client-node";
import { KubernetesObject } from "@kubernetes/client-node";
import {
    K8sClient,
    K8sObject,
    K8sObjectList,
    K8sObjectListQuery,
    K8sRemoveOptions,
    K8sRemoveStatus,
} from "../../common/k8s/client";

const defaultRemoveOptions: K8sRemoveOptions = {
    waitForCompletion: true,
};

function isFullObject(body: KubernetesObject): body is K8sObject {
    return !!body && !!body.apiVersion && !!body.kind && !!body.metadata;
}

function onlyFullObject(body: KubernetesObject): K8sObject | null {
    return isFullObject(body) ? body : null;
}

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
}

export function createClient(kubeConfig: k8s.KubeConfig): K8sClient {
    const objectApi = kubeConfig.makeApiClient(k8s.KubernetesObjectApi);

    const exists = async (spec: K8sObject): Promise<boolean> => {
        try {
            await objectApi.read(spec);
            return true;
        } catch (e) {}
        return false;
    };

    const read = async (spec: K8sObject): Promise<K8sObject | null> => {
        try {
            const { body } = await objectApi.read(spec);
            return onlyFullObject(body);
        } catch (e) {}
        return null;
    };

    const apply = async (spec: K8sObject): Promise<K8sObject> => {
        if (await exists(spec)) {
            return patch(spec);
        }
        const { body } = await objectApi.create(spec);
        return onlyFullObject(body);
    };

    const patch = async (spec: K8sObject): Promise<K8sObject> => {
        const { body } = await objectApi.patch(spec);
        return onlyFullObject(body);
    };

    const replace = async (spec: K8sObject): Promise<K8sObject> => {
        const { body } = await objectApi.replace(spec);
        return onlyFullObject(body);
    };

    const remove = async (
        spec: K8sObject,
        options?: K8sRemoveOptions
    ): Promise<K8sRemoveStatus> => {
        const { waitForCompletion } = {
            ...defaultRemoveOptions,
            ...options,
        };
        await objectApi.delete(spec);
        if (waitForCompletion) {
            while (await read(spec)) {
                await sleep(1000);
            }
        }
        return {};
    };
    const list = async <T extends K8sObject = K8sObject>(
        spec: K8sObjectListQuery
    ): Promise<K8sObjectList<T>> => {
        return {
            ...spec,
            items: [],
        };
    };

    return {
        read,
        apply,
        patch,
        replace,
        remove,
        list,
    };
}
