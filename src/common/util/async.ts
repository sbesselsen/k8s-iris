export async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
}

export function debounce<T extends () => void>(f: T, ms: number): T {
    let timeout: any;
    return ((...args) => {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => {
            f(...args);
        }, ms);
    }) as T;
}

export function coalesce<T extends () => void>(f: T, ms: number): T {
    let timeout: any;
    return (() => {
        if (timeout) {
            return;
        }
        timeout = setTimeout(() => {
            f();
            timeout = null;
        }, ms);
    }) as T;
}

export function coalesceValues<T>(
    f: (values: T[]) => void,
    ms: number
): (value: T) => void {
    let collectedValues: T[] = [];
    const coalescedF = coalesce(() => {
        const values = collectedValues;
        collectedValues = [];
        f(values);
    }, ms);
    return (value) => {
        collectedValues.push(value);
        coalescedF();
    };
}
