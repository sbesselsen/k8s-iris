export function prefixHandlerChannel(name: string): string {
    return `charmhandler:${name}`;
}

export function prefixSubscriptionChannel(name: string): string {
    return `charmsubscription:${name}`;
}
