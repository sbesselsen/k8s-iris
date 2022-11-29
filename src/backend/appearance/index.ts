import { systemPreferences } from "electron/main";

export type AppearanceManager = {
    getAccentColor(): string;
    watchAccentColor(listener: (newAccentColor: string) => void): {
        stop: () => void;
    };
};

export function createAppearanceManager(): AppearanceManager {
    let accentColorWatchers: Array<(newAccentColor: string) => void> = [];

    function getAccentColor(): string {
        return "#" + systemPreferences.getAccentColor();
    }

    if (process.platform === "win32") {
        systemPreferences.addListener("accent-color-changed", () => {
            // Accent color changed.
            const accentColor = getAccentColor();
            accentColorWatchers.forEach((l) => l(accentColor));
        });
    } else {
        systemPreferences.subscribeNotification(
            "AppleInterfaceThemeChangedNotification",
            () => {
                // Dark/light mode changed.
            }
        );

        let currentAccentColor = getAccentColor();
        systemPreferences.subscribeNotification(
            "AppleColorPreferencesChangedNotification",
            () => {
                for (const ms of [100, 1000]) {
                    // Accent color changed.
                    // We check twice because sometimes getAccentColor() still reports
                    // the old value after 100ms.
                    setTimeout(() => {
                        const newAccentColor = getAccentColor();
                        if (newAccentColor !== currentAccentColor) {
                            currentAccentColor = newAccentColor;
                            accentColorWatchers.forEach((l) =>
                                l(newAccentColor)
                            );
                        }
                    }, ms);
                }
            }
        );
    }

    return {
        getAccentColor,
        watchAccentColor(listener) {
            accentColorWatchers.push(listener);
            return {
                stop() {
                    accentColorWatchers = accentColorWatchers.filter(
                        (l) => l !== listener
                    );
                },
            };
        },
    };
}
