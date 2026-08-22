import { JsonStreamingParser } from "../src/parser/JsonStreamingParser.js";
import { iterateJsonArray } from "../src/parser/iterateJsonValues.js";
import { stringify } from "../src/stringifier/Stringifyable.js";
import { StringifyingJsonArray } from "../src/stringifier/StringifyingJsonArray.js";
import { type Serializable } from "../src/types.js";

/** 疑似乱数 (再現性のため seed 固定) */
function createRandom(seed: number) {
    let state = seed;
    return () => {
        state = (state * 1103515245 + 12345) % 2147483648;
        return state / 2147483648;
    };
}

const texts = [
    '',
    'ascii text',
    '日本語とえもじ 😀',
    'quote " backslash \\ slash / tab \t newline \n',
    ' padded ',
];

function createValue(random: () => number, depth = 0): Serializable {
    const kind = Math.floor(random() * (depth < 3 ? 7 : 5));
    switch (kind) {
        case 0: return null;
        case 1: return random() < 0.5;
        case 2: return Math.floor(random() * 2000) - 1000;
        case 3: return (random() * 1e6 - 5e5) / 7;
        case 4: return texts[Math.floor(random() * texts.length)];
        case 5: return Array.from(
            { length: Math.floor(random() * 5) },
            () => createValue(random, depth + 1)
        );
        default: {
            const entries = Array.from(
                { length: Math.floor(random() * 5) },
                (_, i) => [
                    `key${i}${random() < 0.3 ? '"' : ''}`,
                    createValue(random, depth + 1)
                ] as const
            );
            return Object.fromEntries(entries);
        }
    }
}

function chunked(source: string, size: number) {
    return Array.from(
        { length: Math.max(1, Math.ceil(source.length / size)) },
        (_, i) => source.slice(i * size, (i + 1) * size)
    );
}

describe("round trip", () => {
    const random = createRandom(20260822);
    const values = Array.from({ length: 40 }, () => createValue(random));

    it("parses what JSON.stringify produced", async () => {
        for (const value of values) {
            const source = JSON.stringify(value) ?? 'null';
            for (const size of [1, 5, 64]) {
                const root = await JsonStreamingParser.readFrom(chunked(source, size)).root();
                await expect(root.all()).resolves.toEqual(value);
            }
        }
    });

    it("writes what JSON.stringify would write", async () => {
        for (const value of values) {
            let written = '';
            for await (const chunk of stringify(value)) written += chunk;
            expect(written).toBe(JSON.stringify(value) ?? 'null');
        }
    });

    it("parses back what the stringifier wrote", async () => {
        const written = await new StringifyingJsonArray(values).all();
        const root = await JsonStreamingParser.readFrom(chunked(written, 37)).root();
        await expect(root.all()).resolves.toEqual(values);
    });

    it("iterates back what the stringifier wrote", async () => {
        const written = await new StringifyingJsonArray(values).all();
        const received = [] as Serializable[];
        for await (const value of iterateJsonArray(chunked(written, 13))) {
            received.push(value);
        }
        expect(received).toEqual(values);
    });
});
