import { create } from "../util/state";

export const { useStore: useAppSearchStore, useStoreValue: useAppSearch } =
    create({
        query: "",
    });
