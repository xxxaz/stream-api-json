import { StringifyingJsonArray } from "../../src/stringifier/StringifyingJsonArray.js";
import { StringifyingJsonObject } from "../../src/stringifier/StringifyingJsonObject.js";
import { StringifyingJsonString } from "../../src/stringifier/StringifyingJsonString.js";
import { stringify, type StringifyingJsonEntry } from "../../src/stringifier/Stringifyable.js";
import {
    BadStringify,
    NestedStringifyException,
    StringifyingStreamAborted,
} from "../../src/stringifier/StringifyingException.js";

async function joined(source: AsyncIterable<string>) {
    let text = '';
    for await (const chunk of source) text += chunk;
    return text;
}

describe("stringify", () => {
    it("writes primitives", async () => {
        await expect(joined(stringify(null))).resolves.toBe('null');
        await expect(joined(stringify(undefined as never))).resolves.toBe('null');
        await expect(joined(stringify(1.5))).resolves.toBe('1.5');
        await expect(joined(stringify(true))).resolves.toBe('true');
        await expect(joined(stringify('あ"\\'))).resolves.toBe('"あ\\"\\\\"');
    });

    it("writes nested containers without allocating a stream per value", async () => {
        const value = { a: [1, { b: [null, 'x'] }], c: {} };
        await expect(joined(stringify(value))).resolves.toBe(JSON.stringify(value));
    });

    it("accepts a StringifyingJson as a member", async () => {
        const nested = new StringifyingJsonArray([1, 2]);
        await expect(joined(stringify([nested, 3]))).resolves.toBe('[[1,2],3]');
    });
});

describe("StringifyingJsonArray", () => {
    it("writes members supplied by a generator", async () => {
        async function* members() {
            yield 1;
            yield 'two';
            yield { three: [3] };
        }
        await expect(new StringifyingJsonArray(members()).all())
            .resolves.toBe('[1,"two",{"three":[3]}]');
    });

    it("propagates a failure of the source itself", async () => {
        // 供給元 (generator) が投げた例外はそのまま伝える (書き出しの失敗ではない)
        async function* members() {
            yield 1;
            throw new BadStringify('broken source');
        }
        await expect(new StringifyingJsonArray(members()).all())
            .rejects.toThrow(BadStringify);
    });

    it("wraps a nested failure with its path", async () => {
        const failing = new StringifyingJsonObject([
            ['key', Promise.reject(new BadStringify('deep'))]
        ]);
        const array = new StringifyingJsonArray([0, failing]);
        const caught = await array.all().then(() => null, (err: unknown) => err);
        expect(caught).toBeInstanceOf(NestedStringifyException);
        // 失敗した位置が index で分かる
        expect((caught as NestedStringifyException).message).toContain('$[1]');
    });
});

describe("StringifyingJsonObject", () => {
    it("writes entries supplied by a generator", async () => {
        async function* entries(): AsyncGenerator<StringifyingJsonEntry> {
            yield ['a', 1];
            yield ['b', Promise.resolve([2])];
        }
        await expect(new StringifyingJsonObject(entries()).all())
            .resolves.toBe('{"a":1,"b":[2]}');
    });

    it("skips undefined values", async () => {
        const text = await new StringifyingJsonObject([['a', 1], ['b', undefined], ['c', 3]]).all();
        expect(text).toBe('{"a":1,"c":3}');
    });

    it("skips __proto__ by default", async () => {
        const text = await new StringifyingJsonObject([['__proto__', { x: 1 }], ['a', 2]]).all();
        expect(text).toBe('{"a":2}');
    });

    it("keeps __proto__ when ignorePrototype is disabled", async () => {
        const text = await new StringifyingJsonObject(
            [['__proto__', 1], ['a', 2]],
            { ignorePrototype: false }
        ).all();
        expect(text).toBe('{"__proto__":1,"a":2}');
    });

    it("accepts a StringifyingJsonString as a key", async () => {
        const key = new StringifyingJsonString('キー');
        const text = await new StringifyingJsonObject([[key, 1]]).all();
        expect(text).toBe('{"キー":1}');
    });

    it("rejects a non-string key", async () => {
        // 型では防いでいるが、JS からは渡し得る経路のランタイム検証
        const entries = [[1, 2]] as unknown as StringifyingJsonEntry[];
        await expect(new StringifyingJsonObject(entries).all()).rejects.toThrow(BadStringify);
    });

    it("rejects duplicate keys in strict mode", async () => {
        const object = new StringifyingJsonObject(
            [['a', 1], ['a', 2]],
            { strict: true }
        );
        await expect(object.all()).rejects.toThrow(BadStringify);
    });

    it("allows duplicate keys when not strict", async () => {
        const text = await new StringifyingJsonObject([['a', 1], ['a', 2]]).all();
        expect(text).toBe('{"a":1,"a":2}');
    });
});

describe("StringifyingException", () => {
    it("builds a path from nested causes", () => {
        const cause = new BadStringify('leaf');
        const inner = new NestedStringifyException('"name"', { cause });
        const outer = new NestedStringifyException(2, { cause: inner });
        expect(outer.message).toBe(`at $[2]."name" cause ${String(cause)}`);
        expect(outer.cause).toBe(inner);
    });

    it("reports the abort reason", () => {
        expect(new StringifyingStreamAborted('stopped').message).toBe('stopped');
    });
});
