import { BadgeProps } from "@chakra-ui/react";
import { K8sObject } from "../../common/k8s/client";

export type ResourceBadge = {
    id: string;
    text: string;
    variant?: "positive" | "negative" | "changing" | "other";
    details?: string;
    badgeProps?: BadgeProps;
};

export function generateBadges(resource: K8sObject): ResourceBadge[] {
    return [
        isNewBadges,
        deploymentStatusBadges,
        podStatusBadges,
        isDeletingBadges,
    ].flatMap((f) => f(resource));
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

export function deploymentStatusBadges(resource: K8sObject): ResourceBadge[] {
    const badges: ResourceBadge[] = [];
    if (resource.apiVersion !== "apps/v1" || resource.kind !== "Deployment") {
        return badges;
    }

    const conditions: any[] = (resource as any)?.status?.conditions ?? [];
    const unavailableCondition = conditions.find(
        (c) => c.type === "Available" && c.status === "False"
    );
    if (unavailableCondition) {
        badges.push({
            id: "deployment-status-unavailable",
            text: "unavailable",
            variant: "negative",
            details: unavailableCondition.message,
        });
    }
    const notProgressingCondition = conditions.find(
        (c) => c.type === "Progressing" && c.status === "False"
    );
    if (notProgressingCondition) {
        badges.push({
            id: "deployment-status-not-progressing",
            text: "stuck",
            variant: "negative",
            details: notProgressingCondition.message,
        });
    }
    const progressingChangingCondition = conditions.find(
        (c) =>
            c.type === "Progressing" &&
            c.status === "True" &&
            (c.reason === "NewReplicaSetCreated" ||
                c.reason === "FoundNewReplicaSet" ||
                c.reason === "ReplicaSetUpdated")
    );
    if (progressingChangingCondition) {
        badges.push({
            id: "deployment-status-progressing",
            text: "progressing",
            variant: "changing",
            details: progressingChangingCondition.message,
        });
    }

    return badges;
}

export function podStatusBadges(resource: K8sObject): ResourceBadge[] {
    const badges: ResourceBadge[] = [];
    if (resource.apiVersion !== "v1" || resource.kind !== "Pod") {
        return badges;
    }
    switch ((resource as any)?.status?.phase) {
        case "Pending":
            badges.push({
                id: "pod-status-pending",
                text: "pending",
                variant: "changing",
            });
            break;
        case "Succeeded":
            badges.push({
                id: "pod-status-succeeded",
                text: "succeeded",
                variant: "positive",
            });
            break;
        case "Failed":
            badges.push({
                id: "pod-status-failed",
                text: "failed",
                variant: "negative",
            });
            break;
        case "Unknown":
            badges.push({ id: "pod-status-unknown", text: "unknown" });
            break;
    }

    return badges;
}

export function isDeletingBadges(resource: K8sObject): ResourceBadge[] {
    const isDeleting = Boolean((resource as any).metadata.deletionTimestamp);
    return isDeleting
        ? [{ id: "is-deleting", text: "deleting", variant: "negative" }]
        : [];
}
