import { type StreamingJsonOptions, type IterateSource } from "../types.js";
import { type Stringifyable } from "./Stringifyable.js";
import { StringifyingJson } from "./StringifyingJson.js";
import { stringifyArrayValues } from "./stringifyValues.js";

export class StringifyingJsonArray extends StringifyingJson {
    constructor(source: IterateSource<Stringifyable>, options?: StreamingJsonOptions) {
        super(
            () => stringifyArrayValues(source, {
                strict: this.strict,
                ignorePrototype: this.ignorePrototype,
                stringifyingJson: this
            }),
            options
        );
    }
}
