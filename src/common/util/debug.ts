export type DebugCounters = {
    up(key: string): void;
    down(key: string): void;
    stop(): void;
};

export function debugCounters(prefix: string): DebugCounters {
    const counts: Record<string, number> = {};

    function log() {
        console.log(`Counts for ${prefix}:`);
        console.table(counts);
        isChanged = false;
    }

    let isChanged = false;

    const interval = setInterval(() => {
        if (isChanged) {
            log();
        }
    }, 5000);

    return {
        up(key) {
            isChanged = true;
            counts[key] = (counts[key] ?? 0) + 1;
            console.log(`up(${prefix}:${key}) => ${counts[key]}`);
        },
        down(key) {
            isChanged = true;
            if (!counts[key] || counts[key] <= 0) {
                console.error(
                    `Error: down(${prefix}:${key}) when value is ${counts[key]}`
                );
            }
            counts[key] = (counts[key] ?? 0) - 1;
            console.log(`down(${prefix}:${key}) => ${counts[key]}`);
            if (counts[key] === 0) {
                delete counts[key];
            }
        },
        stop() {
            clearInterval(interval);
        },
    };
}
