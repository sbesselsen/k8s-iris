import { useCallback, useEffect, useRef, useState } from "react";

let currentValues: Record<string, boolean> = {};
let listeners: Record<string, Array<(value: boolean) => void>> = {};

function listener(e: KeyboardEvent | MouseEvent) {
    for (const [key, ls] of Object.entries(listeners)) {
        const newValue = e.getModifierState(key);
        if (newValue !== currentValues[key]) {
            currentValues[key] = newValue;
            ls.forEach((l) => l(newValue));
        }
    }
}

function resetAll() {
    for (const [key, ls] of Object.entries(listeners)) {
        if (currentValues[key] !== false) {
            currentValues[key] = false;
            ls.forEach((l) => l(false));
        }
    }
}

window.addEventListener("keydown", listener, true);
window.addEventListener("keyup", listener, true);
window.addEventListener("focus", resetAll);
window.addEventListener("blur", resetAll);

export function useModifierKeyListener(
    key: string,
    listener: (keyPressed: boolean) => void
): void {
    useEffect(() => {
        if (!listeners[key]) {
            listeners[key] = [];
        }
        listeners[key].push(listener);
        return () => {
            listeners[key] = listeners[key].filter((l) => l !== listener);
            if (listeners[key].length === 0) {
                delete listeners[key];
                delete currentValues[key];
            }
        };
    }, [listener]);
}

export function useModifierKeyRef(key: string): { current: boolean } {
    const ref = useRef(false);
    const listener = useCallback(
        (keyPressed: boolean) => {
            ref.current = keyPressed;
        },
        [ref]
    );
    useModifierKeyListener(key, listener);
    return ref;
}

export function useModifierKeyState(key: string): boolean {
    const [pressed, setPressed] = useState(false);
    useModifierKeyListener(key, setPressed);
    return pressed;
}
