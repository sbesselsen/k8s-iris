export function searchMatch(query: string, text: string) {
    const lowerText = text.toLocaleLowerCase();
    const lowerQuery = query.toLocaleLowerCase();
    const parts = lowerQuery.split(/\s+/);
    for (const part of parts) {
        if (lowerText.indexOf(part) === -1) {
            return false;
        }
    }
    return true;
}
