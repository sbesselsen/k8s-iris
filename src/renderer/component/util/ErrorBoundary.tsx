import React, { ReactNode } from "react";
import { useIsDev } from "../../hook/dev";

export class CoreErrorBoundary extends React.Component<
    { renderError: (error: any) => ReactNode },
    { hasError: boolean; error: any }
> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: any) {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    componentDidCatch(error: any, errorInfo: any) {
        // You can also log the error to an error reporting service
        console.error("Error inside error boundary", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return this.props.renderError(this.state.error);
        }

        return this.props.children;
    }
}

export type ErrorBoundaryProps = {
    renderError: (error: any) => ReactNode;
    isDisabledOnDev?: boolean;
};
export const ErrorBoundary: React.FC<ErrorBoundaryProps> = (props) => {
    const { children, isDisabledOnDev = true, renderError } = props;
    const devMode = useIsDev();
    const isDisabled = isDisabledOnDev && devMode;
    return isDisabled ? (
        <>{children}</>
    ) : (
        <CoreErrorBoundary renderError={renderError}>
            {children}
        </CoreErrorBoundary>
    );
};
