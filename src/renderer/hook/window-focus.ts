import { useEffect, useState } from "react";

let listeners: Array<(focus: boolean) => void> = [];

let focusState: boolean = true;
(window as any).charm.app.onWindowFocusChange((focus: boolean) => {
    focusState = focus;
    listeners.forEach((l) => l(focusState));
});

export const useWindowFocus = (): boolean => {
    const [_, setRerenderIndex] = useState(0);
    useEffect(() => {
        const listener = () => {
            setRerenderIndex((i) => i + 1);
        };
        listeners.push(listener);
        return () => {
            listeners = listeners.filter((l) => l !== listener);
        };
    }, [setRerenderIndex]);
    return focusState;
};

export const useWindowFocusValue = <T, U>(
    focusedValue: T,
    unfocusedValue: U
): T | U => {
    return useWindowFocus() ? focusedValue : unfocusedValue;
};
