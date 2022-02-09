export type CloudK8sContextInfo = {
    cloudProvider?: string;
    cloudService?: string;
    region?: string;
    accounts?: Array<{ accountId: string; accountName?: string }>;
    localClusterName?: string;
    supportsAppLogin?: boolean;
};
