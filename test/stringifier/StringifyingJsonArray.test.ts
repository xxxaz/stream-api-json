import { StringifyingJsonArray } from "../../src/stringifier/StringifyingJsonArray.js";
import { readAll } from "../mock.js";

describe('StringifyingJsonArray', () => {
    it('should stringify the input source', async () => {
        const source = ['Hello', 'World'];
        const stringifier = new StringifyingJsonArray(source);
        await expect(readAll(stringifier)).resolves.toBe('["Hello","World"]');
    });

    it('should handle empty source', async () => {
        const source: string[] = [];
        const stringifier = new StringifyingJsonArray(source);
        await expect(readAll(stringifier)).resolves.toBe('[]');
    });

    it('should handle multi-bytes characters in source', async () => {
        const source = ['☔', '🌞'];
        const stringifier = new StringifyingJsonArray(source);
        await expect(readAll(stringifier)).resolves.toBe('["☔","🌞"]');
    });

    it('should handle source with special characters', async () => {
        const source = ['Hello', 'World', '!"#$%&/()=?'];
        const stringifier = new StringifyingJsonArray(source);
        await expect(readAll(stringifier)).resolves.toBe('["Hello","World","!\\"#$%&/()=?"]');
    });

    it('should handle source with null values', async () => {
        const source = ['Hello', null, 'World'];
        const stringifier = new StringifyingJsonArray(source);
        await expect(readAll(stringifier)).resolves.toBe('["Hello",null,"World"]');
    });

    it('should handle source with undefined values', async () => {
        const source = ['Hello', undefined, 'World'] as any;
        const stringifier = new StringifyingJsonArray(source);
        await expect(readAll(stringifier)).resolves.toBe('["Hello",null,"World"]');
    });
});