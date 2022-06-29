import { exec } from "child_process";
import { uniqueOrdered } from "../../common/util/array";

let shellPathPromise: Promise<string[]> | undefined;

export async function shellOptions(): Promise<{
    executablePath: string;
    env: Record<string, string>;
}> {
    if (!shellPathPromise) {
        shellPathPromise = loadShellPath();
    }
    const shellPath = await shellPathPromise;

    const pathEntries = uniqueOrdered([
        ...(process.env.PATH ?? "").split(":"),
        ...shellPath,
        "/usr/local/bin",
        "/usr/bin",
        "/bin",
        "/usr/sbin",
        "/sbin",
    ]).filter((x) => x);

    return {
        executablePath: process.env.SHELL ?? "/bin/sh",
        env: {
            PATH: pathEntries.join(":"),
        },
    };
}

async function loadShellPath(): Promise<string[]> {
    return new Promise((resolve, reject) => {
        exec(
            `${process.env.SHELL ?? "/bin/sh"} -i -c "echo $PATH"`,
            (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error discovering path`, error);
                    resolve([]);
                    return;
                }
                if (stderr) {
                    console.error(`stderr from path discovery: ${stderr}`);
                    resolve([]);
                    return;
                }
                if (stdout) {
                    const trimmedValue = stdout.trim();
                    if (trimmedValue.length > 0) {
                        resolve(trimmedValue.split(":"));
                        return;
                    }
                }
                resolve([]);
            }
        );
    });
}
