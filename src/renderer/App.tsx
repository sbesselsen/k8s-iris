import React, { useEffect, useMemo, useState } from "react";

import { Context } from "../types/k8s";
import { useIpcCalls } from "./contexts/ipc";

export const App: React.FunctionComponent = () => {
    const ipcCalls = useIpcCalls();

    const [contexts, setContexts] = useState<Context[]>([]);

    useEffect(() => {
        (async () => {
            setContexts(await ipcCalls.k8s.availableContexts());
        })();
    }, []);

    return (
        <div>
            <select>
                {contexts.map((ctx) => (
                    <option key={ctx.name}>{ctx.name}</option>
                ))}
            </select>
        </div>
    );
};
