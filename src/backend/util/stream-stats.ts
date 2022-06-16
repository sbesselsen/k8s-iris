import { Transform } from "stream";

export type StreamStatsTransform = Transform & {
    stats(): { sumWritten: number };
};

export function streamStats(): StreamStatsTransform {
    let sumWritten = 0;

    const transform = new Transform({
        transform(chunk, encoding, callback) {
            sumWritten += chunk.length;
            callback(undefined, chunk);
        },
    });
    (transform as StreamStatsTransform).stats = () => ({ sumWritten });
    return transform as StreamStatsTransform;
}
