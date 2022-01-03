import { loadSharedConfigFiles } from "@aws-sdk/shared-ini-file-loader";
import { CloudK8sContextInfo } from "../../common/cloud/k8s";
import { K8sContext } from "../../common/k8s/client";

export type CloudManager = {
    augmentK8sContexts(
        contexts: K8sContext[]
    ): Promise<Record<string, CloudK8sContextInfo>>;
};

export function createCloudManager(): CloudManager {
    const augmentK8sContexts = async (
        contexts: K8sContext[]
    ): Promise<Record<string, CloudK8sContextInfo>> => {
        const results = await Promise.all([
            localDevAugmentK8sContexts(contexts),
            awsAugmentK8sContexts(contexts),
        ]);
        const output: Record<string, CloudK8sContextInfo> = {};
        for (const result of results) {
            for (const [key, info] of Object.entries(result)) {
                if (!output[key]) {
                    output[key] = info;
                }
            }
        }
        return output;
    };
    return {
        augmentK8sContexts,
    };
}

async function localDevAugmentK8sContexts(
    contexts: K8sContext[]
): Promise<Record<string, CloudK8sContextInfo>> {
    const output: Record<string, CloudK8sContextInfo> = {};
    for (const context of contexts) {
        if (context.name.match(/^(docker|minikube|colima)$/)) {
            output[context.name] = {
                cloudProvider: "local",
                cloudService: context.name,
            };
        }
    }
    return output;
}

async function awsAugmentK8sContexts(
    contexts: K8sContext[]
): Promise<Record<string, CloudK8sContextInfo>> {
    const awsProfilesByAccountId: Record<string, string[]> = {};
    try {
        const awsProfiles = await listAwsProfiles();

        for (const [profileName, profileInfo] of Object.entries(awsProfiles)) {
            if (!profileInfo.sso_account_id) {
                continue;
            }
            const accountId = profileInfo.sso_account_id;
            if (!awsProfilesByAccountId[accountId]) {
                awsProfilesByAccountId[accountId] = [];
            }
            awsProfilesByAccountId[accountId].push(profileName);
        }
    } catch (e) {
        // Guess we have no AWS info available.
    }

    const output: Record<string, CloudK8sContextInfo> = {};
    for (const context of contexts) {
        const awsEksRegex = /^arn:aws:eks:([^:]+):([0-9]+):cluster\/(.*)$/;
        let match: RegExpMatchArray | undefined =
            context.cluster.match(awsEksRegex);
        if (!match) {
            match = context.name.match(awsEksRegex);
        }
        if (match) {
            const contextInfo: CloudK8sContextInfo = {
                cloudProvider: "aws",
                cloudService: "eks",
                region: match[1],
                localClusterName: match[3],
            };
            const accountId = match[2];
            if (awsProfilesByAccountId[accountId]) {
                contextInfo.accounts = awsProfilesByAccountId[accountId].map(
                    (accountName) => ({
                        accountId,
                        accountName,
                    })
                );
            } else {
                contextInfo.accounts = [{ accountId }];
            }
            output[context.name] = contextInfo;
        }
    }

    return output;
}

async function listAwsProfiles(): Promise<Record<string, any>> {
    const data = await loadSharedConfigFiles();
    return data.configFile;
}
