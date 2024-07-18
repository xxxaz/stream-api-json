import { type StreamingJsonOptions, type IterateSource } from "../types.js";
import { iterate } from "../utility.js";
import { stringify, type Stringifyable } from "./Stringifyable.js";
import { NestedStringifyException, StringifyingException, UncaughtStringifyError } from "./StringifyingException.js";
import { StringifyingJson } from "./StringifyingJson.js";

export class StringifyingJsonArray extends StringifyingJson {
    constructor(source: IterateSource<Stringifyable>, options?: StreamingJsonOptions) {
        super(
            () => this.#stringify(source),
            options
        );   
    }

    #members: Stringifyable[] = [];
    async * #stringify(source: IterateSource<Stringifyable>) : AsyncGenerator<string> 
    {
        yield '[';
        for await(const member of iterate(source)) {
            if (this.#members.length > 0) yield ',';
            this.#members.push(member);
            try {
                yield * stringify(member, { strict: this.strict, ignorePrototype: this.ignorePrototype });
            } catch (cause: unknown) {
                if (cause instanceof StringifyingException) {
                    throw new NestedStringifyException(this.#members.length - 1, { stringifyingJson: this, cause });
                }
                throw new UncaughtStringifyError({ cause, stringifyingJson: this });
            }
        }
        yield ']';
    }
}
