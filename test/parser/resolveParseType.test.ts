import { ParsingJsonArray } from "../../src/parser/ParsingJsonArray.js";
import { ParsingJsonFalse, ParsingJsonNull, ParsingJsonTrue } from "../../src/parser/ParsingJsonFixed.js";
import { ParsingJsonNumber } from "../../src/parser/ParsingJsonNumber.js";
import { ParsingJsonObject } from "../../src/parser/ParsingJsonObject.js";
import { ParsingJsonString } from "../../src/parser/ParsingJsonString.js";
import { resolveParseType } from "../../src/parser/ParsingJsonTypes.js";

describe("resolveParseType", () => {
    it("should return an instance of ParsingJsonNull when initial is null", () => {
        const result = resolveParseType("null");
        expect(result).toBeInstanceOf(ParsingJsonNull);
    });

    it("should return an instance of ParsingJsonTrue when initial is true", () => {
        const result = resolveParseType("true");
        expect(result).toBeInstanceOf(ParsingJsonTrue);
    });

    it("should return an instance of ParsingJsonFalse when initial is false", () => {
        const result = resolveParseType("false");
        expect(result).toBeInstanceOf(ParsingJsonFalse);
    });

    it("should return an instance of ParsingJsonNumber when initial is a number", () => {
        const result = resolveParseType("123");
        expect(result).toBeInstanceOf(ParsingJsonNumber);
    });

    it("should return an instance of ParsingJsonString when initial is a string", () => {
        const result = resolveParseType("\"hello\"");
        expect(result).toBeInstanceOf(ParsingJsonString);
    });

    it("should return an instance of ParsingJsonArray when initial is an array", () => {
        const result = resolveParseType("[1, 2, 3]");
        expect(result).toBeInstanceOf(ParsingJsonArray);
    });

    it("should return an instance of ParsingJsonObject when initial is an object", () => {
        const result = resolveParseType("{\"key\": \"value\"}");
        expect(result).toBeInstanceOf(ParsingJsonObject);
    });

    it("should return null when initial is not a valid JSON type", () => {
        const result = resolveParseType("invalid");
        expect(result).toBeNull();
    });
});