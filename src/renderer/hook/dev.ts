export function isDev(): boolean {
    return (window as any).isDev ?? false;
}

export function useIsDev(): boolean {
    return isDev();
}
