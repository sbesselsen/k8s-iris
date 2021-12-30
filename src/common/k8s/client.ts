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

export type K8sObject = K8sResourceTypeIdentifier & {
    metadata: K8sObjectMetadata;
};

export type K8sObjectList<T extends K8sObject = K8sObject> =
    K8sResourceTypeIdentifier & {
        items: T[];
    };

export type K8sObjectListQuery = K8sResourceTypeIdentifier & {};

export type K8sRemoveOptions = {
    waitForCompletion?: boolean;
};

export type K8sRemoveStatus = {};

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
    // watch<T extends K8sObject = K8sObject>(spec: K8sObjectListQuery): Promise<K8sObjectWatch>;
};
