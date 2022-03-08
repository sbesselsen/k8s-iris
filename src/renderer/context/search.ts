import { create } from "../util/state";

export const [useAppSearchStore, useAppSearch] = create({
    query: "",
});
