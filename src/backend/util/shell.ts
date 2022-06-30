import { exec } from "child_process";
import { uniqueOrdered } from "../../common/util/array";

let shellPathPromise: Promise<string[]> | undefined;
const defaultPathItems = [
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
];

export async function shellOptions(): Promise<{
    executablePath: string;
    env: Record<string, string>;
}> {
    if (!shellPathPromise) {
        shellPathPromise = loadShellPath();
    }
    const shellPath = await shellPathPromise;

    return {
        executablePath: process.env.SHELL ?? "/bin/sh",
        env: {
            PATH: uniqueOrdered([
                ...shellPath,
                ...(process.env.PATH ?? "").split(":").filter((x) => x),
                ...defaultPathItems,
            ]).join(":"),
        },
    };
}

async function loadShellPath(): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const initialPath = uniqueOrdered([
            ...(process.env.PATH ?? "").split(":").filter((x) => x),
            ...defaultPathItems,
        ]).join(":");

        exec(
            `${process.env.SHELL ?? "/bin/sh"} -c 'echo $PATH'`,
            {
                env: {
                    PATH: initialPath,
                },
            },
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
