import { TableBodyProps, Tbody, Tr } from "@chakra-ui/react";
import React, { Children, ReactNode } from "react";
import {
    ViewportLazyContainer,
    ViewportLazyContainerProps,
    ViewportLazyRenderParams,
} from "./ViewportLazyContainer";

export type ViewportLazyTbodyProps = TableBodyProps &
    Omit<ViewportLazyContainerProps, "render"> & {
        chunkSize?: number;
    };

export const ViewportLazyTbody: React.FC<ViewportLazyTbodyProps> = (props) => {
    const {
        chunkSize = 1000,
        defaultHeight,
        rootMargin,
        children,
        ...tbodyProps
    } = props;

    const rows: ReactNode[] | null | undefined = Children.map(
        children,
        (child) => child
    );

    const rowChunks: ReactNode[][] = [];
    if (rows) {
        for (let i = 0; i < rows.length; i += chunkSize) {
            rowChunks.push(rows.slice(i, i + chunkSize));
        }
    }

    const renderTbody = ({
        ref,
        height,
        children,
    }: ViewportLazyRenderParams) => (
        <Tbody ref={ref} {...tbodyProps}>
            {height !== undefined && <Tr height={height}></Tr>}
            {children}
        </Tbody>
    );

    return (
        <>
            {rowChunks.map((rows, i) => (
                <ViewportLazyContainer
                    key={i}
                    defaultHeight={defaultHeight}
                    rootMargin={rootMargin}
                    render={renderTbody}
                >
                    {rows}
                </ViewportLazyContainer>
            ))}
        </>
    );
};
