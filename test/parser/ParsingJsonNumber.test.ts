import { JsonStreamingParser } from "../../src/parser/JsonStreamingParser.js";
import { ParsingJsonNumber } from "../../src/parser/ParsingJsonNumber.js";
import { BadParse } from "../../src/parser/ParsingException.js";
import { MockStream } from "../mock.js";

describe('ParsingJsonNumber', () => {
    it('should match initial string with a number', () => {
        expect(ParsingJsonNumber.matchInit('123')).toBe(true);
        expect(ParsingJsonNumber.matchInit('-456')).toBe(true);
        expect(ParsingJsonNumber.matchInit('0')).toBe(true);
        expect(ParsingJsonNumber.matchInit('.789')).toBe(false);
        expect(ParsingJsonNumber.matchInit('abc')).toBe(false);
    });

    it('should have type Number', () => {
        const parsingJsonNumber = new ParsingJsonNumber();
        expect(parsingJsonNumber.type).toBe(Number);
    });

    it('should have current value null when no number is parsed', () => {
        const parsingJsonNumber = new ParsingJsonNumber();
        expect(parsingJsonNumber.current).toBe(null);
    });

    it('should parse positive integer', async () => {
        const parsingJsonNumber = new ParsingJsonNumber();
        await MockStream.pipe('123', parsingJsonNumber);

        await expect(parsingJsonNumber.all()).resolves.toBe(123);
        expect(parsingJsonNumber.current).toBe(123);

        const parser = new JsonStreamingParser();
        MockStream.pipe('123', parser);
        await expect(parser.root()).resolves.toBeInstanceOf(ParsingJsonNumber);
        await expect(parser.parseAll()).resolves.toBe(123);
    });

    it('should parse negative integer', async () => {
        const parsingJsonNumber = new ParsingJsonNumber();
        MockStream.pipe('-456', parsingJsonNumber);

        await expect(parsingJsonNumber.all()).resolves.toBe(-456);
        expect(parsingJsonNumber.current).toBe(-456);
        
        const parser = new JsonStreamingParser();
        MockStream.pipe('-456', parser);
        await expect(parser.root()).resolves.toBeInstanceOf(ParsingJsonNumber);
        await expect(parser.parseAll()).resolves.toBe(-456);
    });

    it('should parse zero', async () => {
        const parsingJsonNumber = new ParsingJsonNumber();
        await MockStream.pipe('0', parsingJsonNumber);

        await expect(parsingJsonNumber.all()).resolves.toBe(0);
        expect(parsingJsonNumber.current).toBe(0);

        const parser = new JsonStreamingParser();
        MockStream.pipe('0', parser);
        await expect(parser.root()).resolves.toBeInstanceOf(ParsingJsonNumber);
        await expect(parser.parseAll()).resolves.toBe(0);
    });

    it('should throw BadParse when no number after minus sign', async () => {
        const parsingJsonNumber = new ParsingJsonNumber();
        MockStream.pipe('-', parsingJsonNumber);
        await expect(parsingJsonNumber.all()).rejects.toThrow(BadParse);

        const parser = new JsonStreamingParser();
        MockStream.pipe('-', parser);
        await expect(parser.root()).resolves.toBeInstanceOf(ParsingJsonNumber);
        await expect(parser.parseAll()).rejects.toThrow(BadParse);
    });

    it('should throw BadParse when unexpected non-digit', async () => {
        const parsingJsonNumber = new ParsingJsonNumber();
        MockStream.pipe('abc', parsingJsonNumber);
        await expect(parsingJsonNumber.all()).rejects.toThrow(BadParse);

        const parser = new JsonStreamingParser();
        MockStream.pipe('abc', parser);
        await expect(parser.root()).rejects.toThrow(BadParse);
        await expect(parser.parseAll()).rejects.toThrow(BadParse);
    });

    it('should parse positive number with decimal point', async () => {
        const parsingJsonNumber = new ParsingJsonNumber();
        MockStream.pipe('123.456', parsingJsonNumber);
        const result = await parsingJsonNumber.all();

        expect(result).toBe(123.456);
        expect(parsingJsonNumber.current).toBe(123.456);
        
        const parser = new JsonStreamingParser();
        MockStream.pipe('123.456', parser);
        await expect(parser.root()).resolves.toBeInstanceOf(ParsingJsonNumber);
        await expect(parser.parseAll()).resolves.toBe(123.456);
    });

    it('should throw BadParse when missing digits after decimal point', async () => {
        const parsingJsonNumber = new ParsingJsonNumber();
        MockStream.pipe('123.', parsingJsonNumber);
        await expect(parsingJsonNumber.all()).rejects.toThrow(BadParse);

        const parser = new JsonStreamingParser();
        MockStream.pipe('123.', parser);
        await expect(parser.root()).resolves.toBeInstanceOf(ParsingJsonNumber);
        await expect(parser.parseAll()).rejects.toThrow(BadParse);
    });

    it('should parse positive number with exponent', async () => {
        const parsingJsonNumber = new ParsingJsonNumber();
        MockStream.pipe('123e4', parsingJsonNumber);
        await expect(parsingJsonNumber.all()).resolves.toBe(123e4);
        expect(parsingJsonNumber.current).toBe(1230000);

        const parser = new JsonStreamingParser();
        MockStream.pipe('123e4', parser);
        await expect(parser.root()).resolves.toBeInstanceOf(ParsingJsonNumber);
        await expect(parser.parseAll()).resolves.toBe(123e4);
    });

    it('should parse positive number with positive exponent', async () => {
        const parsingJsonNumber = new ParsingJsonNumber();
        MockStream.pipe('123e+4', parsingJsonNumber);
        await expect(parsingJsonNumber.all()).resolves.toBe(123e+4);
        expect(parsingJsonNumber.current).toBe(1230000);

        const parser = new JsonStreamingParser();
        MockStream.pipe('123e+4', parser);
        await expect(parser.root()).resolves.toBeInstanceOf(ParsingJsonNumber);
        await expect(parser.parseAll()).resolves.toBe(123e+4);
    });

    it('should parse positive number with negative exponent', async () => {
        const parsingJsonNumber = new ParsingJsonNumber();
        MockStream.pipe('123e-4', parsingJsonNumber);
        await expect(parsingJsonNumber.all()).resolves.toBe(123e-4);
        expect(parsingJsonNumber.current).toBe(0.0123);

        const parser = new JsonStreamingParser();
        MockStream.pipe('123e-4', parser);
        await expect(parser.root()).resolves.toBeInstanceOf(ParsingJsonNumber);
        await expect(parser.parseAll()).resolves.toBe(123e-4);
    });

    it('should throw BadParse when missing digits after exponent indicator', async () => {
        const parsingJsonNumber = new ParsingJsonNumber();
        MockStream.pipe('123e', parsingJsonNumber);
        await expect(parsingJsonNumber.all()).rejects.toThrow(BadParse);

        const parser = new JsonStreamingParser();
        MockStream.pipe('123e', parser);
        await expect(parser.root()).resolves.toBeInstanceOf(ParsingJsonNumber);
        await expect(parser.parseAll()).rejects.toThrow(BadParse);
    });

    it('should throw BadParse when missing digits after exponent sign', async () => {
        const parsingJsonNumber = new ParsingJsonNumber();
        MockStream.pipe('123e+', parsingJsonNumber);
        await expect(parsingJsonNumber.all()).rejects.toThrow(BadParse);

        const parser = new JsonStreamingParser();
        MockStream.pipe('123e+', parser);
        await expect(parser.root()).resolves.toBeInstanceOf(ParsingJsonNumber);
        await expect(parser.parseAll()).rejects.toThrow(BadParse);
    });

    it('should parse positive number if initial match', async () => {
        const parsingJsonNumber = new ParsingJsonNumber();
        MockStream.pipe('123abc', parsingJsonNumber);
        await expect(parsingJsonNumber.all()).resolves.toBe(123);
        expect(parsingJsonNumber.source).toBe('123');

        const parser = new JsonStreamingParser();
        MockStream.pipe('123abc', parser);
        await expect(parser.root()).resolves.toBeInstanceOf(ParsingJsonNumber);
        await expect(parser.parseAll()).rejects.toThrow(BadParse);
    });

    it('should parse negative number with decimal point if initial match', async () => {
        const parsingJsonNumber = new ParsingJsonNumber();
        MockStream.pipe('-123.456abc', parsingJsonNumber);
        await expect(parsingJsonNumber.all()).resolves.toBe(-123.456);
        expect(parsingJsonNumber.source).toBe('-123.456');

        const parser = new JsonStreamingParser();
        MockStream.pipe('-123.456abc', parser);
        await expect(parser.root()).resolves.toBeInstanceOf(ParsingJsonNumber);
        await expect(parser.parseAll()).rejects.toThrow(BadParse);
    });

    it('should throw BadParse when unexpected non-digit after parsing exponent', async () => {
        const parsingJsonNumber = new ParsingJsonNumber();
        MockStream.pipe('123e+abc', parsingJsonNumber);
        await expect(parsingJsonNumber.all()).rejects.toThrow(BadParse);
    });


    it('should parse exponent number if initial match', async () => {
        const parsingJsonNumber = new ParsingJsonNumber();
        MockStream.pipe('123e+4abc', parsingJsonNumber);
        await expect(parsingJsonNumber.all()).resolves.toBe(1230000);
        expect(parsingJsonNumber.source).toBe('123e+4');

        const parser = new JsonStreamingParser();
        MockStream.pipe('123e+4abc', parser);
        await expect(parser.root()).resolves.toBeInstanceOf(ParsingJsonNumber);
        await expect(parser.parseAll()).rejects.toThrow(BadParse);
    });

    it('should throw BadParse when unexpected non-digit after parsing exponent indicator and minus sign', async () => {
        const parser = new JsonStreamingParser();
        MockStream.pipe('123e-4abc', parser);
        await expect(parser.parseAll()).rejects.toThrow(BadParse);
    });

    it('should throw BadParse when unexpected non-digit after parsing exponent indicator and minus sign and plus sign', async () => {
        const parsingJsonNumber = new ParsingJsonNumber();
        MockStream.pipe('123e-+4abc', parsingJsonNumber);
        await expect(parsingJsonNumber.all()).rejects.toThrow(BadParse);
    });

    it('should throw BadParse when unexpected non-digit after parsing exponent indicator and plus sign and minus sign', async () => {
        const parsingJsonNumber = new ParsingJsonNumber();
        MockStream.pipe('123e+-4abc', parsingJsonNumber);
        await expect(parsingJsonNumber.all()).rejects.toThrow(BadParse);
    });

    it('should throw BadParse when unexpected non-digit after parsing exponent indicator and plus sign and plus sign', async () => {
        const parsingJsonNumber = new ParsingJsonNumber();
        MockStream.pipe('123e++4abc', parsingJsonNumber);
        await expect(parsingJsonNumber.all()).rejects.toThrow(BadParse);
    });

    it('should throw BadParse when unexpected non-digit after parsing exponent indicator and minus sign and minus sign', async () => {
        const parsingJsonNumber = new ParsingJsonNumber();
        MockStream.pipe('123e--4abc', parsingJsonNumber);
        await expect(parsingJsonNumber.all()).rejects.toThrow(BadParse);
    });

    it('should throw BadParse when unexpected non-digit after parsing exponent indicator and minus sign and minus sign and plus sign', async () => {
        const parsingJsonNumber = new ParsingJsonNumber();
        MockStream.pipe('123e-+-4abc', parsingJsonNumber);
        await expect(parsingJsonNumber.all()).rejects.toThrow(BadParse);
    });

    it('should throw BadParse when unexpected non-digit after parsing exponent indicator and plus sign and plus sign and minus sign', async () => {
        const parsingJsonNumber = new ParsingJsonNumber();
        MockStream.pipe('123e++-4abc', parsingJsonNumber);
        await expect(parsingJsonNumber.all()).rejects.toThrow(BadParse);
    });
});