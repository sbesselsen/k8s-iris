export function formatDeveloperDate(date: Date): string {
    return `${date.getFullYear()}-${leftPad(
        String(date.getMonth() + 1),
        "0",
        2
    )}-${leftPad(String(date.getDate()), "0", 2)}`;
}

export function formatDeveloperDateTime(date: Date): string {
    const now = new Date();
    const dateString = date.toLocaleDateString();
    if (dateString === now.toLocaleDateString()) {
        return date.toLocaleTimeString(undefined, { hour12: false });
    }
    return formatDeveloperDate(date);
}

function leftPad(str: string, pad: string, length: number): string {
    const padLength = length - str.length;
    if (padLength <= 0) {
        return str;
    }
    return (
        pad.repeat(Math.ceil(padLength / pad.length)).substring(0, padLength) +
        str
    );
}
