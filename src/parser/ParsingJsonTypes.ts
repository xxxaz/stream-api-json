import { ParsingJsonFalse, ParsingJsonNull, ParsingJsonTrue } from "./ParsingJsonFixed.js";
import { ParsingJsonNumber } from "./ParsingJsonNumber.js";
import { ParsingJsonString } from "./ParsingJsonString.js";
import { ParsingJsonArray } from "./ParsingJsonArray.js";
import { ParsingJsonObject } from "./ParsingJsonObject.js";
import { type StreamingJsonOptions } from "../types.js";

export type ParsingJsonWritableStream
    = ParsingJsonNull
    | ParsingJsonTrue
    | ParsingJsonFalse
    | ParsingJsonNumber
    | ParsingJsonString
    | ParsingJsonArray<any>
    | ParsingJsonObject<any>;

export type ParsingJsonTypes = Omit<ParsingJsonWritableStream, keyof WritableStream>;

export function resolveParseType(initial: string, options?: StreamingJsonOptions): ParsingJsonWritableStream|null {
    const primalClass = [
        ParsingJsonNull,
        ParsingJsonTrue,
        ParsingJsonFalse,
        ParsingJsonNumber,
        ParsingJsonString,
    ].find(cls => cls.matchInit(initial));
    if (primalClass) return new primalClass(options);

    if (ParsingJsonArray.matchInit(initial)) {
        return new ParsingJsonArray(options);
    }

    if (ParsingJsonObject.matchInit(initial)) {
        return new ParsingJsonObject(options);
    }

    return null;
}