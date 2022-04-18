import React from "react";
import { formatDeveloperDate } from "../../util/date";

export const Datetime: React.FC<{
    value: string | number | null | undefined;
}> = (props) => {
    const { value } = props;

    const parsedDate =
        typeof value === "number" ? value : Date.parse(value ?? "");
    if (isNaN(parsedDate)) {
        return null;
    }

    const now = new Date();
    const currentDateString = formatDeveloperDate(now);

    const date = new Date(parsedDate);
    const timeString = date.toLocaleTimeString(undefined, { hour12: false });
    let dateString = formatDeveloperDate(date);
    if (dateString === currentDateString) {
        dateString = "today";
    }

    return (
        <>
            {dateString}, {timeString}
        </>
    );
};
