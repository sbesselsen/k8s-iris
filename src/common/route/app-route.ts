export type AppRoute = {
    context: string;
    namespaces: AppNamespacesSelection;
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
};
