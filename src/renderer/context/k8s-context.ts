import { useAppRoute } from "./route";

export function useK8sContext(): string {
    const context = useOptionalK8sContext();
    if (context === null) {
        throw new Error(
            "useK8sContext() called while context is not available"
        );
    }
    return context;
}

export function useOptionalK8sContext(): string | null {
    return useAppRoute((route) => route.context);
}
