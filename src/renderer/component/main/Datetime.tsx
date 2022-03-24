import React from "react";

export const Datetime: React.FC<{ value: string | null | undefined }> = (
    props
) => {
    const { value } = props;

    const parsedDate = Date.parse(value ?? "");
    if (isNaN(parsedDate)) {
        return null;
    }

    const now = new Date();
    const currentDateString = now.toLocaleDateString(undefined);

    const date = new Date(parsedDate);
    const timeString = date.toLocaleTimeString(undefined, { hour12: false });
    let dateString = date.toLocaleDateString(undefined, { hour12: false });
    if (dateString === currentDateString) {
        dateString = "today";
    }

    return (
        <>
            {dateString}, {timeString}
        </>
    );
};
