import { Checkbox, CheckboxGroup, Stack, Text } from "@chakra-ui/react";
import React, { useCallback, useMemo } from "react";
import {
    useK8sNamespaces,
    useK8sNamespacesStore,
} from "../context/k8s-namespaces";
import { useK8sListWatch } from "../k8s/list-watch";

export const K8sNamespaceSelector: React.FunctionComponent = () => {
    const selectedNamespaces = useK8sNamespaces();
    const selectedNamespacesStore = useK8sNamespacesStore();

    const [_loading, namespacesList] = useK8sListWatch(
        {
            apiVersion: "v1",
            kind: "Namespace",
        },
        []
    );
    const namespaces = useMemo(
        () =>
            namespacesList?.items.map((item) => item.metadata.name) ??
            selectedNamespaces,
        [namespacesList, selectedNamespaces]
    );

    return (
        <CheckboxGroup
            colorScheme="green"
            value={selectedNamespaces}
            onChange={selectedNamespacesStore.set as (value: string[]) => void}
        >
            <Stack spacing={1} direction="column">
                {namespaces.map((namespace) => (
                    <Checkbox value={namespace}>
                        <Text>{namespace}</Text>
                    </Checkbox>
                ))}
            </Stack>
        </CheckboxGroup>
    );
};
