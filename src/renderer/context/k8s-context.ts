import { useAppRoute } from "./route";

export const useK8sContext = () => useAppRoute((route) => route.context);
