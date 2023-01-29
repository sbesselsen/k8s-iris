export function truncate(str: string, characters: number): string {
    if (str.length <= characters) {
        return str;
    }
    const parts = str.split(/\b/);
    const truncatedParts: string[] = [];
    let remainingLength = characters;
    for (const part of parts) {
        truncatedParts.push(part);
        remainingLength -= part.length;
        if (remainingLength <= 0) {
            truncatedParts.push("…");
            break;
        }
    }
    return truncatedParts.join("");
}
