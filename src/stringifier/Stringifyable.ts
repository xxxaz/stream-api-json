import { type Serializable } from "../types";
import { iterateStream } from "../utility";
import { StringifyingJson } from "./StringifyingJson";
import { StringifyingJsonArray } from "./StringifyingJsonArray";
import { StringifyingJsonObject } from "./StringifyingJsonObject";
import { type StringifyingJsonString } from "./StringifyingJsonString";

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

export async function * stringify(target: Stringifyable, strict: boolean) : AsyncGenerator<string> {
    if (target instanceof StringifyingJson) {
        yield * iterateStream(target);
        return;
    }
    if (target instanceof Array) {
        yield * stringify(new StringifyingJsonArray(target, { strict }), strict);
        return;
    }
    if (target instanceof Object) {
        yield * stringify(new StringifyingJsonObject(Object.entries(target), { strict }), strict);
        return;
    }
    yield JSON.stringify(target ?? null);
}