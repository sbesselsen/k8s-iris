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
        systemPreferences.subscribeNotification(
            "AppleColorPreferencesChangedNotification",
            () => {
                // Accent color changed.
                setTimeout(() => {
                    const accentColor = getAccentColor();
                    accentColorWatchers.forEach((l) => l(accentColor));
                }, 100);
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
