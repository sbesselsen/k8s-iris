import { useAppRoute } from "./route";

export const useK8sNamespaces = () => useAppRoute((route) => route.namespaces);
