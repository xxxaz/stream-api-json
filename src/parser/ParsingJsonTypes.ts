import { ParsingJsonFalse, ParsingJsonNull, ParsingJsonTrue } from "./ParsingJsonFixed";
import { ParsingJsonNumber } from "./ParsingJsonNumber";
import { ParsingJsonString } from "./ParsingJsonString";
import { ParsingJsonArray } from "./ParsingJsonArray";
import { ParsingJsonObject } from "./ParsingJsonObject";
import { type StreamingJsonOptions } from "../types";

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