export type AppRoute = {
    context: string;
    namespaces: AppNamespacesSelection;
    menuItem?: string;
    contentRoute?: any | undefined;
};

export type AppNamespacesSelection = {
    mode: "all" | "selected";
    selected: string[];
};

export const emptyAppRoute: AppRoute = {
    context: null,
    namespaces: {
        mode: "all",
        selected: [],
    },
    menuItem: "cluster",
};
