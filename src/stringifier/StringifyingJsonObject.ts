import { type StreamingJsonOptions, type IterateSource } from "../types.js";
import { type StringifyingJsonEntry } from "./Stringifyable.js";
import { StringifyingJson } from "./StringifyingJson.js";
import { stringifyEntryValues } from "./stringifyValues.js";

export class StringifyingJsonObject extends StringifyingJson {
    constructor(source: IterateSource<StringifyingJsonEntry>, options?: StreamingJsonOptions) {
        super(
            () => stringifyEntryValues(source, {
                strict: this.strict,
                ignorePrototype: this.ignorePrototype,
                stringifyingJson: this
            }),
            options
        );
    }
}
