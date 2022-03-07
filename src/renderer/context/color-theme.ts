import { create } from "../util/state";

export type ColorTheme = {
    colorScheme: string;
};

const defaultColorTheme: ColorTheme = {
    colorScheme: "gray",
};

export const [useColorThemeStore, useColorTheme] = create(defaultColorTheme);
