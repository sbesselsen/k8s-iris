import { useIpcKv } from "./ipc-kv";

export function usePersistentState<T = unknown>(
    key: string
): [boolean, T | undefined, (newValue: T | undefined) => void] {
    return useIpcKv("persistentState", key);
}
