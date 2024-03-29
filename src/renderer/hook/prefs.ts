import { useIpcKv } from "./ipc-kv";

export function usePref<T = unknown>(
    key: string
): [boolean, T | undefined, (newValue: T | undefined) => void] {
    return useIpcKv("prefs", key);
}
