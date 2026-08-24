import { BadParse } from "../../src/parser/ParsingException.js";
import { JsonStreamingParser } from "../../src/parser/JsonStreamingParser.js";
import { ParsingJsonArray } from "../../src/parser/ParsingJsonArray.js";
import { ParsingJsonObject } from "../../src/parser/ParsingJsonObject.js";
import { MockStream } from "../mock.js";

/**
 * 壊れた入力の報告を、逐次パス (子ノードを作る経路) と
 * 一括パス (観測が無く範囲走査で確定させる経路) の両方で確認する。
 */
const observed = <T extends ParsingJsonArray<any> | ParsingJsonObject<any>>(parser: T) => {
    // current に触ると逐次観測が要求され、子ノードを作る経路に入る
    void parser.current;
    return parser;
};

describe("malformed arrays", () => {
    const cases: [string, string][] = [
        ['missing comma', '[1 2]'],
        ['trailing comma', '[1,]'],
        ['missing value after comma', '[1,,2]'],
        ['unexpected colon', '[1:2]'],
        ['bad member', '[tru]'],
    ];

    for (const [name, source] of cases) {
        it(`rejects ${name} on the incremental path`, async () => {
            const parser = observed(new ParsingJsonArray());
            MockStream.pipe(source, parser).catch(() => {});
            await expect(parser.all()).rejects.toThrow(BadParse);
        });

        it(`rejects ${name} on the whole-value path`, async () => {
            const parser = JsonStreamingParser.readFrom([source]);
            await expect(parser.parseAll()).rejects.toThrow(BadParse);
        });
    }

    it("rejects an array that never closes", async () => {
        const parser = observed(new ParsingJsonArray());
        const writer = parser.getWriter();
        await writer.write('[1');
        await writer.close();
        await expect(parser.all()).rejects.toThrow(BadParse);
    });

    it("rejects content after the closing bracket (parser level)", async () => {
        // 末尾ゴミの検出は JsonStreamingParser の責務 (ノード単体は値の終端で完了する)
        await expect(JsonStreamingParser.readFrom(['[1] 2']).parseAll())
            .rejects.toThrow(BadParse);
    });

    it("rejects data that does not start with '['", async () => {
        const parser = new ParsingJsonArray();
        MockStream.pipe('{"a":1}', parser).catch(() => {});
        await expect(parser.all()).rejects.toThrow(BadParse);
    });
});

describe("malformed objects", () => {
    const cases: [string, string][] = [
        ['missing colon', '{"a" 1}'],
        ['unquoted key', '{a:1}'],
        ['missing value', '{"a":}'],
        ['trailing comma', '{"a":1,}'],
        ['missing comma', '{"a":1 "b":2}'],
    ];

    for (const [name, source] of cases) {
        it(`rejects ${name} on the incremental path`, async () => {
            const parser = observed(new ParsingJsonObject());
            MockStream.pipe(source, parser).catch(() => {});
            await expect(parser.all()).rejects.toThrow(BadParse);
        });

        it(`rejects ${name} on the whole-value path`, async () => {
            const parser = JsonStreamingParser.readFrom([source]);
            await expect(parser.parseAll()).rejects.toThrow(BadParse);
        });
    }

    it("rejects an object that never closes", async () => {
        const parser = observed(new ParsingJsonObject());
        const writer = parser.getWriter();
        await writer.write('{"a":1');
        await writer.close();
        await expect(parser.all()).rejects.toThrow(BadParse);
    });

    it("rejects content after the closing brace (parser level)", async () => {
        await expect(JsonStreamingParser.readFrom(['{"a":1} 2']).parseAll())
            .rejects.toThrow(BadParse);
    });

    it("rejects data that does not start with '{'", async () => {
        const parser = new ParsingJsonObject();
        MockStream.pipe('[1]', parser).catch(() => {});
        await expect(parser.all()).rejects.toThrow(BadParse);
    });

    it("keeps __proto__ out of the parsed value on the incremental path", async () => {
        const parser = observed(new ParsingJsonObject());
        MockStream.pipe('{"__proto__":{"x":1},"a":2}', parser);
        const value = await parser.all() as Record<string, unknown>;
        expect(Object.keys(value)).toEqual(['a']);
    });
});
