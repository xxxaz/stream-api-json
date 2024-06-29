import { type StreamingJsonOptions, type IterateSource } from "../types";
import { iterate, iterateStream } from "../utility";
import { stringify, type StringifyingJsonEntry } from "./Stringifyable";
import { BadStringify, NestedStringifyException, StringifyingException, UncaughtStringifyError } from "./StringifyingException";
import { StringifyingJson } from "./StringifyingJson";
import { StringifyingJsonString } from "./StringifyingJsonString";


export class StringifyingJsonObject extends StringifyingJson {
    constructor(source: IterateSource<StringifyingJsonEntry>, options?: StreamingJsonOptions) {
        super(
            () => this.#stringify(source),
            options
        );
    }

    async * #stringify(source: IterateSource<StringifyingJsonEntry>) : AsyncGenerator<string> 
    {
        let count = 0;
        yield '{';
        for await(const [rawKey, rawValue] of iterate(source)) {
            const [key, stringifiedKey] = await this.#stringifyKey(rawKey);
            const value = await rawValue;
            if (value === undefined) continue;
            if (this.#keys.size > 0) yield ',';
            yield stringifiedKey;
            this.#keys.add(key);
            yield ':';
            try {
                yield * stringify(value, this.strict);
            } catch (cause: unknown) {
                if (cause instanceof StringifyingException) {
                    throw new NestedStringifyException(stringifiedKey, { stringifyingJson: this, cause });
                }
                throw new UncaughtStringifyError({ cause, stringifyingJson: this });
            }
            count++;
        }
        yield '}';
    }

    #keys = new Set<string>();
    async #stringifyKey(key: string|StringifyingJsonString): Promise<[string, string]> {
        let stringified = '';
        if (key instanceof StringifyingJsonString) {
            for await (const chunk of iterateStream(key)) {
                stringified += chunk;
            }
            key = JSON.parse(stringified) as string;
        }
        if (typeof key !== 'string') {
            throw new BadStringify('Object key must be string or StringifyingJsonString.');
        }
        if (!stringified) {
            stringified = JSON.stringify(key);
        }
        if (this.strict && this.#keys.has(key)) {
            throw new BadStringify(`Duplicate key "${key}"`);
        }

        return [key, stringified];
    }
}
