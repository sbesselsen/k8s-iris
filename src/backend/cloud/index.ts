import { loadSharedConfigFiles } from "@aws-sdk/shared-ini-file-loader";
import { exec } from "child_process";
import { CloudK8sContextInfo } from "../../common/cloud/k8s";
import { K8sContext } from "../../common/k8s/client";
import { shellOptions } from "../util/shell";

export type CloudManager = {
    augmentK8sContexts(
        contexts: K8sContext[]
    ): Promise<Record<string, CloudK8sContextInfo>>;
    loginForContext(context: K8sContext): Promise<void>;
};

export function createCloudManager(options?: {
    didLogin?: () => void;
}): CloudManager {
    const { didLogin } = {
        ...options,
    };

    const augmentK8sContexts = async (
        contexts: K8sContext[]
    ): Promise<Record<string, CloudK8sContextInfo>> => {
        const output: Record<string, CloudK8sContextInfo> = {};
        const sources = [awsAugmentK8sContexts, localDevAugmentK8sContexts];
        let remainingContexts = contexts;
        for (const source of sources) {
            if (remainingContexts.length === 0) {
                break;
            }
            const result = await source(contexts);
            remainingContexts = remainingContexts.filter(
                (context) => !result[context.name]
            );

            for (const [key, info] of Object.entries(result)) {
                output[key] = info;
            }
        }
        return output;
    };

    const loginForContext = async (context: K8sContext): Promise<void> => {
        const augmentedContext = (await augmentK8sContexts([context]))[
            context.name
        ];
        if (!augmentedContext.supportsAppLogin) {
            throw new Error("App login not supported for this context");
        }
        // Try logging in. Only supported for AWS EKS for now.
        if (
            augmentedContext.cloudProvider === "aws" &&
            augmentedContext.cloudService === "eks"
        ) {
            await awsEksLoginForContext(augmentedContext);
            didLogin?.();
        }
    };

    return {
        augmentK8sContexts,
        loginForContext,
    };
}

async function localDevAugmentK8sContexts(
    contexts: K8sContext[]
): Promise<Record<string, CloudK8sContextInfo>> {
    const output: Record<string, CloudK8sContextInfo> = {};
    for (const context of contexts) {
        const match = context.name.match(/(docker|minikube|colima)/);
        if (match) {
            output[context.name] = {
                cloudProvider: "local",
                cloudService: match[1],
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
        let match: RegExpMatchArray | null = context.cluster.match(awsEksRegex);
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
                contextInfo.supportsAppLogin = true;

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

async function awsEksLoginForContext(
    augmentedContext: CloudK8sContextInfo
): Promise<void> {
    if (!augmentedContext.accounts || augmentedContext.accounts.length === 0) {
        throw new Error("No supported accounts for app login");
    }
    const { accountId } = augmentedContext.accounts[0];
    const awsProfiles = await listAwsProfiles();

    const awsProfileEntry = Object.entries(awsProfiles).find(
        ([, info]) => info.sso_account_id === accountId
    );
    if (!awsProfileEntry) {
        throw new Error("No suitable profile found for AWS app login");
    }

    const [profileName] = awsProfileEntry;
    const shellOpts = await shellOptions();

    return new Promise((resolve, reject) => {
        exec(
            "aws sso login",
            {
                shell: shellOpts.executablePath,
                env: { ...shellOpts.env, AWS_PROFILE: profileName },
            },
            (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error during app login`, error);
                    reject(error);
                    return;
                }
                if (stderr) {
                    console.log(`stderr from app login: ${stderr}`);
                }
                console.log(`stdout from app login: ${stdout}`);
                resolve();
            }
        );
    });
}
