import { create } from "../util/state";

let kubeContext: string | null = null;
const searchString = window.location.search;
if (searchString) {
    kubeContext = JSON.parse(atob(searchString.slice(1))).context ?? null;
}

export const [useKubeContextStore, useKubeContext] = create(kubeContext);
