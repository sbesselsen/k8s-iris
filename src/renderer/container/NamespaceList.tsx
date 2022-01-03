import React, { useMemo } from "react";
import { useK8sListWatch } from "../k8s/list-watch";

export const NamespaceList: React.FunctionComponent = () => {
    const [loading, namespacesList, error] = useK8sListWatch(
        {
            apiVersion: "v1",
            kind: "Namespace",
        },
        []
    );
    const namespaces = useMemo(
        () => namespacesList?.items.map((item) => item.metadata.name) ?? [],
        [namespacesList]
    );

    return (
        <div>
            {loading && <p>Loading</p>}
            {error && <p>Error: {error}</p>}
            {!loading && !error && (
                <ul>
                    {namespaces.map((ns) => (
                        <li key={ns}>{ns}</li>
                    ))}
                </ul>
            )}
        </div>
    );
};
