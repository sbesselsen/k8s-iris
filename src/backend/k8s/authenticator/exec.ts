import execa = require("execa");
import { shellOptions } from "../../util/shell";

interface CredentialStatus {
    readonly token: string;
    readonly clientCertificateData: string;
    readonly clientKeyData: string;
    readonly expirationTimestamp: string;
}

interface Credential {
    readonly status: CredentialStatus;
}

/**
 * This class is a patched version of ExecAuth, which handles authentication asynchronously.
 * The kubernetes-client Authenticator interface supports this, but the class does not.
 */
export class CharmPatchedExecAuth {
    private readonly tokenCache: { [key: string]: Credential | null } = {};
    private execFn: (
        cmd: string,
        args: string[],
        opts: execa.Options
    ) => Promise<execa.ExecaReturnValue> = execa;

    public isAuthProvider(user: any): boolean {
        if (!user) {
            return false;
        }
        if (user.exec) {
            return true;
        }
        if (!user.authProvider) {
            return false;
        }
        return (
            user.authProvider.name === "exec" ||
            !!(user.authProvider.config && user.authProvider.config.exec)
        );
    }

    public async applyAuthentication(user: any, opts: any): Promise<void> {
        const credential = await this.getCredential(user);
        if (!credential) {
            return;
        }
        if (credential.status.clientCertificateData) {
            opts.cert = credential.status.clientCertificateData;
        }
        if (credential.status.clientKeyData) {
            opts.key = credential.status.clientKeyData;
        }
        const token = this.getToken(credential);
        if (token) {
            if (!opts.headers) {
                opts.headers = [];
            }
            opts.headers!.Authorization = `Bearer ${token}`;
        }
    }

    private getToken(credential: Credential): string | null {
        if (!credential) {
            return null;
        }
        if (credential.status.token) {
            return credential.status.token;
        }
        return null;
    }

    private async getCredential(user: any): Promise<Credential | null> {
        // TODO: Add a unit test for token caching.
        const cachedToken = this.tokenCache[user.name];
        if (cachedToken) {
            const date = Date.parse(cachedToken.status.expirationTimestamp);
            if (date > Date.now()) {
                return cachedToken;
            }
            this.tokenCache[user.name] = null;
        }
        let exec: any = null;
        if (user.authProvider && user.authProvider.config) {
            exec = user.authProvider.config.exec;
        }
        if (user.exec) {
            exec = user.exec;
        }
        if (!exec) {
            return null;
        }
        if (!exec.command) {
            throw new Error("No command was specified for exec authProvider!");
        }
        const shellOpts = await shellOptions();
        let opts: execa.Options = {
            shell: shellOpts.executablePath,
        };
        if (exec.env) {
            const env = process.env;
            exec.env.forEach((elt) => (env[elt.name] = elt.value));
            opts = { ...opts, env };
        }

        // Set a search path for executables
        // TODO: do this in a nicer way
        opts = { ...opts, env: { ...(opts.env ?? {}), ...shellOpts.env } };

        const result = await this.execFn(exec.command, exec.args, opts);
        if (result.exitCode === 0) {
            const obj = JSON.parse(result.stdout) as Credential;
            this.tokenCache[user.name] = obj;
            return obj;
        }
        throw new Error(result.stderr);
    }
}
