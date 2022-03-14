import React, { createContext, useState } from "react";
import { AppRoute } from "../../common/route/app-route";
import { useAppRoute } from "./route";

// TODO: use a store for this somehow

export type AppRouteHistoryHook = {
    canGoBack: boolean;
    canGoForward: boolean;
    goBack: () => void;
    goForward: () => void;
};

type AppRouteHistory = {
    history: AppRoute[];
    currentIndex: number;
    listeners: Array<() => void>;
};

const AppRouteHistoryContext = createContext<AppRouteHistory | null>(null);

export const useAppRouteHistory = (): AppRouteHistoryHook => {
    return {
        canGoBack: true,
        canGoForward: true,
        goBack: () => {
            console.log("back");
        },
        goForward: () => {
            console.log("forward");
        },
    };
};

export const AppRouteHistoryContainer: React.FC = ({ children }) => {
    const [value] = useState({
        history: [],
        currentIndex: -1,
        listeners: [],
    });

    const { history, currentIndex } = value;

    const route = useAppRoute();
    if (history[currentIndex] === route) {
        // We already know about this route (perhaps because we set it.) Ignore.
    } else {
        // Absorb this new information.
        const newHistory =
            history.length > currentIndex
                ? history.slice(0, currentIndex + 1)
                : [...history];
        newHistory.push(route);
        value.history = newHistory;
        value.currentIndex = value.history.length - 1;
    }

    console.log(value.history);

    return React.createElement(
        AppRouteHistoryContext.Provider,
        { value },
        children
    );
};
