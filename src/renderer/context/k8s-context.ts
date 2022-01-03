import { create } from "../util/state";

let defaultK8sContext: string | null = null;
const searchString = window.location.search;
if (searchString) {
    defaultK8sContext = JSON.parse(atob(searchString.slice(1))).context ?? null;
}

export const [useK8sContextStore, useK8sContext] = create(defaultK8sContext);
