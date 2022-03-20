import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
} from "react";
import { AppRoute } from "../../common/route/app-route";
import { StoreUpdate } from "../util/state";
import { useAppRoute, useAppRouteActions } from "./route";

export type AppRouteParamSetter<T> = (
    newValue: StoreUpdate<T>,
    replace?: boolean
) => void;

const NamespaceContext = createContext<string | null>(null);

export const ParamNamespace: React.FC<{ name: string }> = (props) => {
    const { name, children } = props;
    const parentNamespace = useContext(NamespaceContext);
    const fullNamespace = parentNamespace ? `${parentNamespace}/${name}` : name;
    return React.createElement(
        NamespaceContext.Provider,
        { value: fullNamespace },
        children
    );
};

export function useAppParam<T>(
    name: string,
    initialValue: T
): [T, AppRouteParamSetter<T>] {
    if (name.indexOf("/") !== -1) {
        console.error(
            `Invalid name for useAppParam: ${name}. May not contain a slash`
        );
    }
    const namespace = useContext(NamespaceContext);
    const fullName = namespace ? `${namespace}/${name}` : name;

    const { setAppRoute } = useAppRouteActions();

    const initialValueRef = useRef(initialValue);

    const getValueFromRoute = useCallback(
        (route: AppRoute): T => {
            return fullName in route.params
                ? (route.params[fullName] as T)
                : initialValueRef.current;
        },
        [fullName, initialValueRef]
    );

    const value = useAppRoute(getValueFromRoute);

    const setValue: AppRouteParamSetter<T> = useCallback(
        (newValue, replace = false) => {
            setAppRoute((route) => {
                const value =
                    typeof newValue === "function"
                        ? (newValue as (oldValue: T) => T)(
                              getValueFromRoute(route)
                          )
                        : newValue;
                return {
                    ...route,
                    params: {
                        ...route.params,
                        [fullName]: value,
                    },
                };
            }, replace);
        },
        [fullName, setAppRoute]
    );

    useEffect(() => {
        return () => {
            // Remove this param after unmount (or name change).
            setAppRoute((route) => {
                const { [fullName]: _, ...params } = route.params;
                return {
                    ...route,
                    params,
                };
            }, true);
        };
    }, [initialValueRef, fullName, setAppRoute, setValue]);

    return [value, setValue];
}
