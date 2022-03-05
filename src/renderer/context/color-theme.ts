import { create } from "../util/state";

export type ColorTheme = {
    colorScheme: string;
};

const defaultColorTheme: ColorTheme = {
    colorScheme: "pink",
};

export const [useColorThemeStore, useColorTheme] = create(defaultColorTheme);
