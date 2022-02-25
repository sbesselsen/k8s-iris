import { app } from "electron";

export const isDev = (): boolean => {
    return !app.isPackaged && process.env.ELECTRON_DEV !== "0";
};
