export function getHashParams(): Record<string, any> | undefined {
    const hashString = window.location.hash;
    if (hashString && hashString.length > 1) {
        try {
            return JSON.parse(atob(hashString.slice(1)));
        } catch (e) {
            console.error("Cannot parse location hash", e);
        }
    }
    return undefined;
}

export function setHashParams(params: Record<string, any> | undefined) {
    if (!params) {
        window.location.hash = "";
    } else {
        window.location.hash = btoa(JSON.stringify(params));
    }
}
