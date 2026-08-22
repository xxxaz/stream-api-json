import {
    BadParse,
    IncompleteParse,
    NestedParseException,
    ParsingStreamAborted,
    UncaughtParseError,
} from "../../src/parser/ParsingException.js";
import { JsonStreamingParser } from "../../src/parser/JsonStreamingParser.js";
import { ParsingJsonArray } from "../../src/parser/ParsingJsonArray.js";
import { MockStream } from "../mock.js";

describe("ParsingException", () => {
    it("keeps the source and offset of the failure", () => {
        const error = new BadParse('broken', { source: '{"a":', offset: 5 });
        expect(error.name).toBe('BadParse');
        expect(error.source).toBe('{"a":');
        expect(error.offset).toBe(5);
    });

    it("builds a path from nested causes", () => {
        const cause = new BadParse('leaf');
        const inner = new NestedParseException('name', { cause });
        const outer = new NestedParseException(3, { cause: inner });

        expect(outer.message).toBe(`at $[3].name cause ${String(cause)}`);
        expect(outer.name).toBe('NestedParseException');
    });

    it("wraps an unknown cause", () => {
        const error = new UncaughtParseError({ cause: new Error('boom') });
        expect(error.name).toBe('UncaughtParseError');
        expect(error.message).toContain('boom');
    });

    it("reports the abort reason", () => {
        const error = new ParsingStreamAborted('cancelled');
        expect(error.name).toBe('StreamAborted');
        expect(error.message).toBe('cancelled');
    });

    it("reports incomplete parse", () => {
        expect(new IncompleteParse('not finished').name).toBe('IncompleteParse');
    });
});

describe("parse failures", () => {
    it("rejects trailing content after the root value", async () => {
        const parser = JsonStreamingParser.readFrom(['{"a":1} {"b":2}']);
        await expect(parser.parseAll()).rejects.toThrow(BadParse);
    });

    it("rejects an empty stream", async () => {
        const parser = JsonStreamingParser.readFrom([]);
        await expect(parser.root()).rejects.toThrow(BadParse);
    });

    it("rejects a value that is not JSON", async () => {
        const parser = JsonStreamingParser.readFrom(['@']);
        await expect(parser.root()).rejects.toThrow(BadParse);
    });

    it("reports the failing member path of an array", async () => {
        const parser = new ParsingJsonArray();
        // 観測しているとき (逐次パス) は要素ごとのエラーが入れ子で報告される
        const iterating = (async () => {
            for await (const member of parser) await member.all();
        })();
        MockStream.pipe('[1,tru]', parser).catch(() => {});
        await expect(iterating).rejects.toThrow();
    });

    it("propagates an aborted stream", async () => {
        const parser = new ParsingJsonArray();
        const writer = parser.getWriter();
        await writer.write('[1,');
        await writer.abort('stopped').catch(() => {});
        await expect(parser.all()).rejects.toThrow(ParsingStreamAborted);
    });

    it("throws when toJSON is called before completion", async () => {
        const parser = new ParsingJsonArray();
        const writer = parser.getWriter();
        await writer.write('[1,');
        expect(() => parser.toJSON()).toThrow(IncompleteParse);
    });

    it("rejects truncated data on close", async () => {
        const parser = new ParsingJsonArray();
        const writer = parser.getWriter();
        await writer.write('[1,2');
        await writer.close();
        await expect(parser.all()).rejects.toThrow(BadParse);
    });
});
