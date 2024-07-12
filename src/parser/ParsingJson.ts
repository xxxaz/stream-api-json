import { LazyResolvers } from "../utility";
import { BadParse, IncompleteParse, ParseErrorOptions, ParsingStreamAborted, ParsingException, UncaughtParseError } from "./ParsingException";
import { type ParsingJsonTypes } from "./ParsingJsonTypes";
import { type StreamingJsonOptions, type Serializable } from "../types";

export type TypeConstructor
    = null
    | BooleanConstructor
    | NumberConstructor
    | StringConstructor
    | ArrayConstructor
    | ObjectConstructor;

export abstract class ParsingJson<Type extends Serializable, Part = Type> extends WritableStream<string> {
    static matchInit(initial: string): boolean {
        return false;
    }

    abstract readonly type: TypeConstructor;
    abstract readonly current: Type|Part;

    constructor(
        parseChunk: (loaded: string) => Promise<number|null>,
        options?: StreamingJsonOptions
    ) {
        super(
            {
                write: chunk => this.#write(chunk, parseChunk),
                abort: reason => this.#abort(reason),
                close: () => this.#close()
            },
            options?.strategy
        );
        this.#strict = Boolean(options?.strict);
    }

    async #write(chunk: string, parseChunk: (loaded: string) => Promise<number|null>) {
        if (!this.#completeResolvers.pending) return;
        if(!chunk) return;

        const loaded = this.#source + chunk;
        try {
            const length = await parseChunk(loaded);
            this.#source = loaded.slice(0, length ?? undefined);
            this.#goNext();
            if (length === null) return;
            this.#complete();
        } catch(err: unknown) {
            this.#caughtError(err, {
                parsingJson: this as ParsingJsonTypes,
                source: loaded,
                offset: this.#source.length
            });
        }
    }

    #abort(reason: any) {
        const options = {
            parsingJson: this as ParsingJsonTypes,
            source: this.#source,
            offset: this.#source.length
        };
        this.#caughtError(
            new ParsingStreamAborted(reason, options),
            options
        );
    }

    async #close() {
        if(this.completed) return;
        try {
            JSON.parse(this.source);
            this.#complete();
        } catch (err: unknown) {
            const message = err instanceof Error
                ? err.message
                : String(err);
            const options = {
                parsingJson: this as ParsingJsonTypes,
                source: this.#source,
                offset: this.#source.length
            };
            this.#caughtError(new BadParse(message, options), options);
        }
    }
    
    readonly #strict: boolean;
    get strict() {
        return this.#strict;
    }

    #source: string = '';
    get source(): string {
        return this.#source;
    }

    readonly #completeResolvers = new LazyResolvers<Type>();
    #iterateResolvers = new LazyResolvers<void>();

    all(): Promise<Type> {
        return this.#completeResolvers.promise;
    }

    waitNext(): Promise<void> {
        return this.#completeResolvers.pending
            ? this.#iterateResolvers.promise
            : this.#completeResolvers.promise as Promise<any>;
    }

    #goNext(): void {
        if(!this.#iterateResolvers) return;
        const { resolve } = this.#iterateResolvers;
        this.#iterateResolvers = new LazyResolvers();
        resolve();
    }

    get completed(): boolean {
        return this.#completeResolvers.fulfilled;
    }

    get stopped(): boolean {
        return this.#completeResolvers.rejected;
    }

    #complete() {
        this.#completeResolvers.resolve(this.current as Type);
        this.#iterateResolvers.resolve();
    }

    #caughtError(err: unknown, options: ParseErrorOptions) {
        if (err instanceof Error && !(err instanceof ParsingException)) {
            console.error(err);
        }

        const exception
            = err instanceof ParsingException
            ? err
            : new UncaughtParseError({ ...options, cause: err });
        this.#completeResolvers.reject(exception);
        this.#iterateResolvers.reject(exception);
    }

    toJSON() {
        if (!this.#completeResolvers.fulfilled) {
            throw new IncompleteParse('');
        }
        return this.#completeResolvers.result;
    }
}
