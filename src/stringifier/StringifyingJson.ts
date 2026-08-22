import { type StreamingJsonOptions } from "../types.js";

/**
 * 1 回の pull で流す最小サイズ。
 *
 * 書き出しは '[' / ',' / キー / ':' / 値 と細かく yield されるため、そのまま enqueue すると
 * トークンごとに pull が往復して支配的なコストになる。読み手にとって意味は変わらないので、
 * この閾値までまとめてから流す (最初のチャンクも十分小さく、逐次性は損なわない)。
 */
const minChunkLength = 8192;

export abstract class StringifyingJson extends ReadableStream<string> {
    constructor(genFunc: () => AsyncIterator<string>, options?: StreamingJsonOptions) {
        let iterator: AsyncIterator<string>;
        super(
            {
                pull: async (controller) => {
                    iterator ??= genFunc();
                    let chunk = '';
                    while (chunk.length < minChunkLength) {
                        const { done, value } = await iterator.next();
                        if (done) {
                            if (chunk) controller.enqueue(chunk);
                            controller.close();
                            return;
                        }
                        chunk += value;
                    }
                    controller.enqueue(chunk);
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

    async all(): Promise<string> {
        return (await Array.fromAsync(this)).join('');
    }
}
