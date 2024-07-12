import { LazyResolvers } from "../utility";
import { BadParse } from "./ParsingException";
import { type ParsingJsonTypes, resolveParseType } from "./ParsingJsonTypes";
import { type StreamingJsonOptions, type Serializable } from "../types";

export type ParseSource
    = ReadableStream<string>
    | AsyncIterable<string>
    | Iterable<string>;

export class JsonStreamingParser<T extends Serializable = any> extends WritableStream<string> {
    readonly #strict: boolean;
    constructor(options?: StreamingJsonOptions) {
        super(
            {
                write: (chunk) => this.#write(chunk),
                close: () => this.#close(),
                abort: reason => this.#abort(reason)
            },
            options?.strategy
        );
        this.#strict = Boolean(options?.strict);
    }

    static readFrom<T extends Serializable = any>(input: ParseSource, options?: StreamingJsonOptions) : JsonStreamingParser<T> {
        const parser = new this(options);
        parser.pipeFrom(input);
        return parser;
    }

    public async pipeFrom(input: ParseSource) {
        if(input instanceof ReadableStream) {
            return input.pipeTo(this);
        }

        const writer = this.getWriter();
        for await (let chunk of input) {
            await writer.write(chunk);
        }
        return writer.close();
    }

    readonly #completeResolver = new LazyResolvers<void>();
    readonly #rootResolver = new LazyResolvers<ParsingJsonTypes>();
    #rootWriter: WritableStreamDefaultWriter|null = null;
    root(): Promise<ParsingJsonTypes> {
        return this.#rootResolver.promise;
    }

    #loaded = '';
    #pointer = 0;
    get #referred() {
        return this.#loaded.slice(this.#pointer);
    }

    async #write(chunk: string) {
        if(!this.#completeResolver.pending) return;
        this.#loaded += chunk;
        if(!this.#rootWriter) {
            const trimmed = this.#loaded.trimStart();
            if(!trimmed) return;
            const root = resolveParseType(trimmed, { strict: this.#strict });
            if (!root) {
                const error = new BadParse(
                    `unexpected character`,
                    {
                        source: this.#loaded,
                        offset: this.#loaded.length - trimmed.length
                    }
                );
                this.#rootResolver.reject(error);
                this.#completeResolver.reject(error);
                return;
            }
            this.#rootResolver.resolve(root);
            this.#rootWriter = root.getWriter();
            this.#pointer = this.#loaded.length - trimmed.length;
        }

        await this.#rootWriter.write(this.#referred);
        this.#pointer = this.#loaded.length;

        const root = await this.root();
        if(!root.completed) return;

        const unnecessary = this.#loaded.trimStart().slice(root.source.length).trimStart();
        if(unnecessary.length > 0) {
            const error = new BadParse(
                'unexpected non-whitespace character after JSON data',
                {
                    source: this.#loaded,
                    offset: this.#loaded.length - unnecessary.length
                }
            );
            this.#completeResolver.reject(error);
        }
    }

    async #close() {
        if(!this.#rootWriter) {
            const error = new BadParse('no data');
            this.#rootResolver.reject(error);
            this.#completeResolver.reject(error);
            return;
        }
        await this.#rootWriter.close();
        this.#completeResolver.resolve();
    }

    async #abort(reason: any) {
        this.#rootResolver.reject(reason);
        this.#completeResolver.reject(reason);
        return this.#rootWriter?.abort(reason);
    }

    async parseAll() : Promise<T> {
        await this.#completeResolver.promise;
        const root = await this.root();
        return root.all();
    }
}
