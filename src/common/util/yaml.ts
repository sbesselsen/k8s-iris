import * as YAML from "yaml";

export function toYaml(obj: object): string {
    const doc = new YAML.Document();
    doc.contents = obj;
    return doc.toString();
}
export function parseYaml(yaml: string): unknown {
    return YAML.parse(yaml);
}
