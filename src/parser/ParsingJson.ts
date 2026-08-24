import { LazyResolvers } from "../utility.js";
import { BadParse, IncompleteParse, ParseErrorOptions, ParsingStreamAborted, ParsingException, UncaughtParseError } from "./ParsingException.js";
import { type ParsingJsonTypes } from "./ParsingJsonTypes.js";
import { type StreamingJsonOptions, type Serializable } from "../types.js";

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
        /**
         * @param loaded 累積したテキスト全体
         * @param appended 今回新たに届いた分 (累積全体の再走査を避ける用途)
         */
        parseChunk: (loaded: string, appended: string) => Promise<number|null>,
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
        this.#ignorePrototype = Boolean(options?.ignorePrototype ?? true);
        this.#parseChunk = parseChunk;
    }

    readonly #parseChunk: (loaded: string, appended: string) => Promise<number|null>;

    async #write(chunk: string, parseChunk: (loaded: string, appended: string) => Promise<number|null>) {
        if (!this.#completeResolvers.pending) return;
        if(!chunk) return;
        return this.#parse(this.#source + chunk, chunk, parseChunk);
    }

    #parsing = false;
    #reparseRequested = false;

    /**
     * 蓄積済みのテキストをもう一度パースし直すよう要求する。
     *
     * コンテナは観測されるまで子ノードを作らない (範囲走査で値を確定させる) ため、観測が
     * 始まった時点で既に届いている分を逐次パスに掛け直さないと、そのチャンクに含まれる子が
     * 次のチャンクまで現れない。
     * パースの最中に要求された場合は、その round が終わってから掛け直す
     * (round 中は #source が未確定で、そのまま読むと空振りする)。
     */
    protected requestReparse() {
        if (!this.#completeResolvers.pending) return;
        this.#reparseRequested = true;
        if (this.#parsing) return;
        void this.#runReparse();
    }

    async #runReparse() {
        while (this.#reparseRequested && this.#completeResolvers.pending) {
            this.#reparseRequested = false;
            const source = this.#source;
            // まだ何も届いていない場合は、次のチャンクがそのまま逐次パスに入る
            if (!source) return;
            await this.#parse(source, source, this.#parseChunk);
        }
    }

    async #parse(
        loaded: string,
        appended: string,
        parseChunk: (loaded: string, appended: string) => Promise<number|null>
    ) {
        this.#parsing = true;
        try {
            const length = await parseChunk(loaded, appended);
            this.#source = loaded.slice(0, length ?? undefined);
            this.#goNext();
            if (length !== null) this.#complete();
        } catch(err: unknown) {
            this.#caughtError(err, {
                parsingJson: this as ParsingJsonTypes,
                source: loaded,
                offset: this.#source.length
            });
        } finally {
            this.#parsing = false;
        }
        if (this.#reparseRequested) await this.#runReparse();
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

    readonly #ignorePrototype: boolean;
    get ignorePrototype() {
        return this.#ignorePrototype;
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

    /**
     * パースが進むごとに増える版数。
     * 「読んだ後・待つ前」に進んだ分を取りこぼさないための目印。
     */
    #revision = 0;
    get revision(): number {
        return this.#revision;
    }

    /**
     * 次の進捗を待つ。
     *
     * @param since 直前に観測した `revision`。渡された版数から既に進んでいる場合は
     *   待たずに解決する (待ち始める前に進捗が起きると取りこぼして固まるため)
     */
    waitNext(since?: number): Promise<void> {
        if (!this.#completeResolvers.pending) {
            return this.#completeResolvers.promise as Promise<any>;
        }
        if (since !== undefined && since !== this.#revision) {
            return Promise.resolve();
        }
        return this.#iterateResolvers.promise;
    }

    #goNext(): void {
        if(!this.#iterateResolvers) return;
        this.#revision += 1;
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
