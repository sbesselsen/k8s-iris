export type AppRoute = {
    context: string;
    namespaces: AppNamespacesSelection;
};

export type AppNamespacesSelection = string[] | null;

export const emptyAppRoute: AppRoute = {
    context: null,
    namespaces: null,
};
