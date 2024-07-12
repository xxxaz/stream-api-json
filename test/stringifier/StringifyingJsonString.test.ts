import { StringifyingJsonString } from "../../src/stringifier/StringifyingJsonString";
import { readAll } from "../mock";

describe('StringifyingJsonString', () => {
    it('should stringify the input source', async () => {
        const source = ['Hello', 'World'];
        const stringifier = new StringifyingJsonString(source);
        await expect(readAll(stringifier)).resolves.toBe('"HelloWorld"');
    });

    it('should handle empty source', async () => {
        const source: string[] = [];
        const stringifier = new StringifyingJsonString(source);
        await expect(readAll(stringifier)).resolves.toBe('""');
    });

    it('should handle multi-bytes characters in source', async () => {
        const source = ['☔', '🌞'];
        const stringifier = new StringifyingJsonString(source);
        await expect(readAll(stringifier)).resolves.toBe('"☔🌞"');
    });

    it('should handle surrogate pair in source', async () => {
        const source = ["\uD867", "\uDE3D"];
        const stringifier = new StringifyingJsonString(source);
        const all = await readAll(stringifier);
        expect(all).toBe('"\\ud867\\ude3d"');
        expect(JSON.parse(all)).toBe('𩸽');
    });
});