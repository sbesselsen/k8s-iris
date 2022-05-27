import React, { createContext, useContext, useEffect } from "react";

const HibernateContext = createContext(false);

export function useHibernate(): boolean {
    return useContext(HibernateContext);
}

export const HibernateContainer: React.FC<{
    hibernate?: true | false | "inherit";
}> = (props) => {
    const { hibernate = "inherit", children } = props;

    const parentValue = useHibernate();

    return React.createElement(
        HibernateContext.Provider,
        { value: hibernate === "inherit" ? parentValue : hibernate },
        children
    );
};
