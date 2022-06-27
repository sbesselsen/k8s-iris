export function shellOptions(): {
    executablePath: string;
    env: Record<string, string>;
} {
    return {
        executablePath: process.env.SHELL ?? "/bin/sh",
        env: {
            PATH: [
                process.env.PATH,
                "/usr/local/bin",
                "/usr/bin",
                "/bin",
                "/usr/sbin",
                "/sbin",
                "/opt/homebrew/bin",
            ]
                .filter((x) => x)
                .join(":"),
        },
    };
}
