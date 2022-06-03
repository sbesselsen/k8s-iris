import { useCallback, useEffect } from "react";

export function useWindowResizeListener(
    f: (dims: { width: number; height: number }) => void,
    deps: any[]
) {
    const listener = useCallback(() => {
        f({ width: window.innerWidth, height: window.innerHeight });
    }, deps);
    useEffect(() => {
        window.addEventListener("resize", listener);
        return () => {
            window.removeEventListener("resize", listener);
        };
    }, [listener]);
}
