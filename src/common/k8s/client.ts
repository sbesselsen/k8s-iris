export type K8sObjectMetadata = {
    name: string;
    namespace?: string;
    annotations?: Record<string, string>;
    labels?: Record<string, string>;
};

export type K8sResourceTypeIdentifier = {
    apiVersion: string;
    kind: string;
};

export type K8sResourceTypeInfo = K8sResourceTypeIdentifier & {
    apiVersion: string;
    kind: string;
    namespaced: boolean;
};

export type K8sObject = K8sResourceTypeIdentifier & {
    metadata: K8sObjectMetadata;
};

export type K8sObjectList<T extends K8sObject = K8sObject> =
    K8sResourceTypeIdentifier & {
        items: T[];
    };

export type K8sObjectListQuery = K8sResourceTypeIdentifier & {
    namespaces?: string[];
};

export type K8sRemoveOptions = {
    waitForCompletion?: boolean;
};

export type K8sRemoveStatus = {};

export type K8sObjectListWatch = {
    stop(): void;
};

export type K8sObjectListUpdate<T extends K8sObject> = {
    type: "update" | "remove" | "add";
    object: T;
};

export type K8sObjectListWatcherMessage<T extends K8sObject = K8sObject> = {
    list: K8sObjectList<T>;
    update?: K8sObjectListUpdate<T>;
};

export type K8sObjectListWatcher<T extends K8sObject = K8sObject> = (
    error: any | undefined,
    message?: K8sObjectListWatcherMessage<T> | undefined
) => void;

export type K8sContext = {
    name: string;
    cluster: string;
    user: string;
    namespace?: string;
};

export type K8sClient = {
    read(spec: K8sObject): Promise<K8sObject | null>;
    apply(spec: K8sObject): Promise<K8sObject>;
    patch(spec: K8sObject): Promise<K8sObject>;
    replace(spec: K8sObject): Promise<K8sObject>;
    remove(
        spec: K8sObject,
        options?: K8sRemoveOptions
    ): Promise<K8sRemoveStatus>;
    list<T extends K8sObject = K8sObject>(
        spec: K8sObjectListQuery
    ): Promise<K8sObjectList<T>>;
    listWatch<T extends K8sObject = K8sObject>(
        spec: K8sObjectListQuery,
        watcher: K8sObjectListWatcher<T>
    ): K8sObjectListWatch;
    listApiResourceTypes(): Promise<K8sResourceTypeInfo[]>;
};
