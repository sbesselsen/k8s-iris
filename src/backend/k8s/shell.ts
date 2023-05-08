import * as crypto from "crypto";
import { app } from "electron";
import * as fs from "fs";
import * as path from "path";
import { K8sClientManager } from ".";
import { toYaml } from "../../common/util/yaml";
import { ShellWrapper } from "../shell";

export function k8sShellWrapper(clientManager: K8sClientManager): ShellWrapper {
    return async (context: string) => {
        const kubeConfig = clientManager.kubeConfigForContext(context);
        if (!kubeConfig) {
            // Nothing to wrap.
            return {
                async unwrap() {},
            };
        }

        const tempPath = path.join(
            app.getPath("temp"),
            `kc-${crypto.randomBytes(16).toString("hex")}.yml`
        );

        await fs.promises.writeFile(
            tempPath,
            toYaml(JSON.parse(kubeConfig.exportConfig())),
            {
                encoding: "utf-8",
            }
        );
        await fs.promises.chmod(tempPath, 0o600);

        return {
            env: {
                KUBECONFIG: tempPath,
            },
            async unwrap() {
                await fs.promises.unlink(tempPath);
            },
        };
    };
}
