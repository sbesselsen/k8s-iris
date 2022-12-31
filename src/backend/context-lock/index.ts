export type ContextLockWatcher = (
    error: undefined | any,
    message?: undefined | { locked: boolean }
) => void;

export type ContextLockManager = {
    get(context: string): boolean;
    set(context: string, locked: boolean | null | undefined): void;
    watch(context: string, receive: ContextLockWatcher): { stop: () => void };
};

export function createContextLockManager(): ContextLockManager {
    const locks: Record<string, boolean> = {};
    const watchers: Record<string, ContextLockWatcher[]> = {};

    function triggerWatchers(context: string) {
        const locked = lockValue(locks, context);
        (watchers[context] ?? []).forEach((w) => w(undefined, { locked }));
    }

    return {
        get(context) {
            return lockValue(locks, context);
        },
        set(context, locked) {
            const prevValue = locks[context];
            if (locked === null || locked === undefined) {
                delete locks[context];
            } else {
                locks[context] = locked;
            }
            if (locks[context] !== prevValue) {
                triggerWatchers(context);
            }
        },
        watch(context, receive) {
            if (!watchers[context]) {
                watchers[context] = [];
            }
            watchers[context].push(receive);
            receive(undefined, { locked: lockValue(locks, context) });
            return {
                stop() {
                    watchers[context] = watchers[context].filter(
                        (w) => w !== receive
                    );
                },
            };
        },
    };
}

function lockValue(
    locks: Record<string, boolean>,
    context: string | null | undefined
): boolean {
    return context ? locks[context] ?? autoLockValue(context) : false;
}

function autoLockValue(context: string): boolean {
    return !!(context.match(/prod/) && !context.match(/non-?prod/));
}
