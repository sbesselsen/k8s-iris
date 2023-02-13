import React, {
    MutableRefObject,
    PropsWithChildren,
    ReactNode,
    useLayoutEffect,
    useRef,
    useState,
} from "react";

export type ViewportLazyRenderParams = {
    ref: MutableRefObject<any>;
    height: string | undefined;
    children: ReactNode | undefined;
};

export type ViewportLazyContainerProps = PropsWithChildren<{
    defaultHeight: string;
    render: (params: ViewportLazyRenderParams) => ReactNode;
    rootMargin?: string;
}>;

export const ViewportLazyContainer: React.FC<ViewportLazyContainerProps> = (
    props
) => {
    const { defaultHeight, render, rootMargin, children } = props;

    const [isVisible, setVisible] = useState(false);

    const observerRef = useRef<IntersectionObserver | undefined>();
    const elementRef = useRef<any | undefined>();
    const heightRef = useRef<string | undefined>();

    useLayoutEffect(() => {
        if (!elementRef.current) {
            return;
        }

        function getScrollRoot(node: Element | null): Element | null {
            if (!node || node.scrollHeight > node.clientHeight) {
                return node;
            }
            return getScrollRoot(node.parentNode as Element);
        }

        const observer = new IntersectionObserver(
            (entries) => {
                let visible = false;
                for (const entry of entries) {
                    if (entry.target === elementRef.current) {
                        visible = entry.isIntersecting;
                    }
                }
                if (visible !== isVisible) {
                    if (visible) {
                        // The element is coming into view. Drop our current remembered height.
                        heightRef.current = undefined;
                    } else {
                        // The element is going out of view. Remember its height.
                        heightRef.current =
                            elementRef.current?.getBoundingClientRect().height;
                    }
                    setVisible(visible);
                }
            },
            {
                root: getScrollRoot(elementRef.current),
                ...(rootMargin ? { rootMargin } : {}),
            }
        );
        observerRef.current = observer;
        observer.observe(elementRef.current);
        return () => {
            observer.disconnect();
            observerRef.current = undefined;
        };
    }, [elementRef, heightRef, isVisible, observerRef, rootMargin, setVisible]);

    const element = render({
        ref: elementRef,
        height: isVisible ? undefined : heightRef.current ?? defaultHeight,
        children: isVisible ? children : undefined,
    });

    return <>{element}</>;
};
