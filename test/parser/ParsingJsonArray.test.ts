import { ParsingJsonArray } from "../../src/parser/ParsingJsonArray.js";
import { ParsingJsonObject } from "../../src/parser/ParsingJsonObject.js";
import { MockStream } from "../mock.js";

describe("ParsingJsonArray", () => {
    it("should match initial character '['", () => {
        const initial = "[";
        const result = ParsingJsonArray.matchInit(initial);
        expect(result).toBe(true);
    });

    it("should not match initial character other than '['", () => {
        const initial = "{";
        const result = ParsingJsonArray.matchInit(initial);
        expect(result).toBe(false);
    });

    it("should have type Array", () => {
        const jsonArray = new ParsingJsonArray();
        expect(jsonArray.type).toBe(Array);
    });

    it("should parse empty array", async () => {
        const jsonArray = new ParsingJsonArray();
        MockStream.pipe("[]", jsonArray);
        await expect(jsonArray.all()).resolves.toEqual([]);
    });

    it("should iterate over parsed JSON objects", async () => {
        const input = `[
            { "name": "John", "age": 30 },
            { "name": "Jane", "age": 25 },
            { "name": "Bob", "age": 40 }
        ]`;
        const expectedObjects = [
            { name: "John", age: 30 },
            { name: "Jane", age: 25 },
            { name: "Bob", age: 40 },
        ];
        const jsonArray = new ParsingJsonArray();
        MockStream.pipe(input, jsonArray);
        let index = 0;
        for await (const parsedObject of jsonArray) {
            expect(parsedObject).toBeInstanceOf(ParsingJsonObject);
            await expect(parsedObject.all()).resolves.toEqual(expectedObjects[index]);
            index++;
        }
        await expect(jsonArray.all()).resolves.toEqual(expectedObjects);
    });
});