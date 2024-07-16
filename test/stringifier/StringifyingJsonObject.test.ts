import { BadStringify } from "../../src/stringifier/StringifyingException";
import { StringifyingJsonObject } from "../../src/stringifier/StringifyingJsonObject";
import { StringifyingJsonString } from "../../src/stringifier/StringifyingJsonString";
import { readAll } from "../mock";

describe('StringifyingJsonObject', () => {
    it('should stringify the input source', async () => {
        const source = [
            ['key1', 'value1'],
            ['key2', 'value2']
        ] as const;
        const stringifier = new StringifyingJsonObject(source);
        await expect(readAll(stringifier)).resolves.toBe('{"key1":"value1","key2":"value2"}');
    });

    it('should handle empty source', async () => {
        const source = [] as const;
        const stringifier = new StringifyingJsonObject(source);
        await expect(readAll(stringifier)).resolves.toBe('{}');
    });

    it('should handle multi-bytes characters in keys', async () => {
        const source = [
            ['☔', 'rain'],
            ['🌞', 'sun']
        ] as const;
        const stringifier = new StringifyingJsonObject(source);
        await expect(readAll(stringifier)).resolves.toBe('{"☔":"rain","🌞":"sun"}');
    });

    it('should handle StringifyingJsonString keys', async () => {
        const source = [
            [new StringifyingJsonString('key1'), 'value1'],
            [new StringifyingJsonString('key2'), 'value2']
        ] as const;
        const stringifier = new StringifyingJsonObject(source);
        await expect(readAll(stringifier)).resolves.toBe('{"key1":"value1","key2":"value2"}');
    });
    
    it('should skip undefined value', async () => {
        const source = [
            ['key1', 'value1'],
            ['key2', undefined] as any,
            ['key3', 'value3'],
        ] as const;
        const stringifier = new StringifyingJsonObject(source);
        await expect(readAll(stringifier)).resolves.toBe('{"key1":"value1","key3":"value3"}');
    });

    it('should throw an error for non-string or StringifyingJsonString keys', async () => {
        const source = [
            [123 as any, 'value1'],
            [new StringifyingJsonString('key2'), 'value2']
        ] as const;
        const stringifier = new StringifyingJsonObject(source);
        await expect(readAll(stringifier)).rejects.toThrow(BadStringify);
    });

    it('should handle duplicate keys in no strict mode', async () => {
        const source = [
            ['key1', 'value1'],
            ['key1', 'value2']
        ] as const;
        const stringifier = new StringifyingJsonObject(source, { strict: false });
        await expect(readAll(stringifier)).resolves.toBe('{"key1":"value1","key1":"value2"}');
    });

    it('should throw an error for duplicate keys in strict mode', async () => {
        const source = [
            ['key1', 'value1'],
            ['key1', 'value2']
        ] as const;
        const stringifier = new StringifyingJsonObject(source, { strict: true });
        await expect(readAll(stringifier)).rejects.toThrow(BadStringify);
    });

    it("should ignore __proto__ key", async () => {
        const source = [
            ['key1', 'value1'],
            ['key1', 'value2'],
            ['__proto__', 'proto1'],
            [new StringifyingJsonString('__proto__'), 'proto2']
        ] as const;
        const stringifier = new StringifyingJsonObject(source);
        await expect(readAll(stringifier)).resolves.toBe('{"key1":"value1","key1":"value2"}');
    });
});