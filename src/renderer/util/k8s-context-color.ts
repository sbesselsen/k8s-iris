import seedrandom from "seedrandom";
import { ColorTheme } from "../context/color-theme";

const themes: ColorTheme[] = [
    { colorScheme: "gray" },
    { colorScheme: "red" },
    { colorScheme: "orange" },
    { colorScheme: "green" },
    { colorScheme: "teal" },
    { colorScheme: "blue" },
    { colorScheme: "cyan" },
    { colorScheme: "purple" },
    { colorScheme: "pink" },
];

export const k8sAccountIdColor = (accountId: string | null): ColorTheme => {
    if (accountId === null) {
        return themes[0];
    }
    const rand = seedrandom(accountId);
    return themes[Math.floor(rand() * themes.length)];
};
