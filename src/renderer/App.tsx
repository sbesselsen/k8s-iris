import * as React from "react";
import { Context } from "../types/k8s";
import { useIpcCalls } from "../common/ipc/renderer-context";

export const App: React.FC<{}> = () => {
    const ipcCalls = useIpcCalls();

    const [contexts, setContexts] = React.useState<Context[]>([]);

    const onClick = React.useCallback(async () => {
        console.log("getting contexts");
        const newContexts = await ipcCalls.k8s.availableContexts();
        setContexts(contexts.concat(newContexts));
    }, [contexts, setContexts]);

    return (
        <div>
            App <button onClick={onClick}>get contexts</button>
            <ul>
                {contexts.map((context, i) => (
                    <li key={i}>{context.name}</li>
                ))}
            </ul>
        </div>
    );
};
