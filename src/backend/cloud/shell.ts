import { CloudManager } from ".";
import { K8sClientManager } from "../k8s";
import { ShellWrapper } from "../shell";

export function cloudShellWrapper(
    cloudManager: CloudManager,
    k8sClientManager: K8sClientManager
): ShellWrapper {
    return async (context: string) => {
        const contexts = k8sClientManager.listContexts();
        const contextInfo = contexts.find((ctx) => ctx.name === context);
        let env: Record<string, string> = {};

        if (contextInfo) {
            const augmentedContexts = await cloudManager.augmentK8sContexts([
                contextInfo,
            ]);
            const augmentedContext = augmentedContexts[contextInfo.name];
            if (augmentedContext.cloudProvider === "aws") {
                for (const account of augmentedContext.accounts ?? []) {
                    if (account.accountName) {
                        const profile = account.accountName;
                        env = {
                            AWS_DEFAULT_PROFILE: profile,
                            AWS_PROFILE: profile,
                            AWS_EB_PROFILE: profile,
                        };
                        break;
                    }
                }
            }
        }

        return {
            env,
            async unwrap() {},
        };
    };
}
