import { leftPad } from "../../common/util/pad";

export function formatDeveloperDate(date: Date): string {
    return `${date.getFullYear()}-${leftPad(
        String(date.getMonth() + 1),
        "0",
        2
    )}-${leftPad(String(date.getDate()), "0", 2)}`;
}

export function formatDeveloperDateTime(date: Date): string {
    const now = new Date();
    const dateString = date.toLocaleDateString();
    if (dateString === now.toLocaleDateString()) {
        return (
            "today, " +
            (leftPad(String(date.getHours()), "0", 2) +
                ":" +
                leftPad(String(date.getMinutes()), "0", 2))
        );
    }
    return formatDeveloperDate(date);
}
