import { StreamingJsonOptions, type Serializable } from "../types.js";
import { iterateStream } from "../utility.js";
import { StringifyingJson } from "./StringifyingJson.js";
import { StringifyingJsonArray } from "./StringifyingJsonArray.js";
import { StringifyingJsonObject } from "./StringifyingJsonObject.js";
import { type StringifyingJsonString } from "./StringifyingJsonString.js";

export type StringifyableArray = readonly Stringifyable[];
export type StringifyableObject = { readonly [key: string]: Stringifyable };

export type Stringifyable
    = Serializable
    | StringifyableArray
    | StringifyableObject
    | StringifyingJsonString
    | StringifyingJsonArray
    | StringifyingJsonObject;

export type StringifyingJsonEntry = readonly [
    StringifyingJsonString|string,
    Stringifyable|Promise<Stringifyable>
];

export async function * stringify(target: Stringifyable, options?: StreamingJsonOptions) : AsyncGenerator<string> {
    if (target instanceof StringifyingJson) {
        yield * iterateStream(target);
        return;
    }
    if (target instanceof Array) {
        yield * stringify(new StringifyingJsonArray(target, options), options);
        return;
    }
    if (target instanceof Object) {
        yield * stringify(new StringifyingJsonObject(Object.entries(target), options), options);
        return;
    }
    yield JSON.stringify(target ?? null);
}