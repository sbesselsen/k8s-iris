export function uniqueOrdered<T>(array: T[]): T[] {
    const prevValues: Set<T> = new Set();
    return array.filter((value) => {
        if (prevValues.has(value)) {
            return false;
        }
        prevValues.add(value);
        return true;
    });
}
