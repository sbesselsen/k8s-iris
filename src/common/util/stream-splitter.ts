export function streamSplitter(
    separator: string | RegExp,
    f: (item: string) => void
): {
    push(chunk: string): void;
    end(): void;
} {
    let currentPart: string | null = null;
    return {
        push(chunk) {
            if (chunk.length === 0) {
                return;
            }
            if (currentPart === null) {
                currentPart = chunk;
            } else {
                currentPart += chunk;
            }
            const items = currentPart.split(separator);
            if (items.length > 0) {
                currentPart = items.pop() as string;
                items.forEach(f);
            }
        },
        end() {
            if (currentPart !== null) {
                f(currentPart);
                currentPart = null;
            }
        },
    };
}
