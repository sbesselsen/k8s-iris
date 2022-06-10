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
    namespaced: boolean;
    isSubResource: boolean;
    verbs?: string[];
};

export type K8sObject = K8sResourceTypeIdentifier & {
    metadata: K8sObjectMetadata;
};

export type K8sObjectIdentifier = K8sResourceTypeIdentifier & {
    name: string;
    namespace?: string;
};

export type K8sObjectList<T extends K8sObject = K8sObject> =
    K8sResourceTypeIdentifier & {
        items: T[];
    };

export type K8sObjectListQuery = K8sResourceTypeIdentifier & {
    namespaces?: string[];
};

export type K8sPatchOptions = {
    serverSideApply?: boolean;
    forcePatch?: boolean;
};

export type K8sPatchConflictDetails = {
    message: string;
};

export type K8sPatchConflictResolution = { force: boolean };

export type K8sApplyOptions = {};

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

export type K8sExecCommandSpec = {
    namespace: string;
    podName: string;
    containerName: string;
    command: string[];
};

export type K8sExecSpec = K8sExecCommandSpec & {
    tty?: boolean;
};

export type K8sExecOptions = {};
export type K8sExecCommandOptions = {};
export type K8sExecCommandStatus = {
    status: string;
    message: string;
};
export type K8sExecCommandResult = {
    status: K8sExecCommandStatus;
    stdout: ArrayBuffer;
    stderr: ArrayBuffer;
};

export type K8sExecHandler = {
    onReceive: (
        listener: (
            stdout: ArrayBuffer | null,
            stderr: ArrayBuffer | null
        ) => void
    ) => void;
    onEnd: (listener: (status?: K8sExecCommandStatus) => void) => void;
    resizeTerminal: (size: { cols: number; rows: number }) => void;
    send: (chunk: ArrayBuffer) => void;
    close: () => Promise<void>;
};

export type K8sLogSpec = {
    namespace: string;
    podName: string;
    containerName: string;
};

export type K8sLogOptions = {
    previous?: boolean;
    timestamps?: boolean;
    match?: string;
};

export type K8sLogResult = {
    logLines: string[];
};

export type K8sLogWatchOptions = K8sLogOptions & {
    onLogLine: (line: string) => void;
    onEnd: () => void;
};

export type K8sLogWatch = {
    stop(): void;
};

export type K8sClient = {
    read(spec: K8sObject): Promise<K8sObject | null>;
    apply(spec: K8sObject, options?: K8sApplyOptions): Promise<K8sObject>;
    patch(spec: K8sObject, options?: K8sPatchOptions): Promise<K8sObject>;
    replace(spec: K8sObject): Promise<K8sObject>;
    exec(spec: K8sExecSpec, options?: K8sExecOptions): Promise<K8sExecHandler>;
    execCommand(
        spec: K8sExecCommandSpec,
        options?: K8sExecCommandOptions
    ): Promise<K8sExecCommandResult>;
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
    log(spec: K8sLogSpec, options?: K8sLogOptions): Promise<K8sLogResult>;
    logWatch(spec: K8sLogSpec, options: K8sLogWatchOptions): K8sLogWatch;
    listApiResourceTypes(): Promise<K8sResourceTypeInfo[]>;
};
