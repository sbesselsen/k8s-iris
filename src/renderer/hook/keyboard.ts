import { useCallback, useEffect, useRef, useState } from "react";
import { useHibernate } from "../context/hibernate";

const currentValues: Record<string, boolean> = {};
const modifierKeyListeners: Record<
    string,
    Array<(value: boolean) => void>
> = {};
let keyListeners: Array<
    (eventType: string, key: string, e: KeyboardEvent) => void
> = [];

function globalModifierKeyListener(e: KeyboardEvent) {
    for (const [key, ls] of Object.entries(modifierKeyListeners)) {
        const newValue = e.getModifierState(key);
        if (newValue !== currentValues[key]) {
            currentValues[key] = newValue;
            ls.forEach((l) => l(newValue));
        }
    }
}

function globalKeyListener(eventType: string): (e: KeyboardEvent) => void {
    return (e: KeyboardEvent) => {
        keyListeners.forEach((kl) => kl(eventType, e.key, e));
    };
}

function resetAll() {
    for (const [key, ls] of Object.entries(modifierKeyListeners)) {
        if (currentValues[key] !== false) {
            currentValues[key] = false;
            ls.forEach((l) => l(false));
        }
    }
}

window.addEventListener("keydown", globalModifierKeyListener, true);
window.addEventListener("keyup", globalModifierKeyListener, true);
window.addEventListener("focus", resetAll);
window.addEventListener("blur", resetAll);

window.addEventListener("keydown", globalKeyListener("keydown"), true);
window.addEventListener("keyup", globalKeyListener("keyup"), true);
window.addEventListener("keypress", globalKeyListener("keypress"), true);

export function useModifierKeyListener(
    key: string,
    listener: (keyPressed: boolean) => void
): void {
    useEffect(() => {
        if (!modifierKeyListeners[key]) {
            modifierKeyListeners[key] = [];
        }
        modifierKeyListeners[key].push(listener);
        return () => {
            modifierKeyListeners[key] = modifierKeyListeners[key].filter(
                (l) => l !== listener
            );
            if (modifierKeyListeners[key].length === 0) {
                delete modifierKeyListeners[key];
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

export function useModifierKey(key: string): boolean {
    const [pressed, setPressed] = useState(false);
    useModifierKeyListener(key, setPressed);
    return pressed;
}

export function useKeyListener(
    listener: (eventType: string, key: string, e: KeyboardEvent) => void
): void {
    const hibernate = useHibernate();
    useEffect(() => {
        if (hibernate) {
            return;
        }
        keyListeners.push(listener);
        return () => {
            keyListeners = keyListeners.filter((kl) => kl !== listener);
        };
    }, [hibernate, listener]);
}
