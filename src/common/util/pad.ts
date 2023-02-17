export function leftPad(str: string, pad: string, length: number): string {
    const padLength = length - str.length;
    if (padLength <= 0) {
        return str;
    }
    return (
        pad.repeat(Math.ceil(padLength / pad.length)).substring(0, padLength) +
        str
    );
}
