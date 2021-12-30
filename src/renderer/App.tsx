import React, {
    ChangeEvent,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import { Context } from "../types/k8s";
import { useIpcCalls } from "./contexts/ipc";

export const App: React.FunctionComponent = () => {
    const ipcCalls = useIpcCalls();

    const [contexts, setContexts] = useState<Context[]>([]);
    const [selectedContext, setSelectedContext] = useState<
        string | undefined
    >();

    useEffect(() => {
        (async () => {
            setContexts(await ipcCalls.k8s.availableContexts());
        })();
    }, []);

    const onChange = useCallback(
        (event: ChangeEvent<HTMLSelectElement>) => {
            setSelectedContext(event.target.value);
        },
        [contexts]
    );

    const onClick = useCallback(() => {
        ipcCalls.app.openContext(selectedContext);
    }, [selectedContext]);

    return (
        <div>
            <select onChange={onChange}>
                {contexts.map((ctx) => (
                    <option key={ctx.name} value={ctx.name}>
                        {ctx.name}
                    </option>
                ))}
            </select>
            {selectedContext && (
                <button onClick={onClick}>Go to {selectedContext}</button>
            )}
        </div>
    );
};
