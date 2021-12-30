export function prefixHandlerChannel(name: string): string {
    return `charmhandler:${name}`;
}

export function prefixEventChannel(name: string): string {
    return `charmevent:${name}`;
}
