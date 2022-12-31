export type DialogOptions = {
    message: string;
    title?: string;
    detail?: string;
    type?: "none" | "info" | "error" | "question" | "warning";
    textWidth?: number;
    buttons: string[];
    defaultId?: number;
    cancelId?: number;
    attachToWindow?: boolean;
    windowId?: string;
};

export type DialogResult = {
    response: number;
};
