import { BadParse, NestedParseException, ParseErrorOptions, ParsingException, UncaughtParseError } from "./ParsingException.js";
import { resolveParseType } from "./ParsingJsonTypes.js";
import { ParsingJson } from "./ParsingJson.js";
import { MaterializedJson, type ParsedMember } from "./MaterializedJson.js";
import { createValueScanner, type ValueScanner } from "./scanValueExtent.js";
import { type StreamingJsonOptions, type PartialSerializableArray, type SerializableArray } from "../types.js";

export class ParsingJsonArray<Type extends SerializableArray>
    extends ParsingJson<Type, PartialSerializableArray<Type>>
    implements AsyncIterable<ParsedMember<Type[number]>>
{
    static matchInit(initial: string): boolean {
        return initial[0] === '[';
    }

    get type() {
        return Array;
    }

    readonly #loadedMembers: ParsingJson<Type[number]>[] = [];

    /**
     * 反復・逐次観測が始まっているか。
     * 観測されていない間は子ノードを作らず、自身の範囲を走査して `JSON.parse` で値を得る
     * (ノードごとの WritableStream 生成がヒープを数百倍に膨らませるため)。
     */
    #observed = false;
    /** 逐次パスに入ったら戻らない (局所状態が進んでしまうため) */
    #incremental = false;
    #materialized: Type | undefined = undefined;
    /** materialize 用の再開可能スキャナ (累積テキストの再走査を避ける) */
    #scanner: ValueScanner | null = null;

    /**
     * 逐次観測を要求する。
     * 完了前なら子ノードを作る経路に切り替え、既に届いている分を掛け直す
     * (掛け直さないと、そのチャンクに含まれる子が次のチャンクまで現れない)。
     */
    #observe() {
        if (this.completed) return;
        if (this.#observed) return;
        this.#observed = true;
        this.requestReparse();
    }

    get current() {
        if (this.#materialized !== undefined) return this.#materialized;
        this.#observe();
        return this.#loadedMembers
            .filter(member => member.type === null || member.current !== null)
            .map(member => member.current) as PartialSerializableArray<Type>;
    }

    #resolveNext(lastParse: '['|']'|','|ParsingJson<Type[number]>, nextChar: string, errorOptions: ParseErrorOptions) {
        switch(lastParse) {
            case ']':
                throw new BadParse("unexpected non-whitespace character after JSON array", errorOptions);
            case '[':
                if(nextChar === ']') return nextChar;
            case ',':
                const next = resolveParseType(nextChar, { strict: this.strict });
                if (next) return next;
                throw new BadParse("expected a valid JSON value after '[' or ',' in array", errorOptions);
        }
        if (!lastParse.completed) {
            throw new BadParse('Incomplete array member.', errorOptions);
        }
        if(nextChar === ']') return nextChar;
        if(nextChar === ',') return nextChar;
        throw new BadParse("expected ',' or ']' after array member or before next member", errorOptions);
    }

    constructor(options?: StreamingJsonOptions) {
        let currentWriter: WritableStreamDefaultWriter|null = null;
        let pointer = 1;
        let lastParse = '[' as '['|','|']'|ParsingJson<any>;
        let lastParsePoint = 0;
        const parseSign = (sign: ']'|',') => {
            lastParse = sign;
            lastParsePoint = pointer;
            pointer += 1;
        };
        super(
            async (loaded: string, appended: string) => {
                if(!loaded.length) return null;
                const errorOptions = () => {
                    return { parsingJson: this, source: loaded, offset: pointer };
                };
                if(loaded[0] !== '[') {
                    throw new BadParse(`array must starts with '[', but passed '${loaded[0]}'.`, errorOptions());
                }

                // 観測されていない間は子ノードを作らず、自身の範囲を走査して JSON.parse する。
                // 走査は状態を進めないので、観測が始まれば次の呼び出しから逐次パスへ移れる。
                // strict では JSON.parse が見逃す検査 (キー重複など) を行うため逐次パスを使う。
                if (!this.#observed && !this.#incremental && !this.strict) {
                    this.#scanner ??= createValueScanner();
                    const scanned = this.#scanner.consume(appended);
                    if (scanned.kind === 'incomplete') return null;
                    if (scanned.kind === 'invalid') {
                        throw new BadParse(
                            'unexpected character in array',
                            { parsingJson: this, source: loaded, offset: scanned.offset }
                        );
                    }
                    const slice = loaded.slice(0, scanned.end);
                    try {
                        this.#materialized = JSON.parse(slice) as Type;
                    } catch (cause: unknown) {
                        throw new BadParse(
                            cause instanceof Error ? cause.message : String(cause),
                            { parsingJson: this, source: loaded, offset: 0 }
                        );
                    }
                    return scanned.end;
                }
                this.#incremental = true;
                const trim = () => {
                    pointer = loaded.length - loaded.slice(pointer).trimStart().length;
                    return loaded.slice(pointer);
                };

                while(true) {
                    if (currentWriter && lastParse instanceof ParsingJson) {
                        try {
                            await currentWriter.write(loaded.slice(pointer));
                        } catch (cause: unknown) {
                            if(cause instanceof ParsingException) {
                                throw new NestedParseException(
                                    this.#loadedMembers.length - 1, 
                                    { ...errorOptions(), cause }
                                );
                            }
                            throw new UncaughtParseError({ ...errorOptions(), cause });
                        }

                        if(!lastParse.completed) {
                            pointer = loaded.length;
                            return null;
                        }
                        const closing = currentWriter.close();
                        currentWriter = null;
                        pointer = lastParsePoint + lastParse.source.length;
                        await closing;
                    }

                    let trimmed = trim();
                    if (!trimmed) return null;
                    
                    const next = this.#resolveNext(lastParse, trimmed[0], errorOptions());

                    if (next === ']') {
                        parseSign(next);
                        return pointer;
                    }
                    if (next === ',') {
                        parseSign(next);
                        continue;
                    }

                    this.#loadedMembers.push(next as ParsingJson<Type[number]>);
                    currentWriter = next.getWriter();
                    lastParse = next;
                    lastParsePoint = pointer;
                }
            },
            options
        );
    }

    async * [Symbol.asyncIterator](): AsyncGenerator<ParsedMember<Type[number]>> {
        this.#observe();
        if (this.#materialized !== undefined) {
            // 値が確定した後の反復。確定済みの子を返す
            for (const value of this.#materialized) {
                yield new MaterializedJson(value, JSON.stringify(value));
            }
            return;
        }
        let pointer = 0;
        while (true) {
            // 読む前に版数を控える (読んだ後・待つ前の進捗を取りこぼさないため)
            const seen = this.revision;
            const members = this.#loadedMembers;
            // yield 中に消費側が await するとパーサが members を伸ばせるため、
            //   1. 「今回 yield する範囲」を先に確定させる
            //      (yield 後に members.length を読むと、その間に届いた分を消費済みとして飛ばす)
            //   2. yield 後は完了判定より先にループ先頭へ戻り、増えた分を拾う
            //      (yield 中に完了していると、その場で return すると残りを返さないまま終わる)
            const until = members.length;
            if(until > pointer) {
                yield * members.slice(pointer, until);
                pointer = until;
                continue;
            }
            if(this.completed) return;
            await this.waitNext(seen);
        }
    }
}

