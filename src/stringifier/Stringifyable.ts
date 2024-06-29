import { type Serializable } from "../types";
import { iterateStream } from "../utility";
import { StringifyingJson } from "./StringifyingJson";
import { StringifyingJsonArray } from "./StringifyingJsonArray";
import { StringifyingJsonObject } from "./StringifyingJsonObject";
import { type StringifyingJsonString } from "./StringifyingJsonString";

type StringifyableArray = readonly Stringifyable[];
type StringifyableObject = { readonly [key: string]: Stringifyable };

export type Stringifyable
    = Serializable
    | StringifyableArray
    | StringifyableObject
    | StringifyingJsonString
    | StringifyingJsonArray
    | StringifyingJsonObject;

type ObjectKey = StringifyingJsonString|string;

export type StringifyingJsonEntry = readonly [
    ObjectKey,
    Stringifyable|Promise<Stringifyable>
];

export async function * stringify(target: Stringifyable, strict: boolean) : AsyncGenerator<string> {
    if (target instanceof StringifyingJson) {
        yield * iterateStream(target);
    }
    if (target instanceof Array) {
        yield * stringify(new StringifyingJsonArray(target, { strict }), strict);
    }
    if (target instanceof Object) {
        yield * stringify(new StringifyingJsonObject(Object.entries(target), { strict }), strict);
    }
    yield JSON.stringify(target ?? null);
}