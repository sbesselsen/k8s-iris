import { exec } from "child_process";

let shellPathPromise: Promise<string[]> | undefined;

export async function shellOptions(): Promise<{
    executablePath: string;
    env: Record<string, string>;
}> {
    if (!shellPathPromise) {
        shellPathPromise = loadShellPath();
    }
    const path = await shellPathPromise;

    return {
        executablePath: process.env.SHELL ?? "/bin/sh",
        env: {
            PATH: path.join(":"),
        },
    };
}

async function loadShellPath(): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const initialPathItems: string[] = (process.env.PATH ?? "")
            .split(":")
            .filter((x) => x);
        initialPathItems.push(
            "/usr/local/bin",
            "/usr/bin",
            "/bin",
            "/usr/sbin",
            "/sbin"
        );

        exec(
            `${process.env.SHELL ?? "/bin/sh"} -i -c 'echo $PATH'`,
            {
                env: {
                    PATH: initialPathItems.join(":"),
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
