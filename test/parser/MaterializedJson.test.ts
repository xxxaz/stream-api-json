import { MaterializedJson } from "../../src/parser/MaterializedJson.js";
import { JsonStreamingParser } from "../../src/parser/JsonStreamingParser.js";
import { ParsingJsonArray } from "../../src/parser/ParsingJsonArray.js";
import { ParsingJsonObject } from "../../src/parser/ParsingJsonObject.js";
import { IncompleteParse } from "../../src/parser/ParsingException.js";

describe("MaterializedJson", () => {
    it("reports the type of the held value", () => {
        expect(new MaterializedJson(null, 'null').type).toBe(null);
        expect(new MaterializedJson(true, 'true').type).toBe(Boolean);
        expect(new MaterializedJson(1, '1').type).toBe(Number);
        expect(new MaterializedJson('a', '"a"').type).toBe(String);
        expect(new MaterializedJson([1], '[1]').type).toBe(Array);
        expect(new MaterializedJson({ a: 1 }, '{"a":1}').type).toBe(Object);
    });

    it("is already completed", async () => {
        const value = new MaterializedJson({ a: 1 }, '{"a":1}');
        expect(value.completed).toBe(true);
        expect(value.stopped).toBe(false);
        expect(value.source).toBe('{"a":1}');
        await expect(value.all()).resolves.toEqual({ a: 1 });
        await expect(value.waitNext()).resolves.toBeUndefined();
        expect(value.toJSON()).toEqual({ a: 1 });
    });

    it("throws from toJSON when the value is missing", () => {
        const value = new MaterializedJson(undefined as never, '');
        expect(() => value.toJSON()).toThrow(IncompleteParse);
    });
});

describe("iteration after the value is materialized", () => {
    it("yields array members from the materialized value", async () => {
        const root = await JsonStreamingParser.readFrom(['[1,{"a":2},"x"]']).root();
        // まず全体値を取り (= 子ノードを作らない経路)、その後で反復する
        await expect(root.all()).resolves.toEqual([1, { a: 2 }, 'x']);
        expect(root).toBeInstanceOf(ParsingJsonArray);

        const received = [] as unknown[];
        for await (const member of root as ParsingJsonArray<any>) {
            expect(member.completed).toBe(true);
            received.push(await member.all());
        }
        expect(received).toEqual([1, { a: 2 }, 'x']);
    });

    it("yields object entries and keys from the materialized value", async () => {
        const root = await JsonStreamingParser.readFrom(['{"a":1,"b":[2]}']).root();
        await expect(root.all()).resolves.toEqual({ a: 1, b: [2] });
        expect(root).toBeInstanceOf(ParsingJsonObject);

        const object = root as ParsingJsonObject<any>;
        const keys = [] as unknown[];
        for await (const key of object.keys()) keys.push(key);
        expect(keys).toEqual(['a', 'b']);

        const entries = [] as [string, unknown][];
        for await (const [key, value] of object.entries()) {
            entries.push([key, await value.all()]);
        }
        expect(entries).toEqual([['a', 1], ['b', [2]]]);

        expect(object.currentKeys).toEqual(['a', 'b']);
        await expect((await object.get('b'))?.all()).resolves.toEqual([2]);
    });

    it("keeps __proto__ out of the materialized value", async () => {
        const root = await JsonStreamingParser.readFrom(['{"__proto__":{"x":1},"a":2}']).root();
        const value = await root.all() as Record<string, unknown>;
        expect(Object.keys(value)).toEqual(['a']);
    });
});
