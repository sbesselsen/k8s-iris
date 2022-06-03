import { BadgeProps } from "@chakra-ui/react";
import { K8sObject } from "../../common/k8s/client";

export type ResourceBadge = {
    id: string;
    text: string;
    variant?: "positive" | "negative" | "changing" | "other";
    badgeProps?: BadgeProps;
};

export function generateBadges(resource: K8sObject): ResourceBadge[] {
    return [isNewBadges, isDeletingBadges].flatMap((f) => f(resource));
}

export function isNewBadges(resource: K8sObject): ResourceBadge[] {
    const creationDate = new Date((resource as any).metadata.creationTimestamp);
    const isNew =
        new Date().getTime() - creationDate.getTime() < 2 * 3600 * 1000;
    const isDeleting = Boolean((resource as any).metadata.deletionTimestamp);
    return isNew && !isDeleting
        ? [{ id: "is-new", text: "new", variant: "positive" }]
        : [];
}

export function isDeletingBadges(resource: K8sObject): ResourceBadge[] {
    const isDeleting = Boolean((resource as any).metadata.deletionTimestamp);
    return isDeleting
        ? [{ id: "is-deleting", text: "deleting", variant: "negative" }]
        : [];
}
