import { BadParse } from "../../src/parser/ParsingException.js";
import { ParsingJsonObject } from "../../src/parser/ParsingJsonObject.js";
import { MockStream } from "../mock.js";

describe("ParsingJsonObject", () => {

    describe("matchInit", () => {
        it("should return true for valid initial string", () => {
            const initial = "{ \"name\": \"John\", \"age\": 30 }";
            const result = ParsingJsonObject.matchInit(initial);
            expect(result).toBe(true);
        });

        it("should return false for invalid initial string", () => {
            const initial = "invalid";
            const result = ParsingJsonObject.matchInit(initial);
            expect(result).toBe(false);
        });
    });

    describe("type", () => {
        it("should return Object", () => {
            const parser = new ParsingJsonObject();
            const result = parser.type;
            expect(result).toBe(Object);
        });
    });

    const input = "{ \"name\": \"John\", \"age\": 30 }";
    const prototypePollution = "{ \"__proto__\": { \"name\": \"John\", \"age\": 30 } }";
    const expected = { "name": "John", "age": 30 };

    it("should parse empty object", async () => {
        const parser = new ParsingJsonObject();
        MockStream.pipe("{}", parser);
        await expect(parser.all()).resolves.toEqual({});
    });

    it("should parse object", async () => {
        const parser = new ParsingJsonObject();
        MockStream.pipe(input, parser);
        await expect(parser.all()).resolves.toEqual(expected);
    });

    it("should parse object with duplicate key.", async () => {
        const parser = new ParsingJsonObject();
        MockStream.pipe("{ \"name\": \"John\", \"age\": 20, \"age\": 30 }", parser);
        await expect(parser.all()).resolves.toEqual(expected);
    });

    it("should throws error parse object with duplicate key in strict mode.", async () => {
        const parser = new ParsingJsonObject({ strict: true });
        MockStream.pipe("{ \"name\": \"John\", \"age\": 20, \"age\": 30 }", parser);
        await expect(parser.all()).rejects.toThrow(BadParse);
    });

    it("should ignore __proto__ key", async () => {
        const parser = new ParsingJsonObject();
        MockStream.pipe(prototypePollution, parser);
        const result = await parser.all();
        expect(result).toStrictEqual({});
        expect(result.__proto__).toStrictEqual({});
    });

    it("should parse __proto__ key at ignorePrototype is false", async () => {
        const parser = new ParsingJsonObject({ ignorePrototype: false });
        MockStream.pipe(prototypePollution, parser);
        const result = await parser.all();
        expect(result.__proto__).toStrictEqual(expected);
    });

    describe("get", () => {
        it("should return the value for a valid key", async () => {
            const parser = new ParsingJsonObject();
            MockStream.pipe(input, parser);
            const result = await parser.get("name");
            await expect(result?.all()).resolves.toBe("John");
        });

        it("should return undefined for an invalid key", async () => {
            const parser = new ParsingJsonObject();
            MockStream.pipe(input, parser);
            const result = await parser.get("invalid");
            expect(result).toBeUndefined();
        });

        it("should ignore __proto__ key", async () => {
            const parser = new ParsingJsonObject();
            MockStream.pipe(prototypePollution, parser);
            const result = await parser.get("__proto__");
            expect(result).toBeUndefined();
        });
    });

    describe("keys", () => {
        it("should iterate over all keys", async () => {
            const parser = new ParsingJsonObject();
            MockStream.pipe(input, parser);
            const keys = [];
            for await (const key of parser.keys()) {
                keys.push(key);
            }
            expect(keys).toEqual(["name", "age"]);
        });

        it("should ignore __proto__ key", async () => {
            const parser = new ParsingJsonObject();
            MockStream.pipe(prototypePollution, parser);
            const keys = [];
            for await (const key of parser.keys()) {
                keys.push(key);
            }
            expect(keys).toEqual([]);
        });
    });

    describe("entries", () => {
        it("should iterate over all key-value pairs", async () => {
            const parser = new ParsingJsonObject();
            MockStream.pipe(input, parser);
            const entries = [];
            for await (const [key, value] of parser.entries()) {
                entries.push([key, await value.all()]);
            }
            expect(entries).toEqual([["name", "John"], ["age", 30]]);
        });

        it("should ignore __proto__ key", async () => {
            const parser = new ParsingJsonObject();
            MockStream.pipe(prototypePollution, parser);
            const entries = [];
            for await (const [key, value] of parser.entries()) {
                entries.push([key, await value.all()]);
            }
            expect(entries).toEqual([]);
        });
    });
});