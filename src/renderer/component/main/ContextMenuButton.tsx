import {
    Button,
    ButtonProps,
    forwardRef,
    IconButtonProps,
} from "@chakra-ui/react";
import React, {
    MouseEventHandler,
    PropsWithChildren,
    ReactNode,
    useCallback,
    useState,
} from "react";
import {
    ContextMenuItemConstructorOptions,
    ContextMenuResult,
    ContextMenuTemplate,
} from "../../../common/contextmenu";
import { useIpcCall } from "../../hook/ipc";

export type ContextMenuButtonProps = ButtonProps &
    IconButtonProps & {
        label?: ReactNode;
        onMenuAction?: (result: { actionId: string }) => void;
        onMenuClose?: (result: ContextMenuResult) => void;
    };

export const ContextMenuButton: React.FC<ContextMenuButtonProps> = forwardRef<
    ContextMenuButtonProps,
    "button"
>((props, ref) => {
    const {
        label,
        onMenuAction,
        onMenuClose,
        onClick: outerOnClick,
        children,
        ...buttonProps
    } = props;

    const menuTemplate = menuTemplateFromChildren(children);
    const popup = useIpcCall((ipc) => ipc.contextMenu.popup);

    const [isMenuActive, setMenuActive] = useState(false);

    const onClick: MouseEventHandler<HTMLButtonElement> = useCallback(
        (e) => {
            outerOnClick?.(e);
            if (!e.isDefaultPrevented() && !isMenuActive) {
                const rect = e.currentTarget.getBoundingClientRect();

                popup({
                    menuTemplate,
                    options: {
                        position: {
                            x: Math.round(rect.left),
                            y: Math.round(rect.bottom),
                        },
                    },
                }).then((result) => {
                    onMenuClose?.(result);
                    if (result.actionId) {
                        onMenuAction?.({ actionId: result.actionId });
                    }
                    setMenuActive(false);
                });
                setMenuActive(true);
            }
        },
        [
            isMenuActive,
            setMenuActive,
            outerOnClick,
            menuTemplate,
            onMenuAction,
            onMenuClose,
        ]
    );

    return (
        <Button
            {...buttonProps}
            isActive={isMenuActive}
            onClick={onClick}
            children={label}
            ref={ref}
        />
    );
});

export type MenuItemProps = Omit<ContextMenuItemConstructorOptions, "submenu">;

export const MenuItem: React.FC<PropsWithChildren<MenuItemProps>> = () => {
    return null;
};

function menuTemplateFromChildren(children: ReactNode): ContextMenuTemplate {
    function processItem(item: any): ContextMenuItemConstructorOptions {
        const { children: _, ...itemProps } = item;
        const result: ContextMenuItemConstructorOptions = itemProps;
        if (item.children) {
            result.submenu = menuTemplateFromChildren(item.children);
        }
        return result;
    }
    const result: ContextMenuTemplate = [];
    React.Children.forEach(children, (child: any) => {
        if (!child) {
            return;
        }
        result.push(processItem(child.props));
    });
    return result;
}
