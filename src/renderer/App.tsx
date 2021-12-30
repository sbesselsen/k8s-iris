import React, {
    ChangeEvent,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import { K8sLocation } from "../common/k8s/location";

export const App: React.FunctionComponent = () => {
    const searchString = window.location.search;
    const initialLocation: K8sLocation = useMemo(() => {
        let location: K8sLocation = {};
        if (searchString) {
            location = JSON.parse(atob(searchString.slice(1)));
        }
        return location;
    }, [searchString]);

    return (
        <div>
            {initialLocation.context} / {initialLocation.namespace}
        </div>
    );
};
