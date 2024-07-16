import { type StreamingJsonOptions } from "../types";

export abstract class StringifyingJson extends ReadableStream<string> {
    constructor(genFunc: () => AsyncIterator<string>, options?: StreamingJsonOptions) {
        let iterator: AsyncIterator<string>;
        super(
            {
                pull: async (controller) => {
                    iterator ??= genFunc();
                    const { done, value } = await iterator.next();
                    if(!done) {
                        controller.enqueue(value);
                    } else {
                        controller.close();
                    }
                }
            },
            options?.strategy
        );
        this.#strict = Boolean(options?.strict);
        this.#ignorePrototype = Boolean(options?.ignorePrototype ?? true);
    }

    readonly #strict: boolean;
    get strict() {
        return this.#strict;
    }

    readonly #ignorePrototype: boolean;
    get ignorePrototype() {
        return this.#ignorePrototype;
    }
}
