import { iterateJsonArray, iterateJsonEntries } from "../../src/parser/iterateJsonValues.js";
import { BadParse } from "../../src/parser/ParsingException.js";
import { MockStream } from "../mock.js";

const chunked = (source: string, size: number) =>
    Array.from(
        { length: Math.ceil(source.length / size) },
        (_, i) => source.slice(i * size, (i + 1) * size)
    );

describe("iterateJsonArray", () => {
    it("yields each member as a value", async () => {
        const members = [1, "two", null, true, { a: [1, 2] }, []];
        const source = JSON.stringify(members);
        for (const size of [1, 3, 16, 1024]) {
            const received = [] as unknown[];
            for await (const value of iterateJsonArray(chunked(source, size))) {
                received.push(value);
            }
            expect(received).toEqual(members);
        }
    });

    it("yields members split across chunks", async () => {
        const members = Array.from({ length: 50 }, (_, i) => ({ index: i, text: `値 ${i} "]," ` }));
        const source = JSON.stringify(members);
        const received = [] as unknown[];
        for await (const value of iterateJsonArray(chunked(source, 7))) {
            // 反復の合間に await を挟んでも取りこぼさない
            await new Promise(resolve => setTimeout(resolve, 0));
            received.push(value);
        }
        expect(received).toEqual(members);
    });

    it("accepts an empty array", async () => {
        const received = [] as unknown[];
        for await (const value of iterateJsonArray(["[", "]"])) received.push(value);
        expect(received).toEqual([]);
    });

    it("accepts a ReadableStream", async () => {
        const received = [] as unknown[];
        for await (const value of iterateJsonArray(new MockStream(["[1,", "2]"]))) {
            received.push(value);
        }
        expect(received).toEqual([1, 2]);
    });

    it("rejects data that is not an array", async () => {
        const iterate = async () => {
            for await (const _ of iterateJsonArray(['{"a":1}'])) { /* noop */ }
        };
        await expect(iterate()).rejects.toThrow(BadParse);
    });

    it("rejects truncated data", async () => {
        const iterate = async () => {
            for await (const _ of iterateJsonArray(["[1,2"])) { /* noop */ }
        };
        await expect(iterate()).rejects.toThrow(BadParse);
    });
});

describe("iterateJsonEntries", () => {
    it("yields each entry as a key and value", async () => {
        const entries = { a: 1, b: [1, 2], c: { d: "}" }, e: null };
        const source = JSON.stringify(entries);
        for (const size of [1, 5, 1024]) {
            const received = {} as Record<string, unknown>;
            for await (const [key, value] of iterateJsonEntries(chunked(source, size))) {
                received[key] = value;
            }
            expect(received).toEqual(entries);
        }
    });

    it("skips __proto__ handling by yielding it as a plain entry", async () => {
        const received = [] as [string, unknown][];
        for await (const entry of iterateJsonEntries(['{"a":1}'])) received.push(entry);
        expect(received).toEqual([["a", 1]]);
    });

    it("rejects data that is not an object", async () => {
        const iterate = async () => {
            for await (const _ of iterateJsonEntries(["[1]"])) { /* noop */ }
        };
        await expect(iterate()).rejects.toThrow(BadParse);
    });
});
