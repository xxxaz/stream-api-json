import { ParsingJsonString } from "../../src/parser/ParsingJsonString.js";
import { BadParse } from "../../src/parser/ParsingException.js";
import { StreamingJsonOptions } from "../../src/types.js";
import { MockStream } from "../mock.js";

describe('ParsingJsonString', () => {
    let parsingJsonString: ParsingJsonString;

    beforeEach(() => {
        parsingJsonString = new ParsingJsonString();
    });

    it('should match init with double quotes', () => {
        const initial = '"';
        const result = ParsingJsonString.matchInit(initial);
        expect(result).toBe(true);
    });

    it('should not match init without double quotes', () => {
        const initial = 'Hello"';
        const result = ParsingJsonString.matchInit(initial);
        expect(result).toBe(false);
    });

    it('should have type String', () => {
        const type = parsingJsonString.type;
        expect(type).toBe(String);
    });

    it('should have current value as empty string initially', () => {
        const current = parsingJsonString.current;
        expect(current).toBe('');
    });

    it('should parse the source string correctly', async () => {
        const source = '"Hello, World"';
        MockStream.pipe(source, parsingJsonString);
        await expect(parsingJsonString.all()).resolves.toBe('Hello, World');
    });

    it('should throw BadParse error if source does not start with double quotes', async () => {
        const source = 'Hello, World"';
        MockStream.pipe(source, parsingJsonString);
        await expect(parsingJsonString.all()).rejects.toThrow(BadParse);
    });

    it('should yield chunks of parsed string', async () => {
        const source = ['"Hello', ', ', 'World"'];
        MockStream.pipe(source, parsingJsonString);
        
        const iterator = parsingJsonString[Symbol.asyncIterator]();
        const result1 = await iterator.next();
        expect(result1.value).toBe('Hello');
        expect(result1.done).toBe(false);

        const result2 = await iterator.next();
        expect(result2.value).toBe(', ');
        expect(result2.done).toBe(false);

        const result3 = await iterator.next();
        expect(result3.value).toBe('World');
        expect(result3.done).toBe(false);

        const result4 = await iterator.next();
        expect(result4.value).toBeUndefined();
        expect(result4.done).toBe(true);
    });
    
    it('should yield chunks of parsed surrogate pair', async () => {
        const source = '"\\ud867\\ude3d"';
        MockStream.pipe(source, parsingJsonString);
        
        const iterator = parsingJsonString[Symbol.asyncIterator]();
        const result1 = await iterator.next();
        expect(result1.value).toBe('\ud867');
        expect(result1.done).toBe(false);

        const result2 = await iterator.next();
        expect(result2.value).toBe('\ude3d');
        expect(result2.done).toBe(false);

        const result3 = await iterator.next();
        expect(result3.value).toBeUndefined();
        expect(result3.done).toBe(true);

        await expect(parsingJsonString.all()).resolves.toBe('𩸽');
    });

    it('should handle empty source string', async () => {
        const source = '';
        MockStream.pipe(source, parsingJsonString);
        await expect(parsingJsonString.all()).rejects.toThrow(BadParse);
    });

    it('should handle source string with special characters', async () => {
        const source = '"Hello, \\"World\\""';
        MockStream.pipe(source, parsingJsonString);
        await expect(parsingJsonString.all()).resolves.toBe('Hello, "World"');
    });

    it('should handle source string with streaming options', async () => {
        const source = '""';
        const options: StreamingJsonOptions = {
            strategy: {
                size: () => 1,
                highWaterMark: 64
            }
        };
        const parsingJsonString = new ParsingJsonString(options);
        MockStream.pipe(source, parsingJsonString);
        const iterator = parsingJsonString[Symbol.asyncIterator]();
        const result = await iterator.next();
        expect(result.value).toBeUndefined();
        expect(result.done).toBe(true);
    });
});
describe("ParsingJsonString incremental decoding", () => {
    it("decodes escapes while parsing", async () => {
        const value = 'quote " backslash \\ slash / tab \t newline \n unicode あ emoji \u{1F600}';
        const source = JSON.stringify(value);
        for (const size of [1, 3, 17, 4096]) {
            const chunks = Array.from(
                { length: Math.ceil(source.length / size) },
                (_, i) => source.slice(i * size, (i + 1) * size)
            );
            const parser = new ParsingJsonString();
            MockStream.pipe(chunks, parser);
            await expect(parser.all()).resolves.toBe(value);
        }
    });

    it("exposes the decoded prefix as current while parsing", async () => {
        const parser = new ParsingJsonString();
        const writer = parser.getWriter();
        await writer.write('"ab\\n');
        expect(parser.current).toBe('ab\n');
        await writer.write('cd\\u3042');
        expect(parser.current).toBe('ab\ncdあ');
        await writer.write('ef"');
        await expect(parser.all()).resolves.toBe('ab\ncdあef');
    });

    it("does not treat an escaped quote as the end", async () => {
        const value = 'a"b';
        const parser = new ParsingJsonString();
        MockStream.pipe(JSON.stringify(value), parser);
        await expect(parser.all()).resolves.toBe(value);
    });

    it("rejects bad escapes", async () => {
        const parser = new ParsingJsonString();
        MockStream.pipe('"bad \\x escape"', parser);
        await expect(parser.all()).rejects.toThrow(BadParse);
    });

    it("rejects bad unicode escapes", async () => {
        const parser = new ParsingJsonString();
        MockStream.pipe('"bad \\u12g4 escape"', parser);
        await expect(parser.all()).rejects.toThrow(BadParse);
    });

    it("iterates the decoded text incrementally", async () => {
        const parser = new ParsingJsonString();
        const writer = parser.getWriter();
        const received = [] as string[];
        const iterating = (async () => {
            for await (const part of parser) received.push(part);
        })();
        await writer.write('"first ');
        await writer.write('second\\t');
        await writer.write('third"');
        await writer.close();
        await iterating;
        expect(received.join('')).toBe('first second\tthird');
    });
});
