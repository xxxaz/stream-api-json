import { StreamingJsonOptions, type Serializable } from "../types.js";
import { type StringifyingJsonArray } from "./StringifyingJsonArray.js";
import { type StringifyingJsonObject } from "./StringifyingJsonObject.js";
import { type StringifyingJsonString } from "./StringifyingJsonString.js";
import { stringifyValue } from "./stringifyValues.js";

export type StringifyableArray = readonly Stringifyable[];
export type StringifyableObject = { readonly [key: string]: Stringifyable };

export type Stringifyable
    = Serializable
    | StringifyableArray
    | StringifyableObject
    | StringifyingJsonString
    | StringifyingJsonArray
    | StringifyingJsonObject;

/**
 * オブジェクトのエントリ。
 * 値が `undefined` のエントリは書き出しから除外される (JSON.stringify と同じ扱い)。
 */
export type StringifyingJsonEntry = readonly [
    StringifyingJsonString|string,
    Stringifyable|Promise<Stringifyable>|undefined
];

export async function * stringify(target: Stringifyable, options?: StreamingJsonOptions) : AsyncGenerator<string> {
    // 入れ子ごとに ReadableStream を確保せず generator で再帰する
    yield * stringifyValue(target, { ...options });
}