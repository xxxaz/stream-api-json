import { createValueScanner, scanValueExtent } from "../../src/parser/scanValueExtent.js";

describe("scanValueExtent", () => {
    const complete = (source: string, start = 0) => {
        const scanned = scanValueExtent(source, start);
        if (scanned.kind !== 'complete') throw new Error(`not complete: ${scanned.kind}`);
        return source.slice(start, scanned.end);
    };

    it("scans primitives", () => {
        expect(complete('null,')).toBe('null');
        expect(complete('true]')).toBe('true');
        expect(complete('false}')).toBe('false');
        expect(complete('-12.5e3,')).toBe('-12.5e3');
        expect(complete('"text" ')).toBe('"text"');
    });

    it("scans strings containing structural characters", () => {
        expect(complete('"a{b}[c],\\"d\\""')).toBe('"a{b}[c],\\"d\\""');
    });

    it("scans nested containers", () => {
        const source = '{"a":[1,{"b":"}]"},null],"c":{}} trailing';
        expect(complete(source)).toBe('{"a":[1,{"b":"}]"},null],"c":{}}');
    });

    it("reports incomplete values", () => {
        expect(scanValueExtent('{"a":[1,2', 0).kind).toBe('incomplete');
        expect(scanValueExtent('"unterminated', 0).kind).toBe('incomplete');
        expect(scanValueExtent('tr', 0).kind).toBe('incomplete');
        // 数値は区切り文字が来るまで確定できない
        expect(scanValueExtent('123', 0).kind).toBe('incomplete');
    });

    it("reports invalid structures", () => {
        expect(scanValueExtent('{"a":1]', 0)).toEqual({ kind: 'invalid', offset: 6 });
        expect(scanValueExtent('@', 0)).toEqual({ kind: 'invalid', offset: 0 });
    });

    it("scans from an offset", () => {
        const source = '["skipped",{"x":1}]';
        expect(complete(source, 11)).toBe('{"x":1}');
    });
});

describe("createValueScanner", () => {
    const scanChunks = (chunks: string[]) => {
        const scanner = createValueScanner();
        const results = chunks.map(chunk => scanner.consume(chunk));
        return results[results.length - 1];
    };

    it("scans a value split across chunks", () => {
        const source = '{"a":[1,{"b":"}]"},null],"c":{}}';
        const chunks = [source.slice(0, 7), source.slice(7, 20), source.slice(20)];
        expect(scanChunks(chunks)).toEqual({ kind: 'complete', end: source.length });
    });

    it("reports the absolute end offset", () => {
        const source = '["a","b"] trailing';
        const scanner = createValueScanner();
        expect(scanner.consume(source.slice(0, 4)).kind).toBe('incomplete');
        expect(scanner.consume(source.slice(4))).toEqual({ kind: 'complete', end: 9 });
    });

    it("keeps string state across chunk boundaries", () => {
        // 閉じ括弧を含む文字列がチャンク境界で分かれても終端を誤らない
        const source = '{"key":"va}lue"}';
        expect(scanChunks([source.slice(0, 10), source.slice(10)]))
            .toEqual({ kind: 'complete', end: source.length });
    });

    it("keeps escape state across chunk boundaries", () => {
        const source = '"a\\"b"';
        expect(scanChunks([source.slice(0, 3), source.slice(3)]))
            .toEqual({ kind: 'complete', end: source.length });
    });

    it("scans literals and numbers split across chunks", () => {
        expect(scanChunks(['tr', 'ue,'])).toEqual({ kind: 'complete', end: 4 });
        expect(scanChunks(['-12', '.5e3,'])).toEqual({ kind: 'complete', end: 7 });
    });
});

describe("materialize path equivalence", () => {
    /** チャンク分割された大きめのデータが JSON.parse と一致することを担保する */
    it("parses chunked payloads identically to JSON.parse", async () => {
        const { JsonStreamingParser } = await import("../../src/parser/JsonStreamingParser.js");
        const payload = {
            jsonrpc: "2.0",
            id: 1,
            result: {
                rows: Array.from({ length: 300 }, (_, i) => ({
                    id: i,
                    label: `行 ${i} "引用" \\ バックスラッシュ`,
                    nested: { list: [i, i + 1, null, true, false], text: "}]" },
                    ratio: i / 7,
                })),
                empty: [],
                blank: {},
            },
        };
        const source = JSON.stringify(payload);

        for (const chunkSize of [1, 7, 64, 1024]) {
            const chunks = Array.from(
                { length: Math.ceil(source.length / chunkSize) },
                (_, i) => source.slice(i * chunkSize, (i + 1) * chunkSize)
            );
            const root = await JsonStreamingParser.readFrom(chunks).root();
            await expect(root.all()).resolves.toEqual(JSON.parse(source));
        }
    });
});
