import { scanValueExtent } from "../../src/parser/scanValueExtent.js";

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
