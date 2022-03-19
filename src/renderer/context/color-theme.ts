import { create } from "../util/state";

export type ColorTheme = {
    colorScheme: string;
};

const defaultColorTheme: ColorTheme = {
    colorScheme: "gray",
};

export const { useStoreValue: useColorTheme, useStore: useColorThemeStore } =
    create(defaultColorTheme);
