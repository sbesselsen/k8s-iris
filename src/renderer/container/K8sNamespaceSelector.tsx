import { Checkbox, CheckboxGroup, Stack, Text } from "@chakra-ui/react";
import { ChakraStylesConfig, Select } from "chakra-react-select";
import React, { useCallback, useMemo } from "react";
import { searchMatch } from "../../common/util/search";
import {
    useK8sNamespaces,
    useK8sNamespacesStore,
} from "../context/k8s-namespaces";
import { useK8sListWatch } from "../k8s/list-watch";

const selectComponents = {
    DropdownIndicator: null,
};

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
    const namespaceOptions = useMemo(
        () =>
            namespacesList?.items.map((item) => ({
                value: item.metadata.name,
                label: item.metadata.name,
            })) ??
            selectedNamespaces.map((item) => ({ value: item, label: item })),
        [namespacesList, selectedNamespaces]
    );

    console.log({ namespaceOptions });

    const selectValues = useMemo(
        () =>
            namespaceOptions.filter((ns) =>
                selectedNamespaces.includes(ns.value)
            ),
        [namespaceOptions, selectedNamespaces]
    );

    const chakraStyles: ChakraStylesConfig = useMemo(
        () => ({
            control: (provided, _state) => {
                return {
                    ...provided,
                    border: 0,
                    minWidth: "150px",
                };
            },
            menu: (provided, _state) => {
                return {
                    ...provided,
                    minWidth: "min(250px, 100vw)",
                };
            },
        }),
        []
    );

    const onChange = useCallback(
        (values: Array<{ value: string }>) => {
            selectedNamespacesStore.set(values.map(({ value }) => value));
        },
        [selectedNamespacesStore]
    );

    return (
        <Select
            size="sm"
            isMulti
            isClearable={false}
            value={selectValues}
            options={namespaceOptions}
            onChange={onChange}
            filterOption={filterOption}
            chakraStyles={chakraStyles}
            components={selectComponents}
            placeholder="Namespaces..."
        ></Select>
    );
};

function filterOption(option: { value: string }, input: string): boolean {
    return searchMatch(input, option.value);
}
