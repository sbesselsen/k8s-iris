import { useIpcKv } from "./ipc-kv";

export function useTempData<T = unknown>(
    key: string
): [boolean, T | undefined, (newValue: T | undefined) => void] {
    return useIpcKv("tempData", key);
}
