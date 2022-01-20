import { ChakraStylesConfig, Select } from "chakra-react-select";
import React, { useCallback, useMemo } from "react";
import { searchMatch } from "../../../common/util/search";
import { useK8sNamespaces } from "../../context/k8s-namespaces";
import { useAppRouteActions } from "../../context/route";
import { useK8sListWatch } from "../../k8s/list-watch";

const selectComponents = {
    DropdownIndicator: null,
};

export const K8sNamespaceSelector: React.FunctionComponent = () => {
    const selectedNamespaces = useK8sNamespaces();
    const { selectNamespaces } = useAppRouteActions();

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
            multiValue: (provided, _state) => {
                return {
                    ...provided,
                    alignItems: "start",
                };
            },
        }),
        []
    );

    const onChange = useCallback(
        (values: Array<{ value: string }>) => {
            selectNamespaces(values.map(({ value }) => value));
        },
        [selectNamespaces]
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