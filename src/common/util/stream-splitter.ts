export function streamSplitter(
    separator: string | RegExp,
    f: (item: string) => void
): {
    push(chunk: string): void;
    end(): void;
} {
    let currentPart = null;
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
                currentPart = items.pop();
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
