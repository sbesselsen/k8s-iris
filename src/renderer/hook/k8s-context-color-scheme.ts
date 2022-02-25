import { useMemo } from "react";
import { useK8sContext } from "../context/k8s-context";
import { colorScheme, ColorScheme } from "./color-scheme";

export function useK8sContextColorScheme(context?: string): ColorScheme {
    const currentContext = useK8sContext();

    return useMemo(
        () => k8sContextColorScheme(context ?? currentContext),
        [context, currentContext]
    );
}

export function k8sContextColorScheme(context: string): ColorScheme {
    return colorScheme(`k8sContext:${context}`);
}
