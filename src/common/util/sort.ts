const otaWordsRegex = /(dev|test|acc|prod|ota|non-prod)/i;
const otaWordsReplacement = {
    dev: ":00:",
    test: ":01:",
    ota: ":01:",
    acc: ":02:",
    "non-prod": ":02:",
    prod: ":03:",
};

export function k8sSmartCompare(a: any, b: any): number {
    if (a === null || a === undefined) {
        if (b === null || b === undefined) {
            return 0;
        }
        return -1;
    }
    if (b === null || b === undefined) {
        return 1;
    }
    let aString = String(a);
    let bString = String(b);
    if (aString.match(otaWordsRegex) && bString.match(otaWordsRegex)) {
        aString = aString.replace(
            otaWordsRegex,
            (word) => otaWordsReplacement[word.toLowerCase()] ?? word
        );
        bString = bString.replace(
            otaWordsRegex,
            (word) => otaWordsReplacement[word.toLowerCase()] ?? word
        );
    }
    return aString.localeCompare(bString, undefined, {
        sensitivity: "base",
        numeric: true,
        ignorePunctuation: true,
    });
}
