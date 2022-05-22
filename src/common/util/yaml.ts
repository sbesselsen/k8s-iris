import { load, dump } from "js-yaml";

export function toYaml(obj: object): string {
    if (!obj) {
        return "";
    }
    return dump(obj, {
        noRefs: true,
        quotingType: '"',
    });
}
export function parseYaml(yaml: string): unknown {
    if (!yaml) {
        return null;
    }
    return load(yaml);
}
