import ColorSchemeCalculator from "color-scheme";
import seedrandom from "seedrandom";
import { useMemo, useState } from "react";

export type ColorScheme = {
    background: string;
    text: string;
    border: string;
    fill: string;
};

export function useColorScheme(seed?: string): ColorScheme {
    const [randomSeed] = useState(() => `rand:${Math.random()}`);

    return useMemo(() => colorScheme(seed ?? randomSeed), [randomSeed, seed]);
}

export function colorScheme(seed?: string): ColorScheme {
    if (!seed) {
        seed = `rand:${Math.random()}`;
    }
    const prng = seedrandom(seed);

    const calc = new ColorSchemeCalculator();
    calc.from_hue(Math.round(prng() * 360));

    calc.variation("hard");
    const colors = calc.colors();

    return {
        background: "#" + colors[2],
        text: "#" + colors[1],
        border: "#" + colors[3],
        fill: "#" + colors[0],
    };
}
