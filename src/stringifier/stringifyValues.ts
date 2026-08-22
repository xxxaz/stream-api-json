import { type StreamingJsonOptions, type IterateSource } from "../types.js";
import { iterate, iterateStream } from "../utility.js";
import { BadStringify, NestedStringifyException, StringifyingException, UncaughtStringifyError } from "./StringifyingException.js";
import { StringifyingJson } from "./StringifyingJson.js";
import { StringifyingJsonString } from "./StringifyingJsonString.js";
import { type Stringifyable, type StringifyingJsonEntry } from "./Stringifyable.js";

/**
 * 書き出しの実体 (generator)。
 *
 * 入れ子ごとに `StringifyingJson` (ReadableStream) を生成すると、値の個数に比例して
 * ストリームを確保することになり時間・メモリの固定費が大きい。クラスは公開 API の器として
 * 残し、実体はここの generator に置いて `stringify` からも直接使う。
 */
export type StringifyContext = StreamingJsonOptions & {
    /** 例外に添える発生元 (クラス経由の場合のみ) */
    readonly stringifyingJson?: StringifyingJson;
};

function nested(
    key: number | string,
    cause: unknown,
    context: StringifyContext,
): never {
    const { stringifyingJson } = context;
    if (cause instanceof StringifyingException) {
        throw new NestedStringifyException(key, { stringifyingJson, cause });
    }
    throw new UncaughtStringifyError({ cause, stringifyingJson });
}

/** 配列を書き出す。消費した要素は保持しない (件数のみ持つ) */
export async function* stringifyArrayValues(
    source: IterateSource<Stringifyable>,
    context: StringifyContext,
): AsyncGenerator<string> {
    yield '[';
    let count = 0;
    for await (const member of iterate(source)) {
        if (count > 0) yield ',';
        count += 1;
        try {
            yield* stringifyValue(member, context);
        } catch (cause: unknown) {
            nested(count - 1, cause, context);
        }
    }
    yield ']';
}

async function stringifyKey(
    key: string | StringifyingJsonString,
    strict: boolean,
    keys: Set<string> | null,
): Promise<[string, string]> {
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
    if (strict && keys?.has(key)) {
        throw new BadStringify(`Duplicate key "${key}"`);
    }
    return [key, stringified];
}

/** オブジェクトを書き出す。キー集合は strict のときだけ保持する */
export async function* stringifyEntryValues(
    source: IterateSource<StringifyingJsonEntry>,
    context: StringifyContext,
): AsyncGenerator<string> {
    const strict = Boolean(context.strict);
    const ignorePrototype = context.ignorePrototype ?? true;
    // 重複検出は strict のときだけ。常に保持すると出力量に比例してメモリが増える
    const keys = strict ? new Set<string>() : null;
    yield '{';
    let count = 0;
    for await (const [rawKey, rawValue] of iterate(source)) {
        const [key, stringifiedKey] = await stringifyKey(rawKey, strict, keys);
        if (ignorePrototype && key === '__proto__') continue;
        const value = await rawValue;
        if (value === undefined) continue;
        if (count > 0) yield ',';
        yield stringifiedKey;
        count += 1;
        keys?.add(key);
        yield ':';
        try {
            yield* stringifyValue(value, context);
        } catch (cause: unknown) {
            nested(stringifiedKey, cause, context);
        }
    }
    yield '}';
}

/**
 * 値 1 つを書き出す。
 * 配列・オブジェクトは `StringifyingJson` を確保せず generator で再帰する。
 */
export async function* stringifyValue(
    target: Stringifyable,
    context: StringifyContext,
): AsyncGenerator<string> {
    if (target instanceof StringifyingJson) {
        yield* iterateStream(target);
        return;
    }
    const nestedContext: StringifyContext = {
        strict: context.strict,
        ignorePrototype: context.ignorePrototype,
    };
    if (target instanceof Array) {
        yield* stringifyArrayValues(target, nestedContext);
        return;
    }
    if (target instanceof Object) {
        yield* stringifyEntryValues(Object.entries(target), nestedContext);
        return;
    }
    yield JSON.stringify(target ?? null);
}
