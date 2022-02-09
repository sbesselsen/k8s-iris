export function prefixHandlerChannel(name: string): string {
    return `charmhandler:${name}`;
}

export function prefixSubscriptionChannel(name: string): string {
    return `charmsubscription:${name}`;
}

export type WrappedError = {
    message: string;
    name: string;
    data: Record<string, any>;
};

export function wrapError(error: any): WrappedError {
    if (!error) {
        return { name: "Error", message: String(error), data: {} };
    }
    if (typeof error === "string") {
        return { name: "Error", message: error, data: {} };
    }
    const data = JSON.parse(JSON.stringify(error));
    if (error instanceof Error) {
        return { name: error.name, message: error.message, data };
    }
    return {
        name: error.name ?? "Error",
        message: error.message ?? String(error),
        data,
    };
}

export function unwrapError(wrappedError: WrappedError): Error {
    const error = new Error(wrappedError.message);
    error.name = wrappedError.name;
    Object.assign(error, wrappedError.data);
    return error;
}
