import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
} from "react";
import { AppRoute } from "../../common/route/app-route";
import { StoreUpdate } from "../util/state";
import { useAppRoute, useAppRouteGetter, useAppRouteSetter } from "./route";

export type AppRouteParamSetter<T> = ((
    newValue: StoreUpdate<T>,
    replace?: boolean
) => void) & {
    asRoute: (newValue: StoreUpdate<T>, fromRoute?: AppRoute) => AppRoute;
};

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

    const initialValueRef = useRef(initialValue);

    const getValueFromRoute = useCallback(
        (route: AppRoute): T => {
            return fullName in route.params
                ? (route.params[fullName] as T)
                : initialValueRef.current;
        },
        [fullName, initialValueRef]
    );

    const produceAppRoute = useCallback(
        (route: AppRoute, newValue: StoreUpdate<T>): AppRoute => {
            const value =
                typeof newValue === "function"
                    ? (newValue as (oldValue: T) => T)(getValueFromRoute(route))
                    : newValue;
            return {
                ...route,
                params: {
                    ...route.params,
                    [fullName]: value,
                },
            };
        },
        [getValueFromRoute]
    );

    const value = useAppRoute(getValueFromRoute);

    const getAppRoute = useAppRouteGetter();
    const setAppRoute = useAppRouteSetter();

    const setValue: AppRouteParamSetter<T> = useMemo(() => {
        const result = ((newValue, replace = false) => {
            setAppRoute((route) => produceAppRoute(route, newValue), replace);
        }) as AppRouteParamSetter<T>;
        result.asRoute = (newValue, fromRoute = undefined) =>
            produceAppRoute(fromRoute ?? getAppRoute(), newValue);

        return result;
    }, [getAppRoute, fullName, produceAppRoute, setAppRoute]);

    return [value, setValue];
}
