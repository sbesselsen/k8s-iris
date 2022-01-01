import { useEffect, useRef, useState } from "react";

export function useAsync<T>(
    f: () => Promise<T>,
    deps?: any[]
): [boolean, T | undefined, any | undefined] {
    const [value, setValue] = useState<
        [boolean, T | undefined, any | undefined]
    >([true, undefined, undefined]);
    const invocationIndexRef = useRef(0);
    useEffect(() => {
        const invocationIndex = ++invocationIndexRef.current;
        f()
            .then((result) => {
                if (invocationIndex === invocationIndexRef.current) {
                    setValue([false, result, undefined]);
                }
            })
            .catch((err) => {
                if (invocationIndex === invocationIndexRef.current) {
                    setValue([false, undefined, err]);
                }
            });
    }, [setValue, ...deps]);
    return value;
}
