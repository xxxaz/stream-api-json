import { ParsingException, UncaughtParseError, BadParse, NestedParseException, ParseErrorOptions } from "./ParsingException.js";
import { resolveParseType } from "./ParsingJsonTypes.js";
import { ParsingJson } from "./ParsingJson.js";
import { ParsingJsonString } from "./ParsingJsonString.js";
import { MaterializedJson, type ParsedMember } from "./MaterializedJson.js";
import { createValueScanner, type ValueScanner } from "./scanValueExtent.js";
import { type StreamingJsonOptions, type SerializableObject } from "../types.js";

type LoadingEntry<T extends SerializableObject, K extends keyof T & string = keyof T & string> = {
    key: ParsingJsonString<K>;
    value?: ParsingJson<T[K]>;
};

export type ParsingEntry<T extends SerializableObject, K extends keyof T & string = keyof T & string> = [
    K, ParsingJson<T[K]>
];

/**
 * 値が確定した後に返るエントリ (ノードではなく確定値を持つ)。
 * 値側の型は確定値のため `Serializable` に留める (キー別の型は付かない)。
 */
export type MaterializedEntry<T extends SerializableObject, K extends keyof T & string = keyof T & string> = [
    K, ParsedMember
];

export class ParsingJsonObject<Type extends SerializableObject>
    extends ParsingJson<Type, Partial<Type>>
{
    static matchInit(initial: string): boolean {
        return initial[0] === '{';
    }

    get type() {
        return Object;
    }

    readonly #loadedEntries: LoadingEntry<Type>[] = [];

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

    /** 逐次観測を要求する。完了前なら次のチャンクから子ノードを作る経路に切り替わる */
    #observe() {
        if (this.completed) return;
        this.#observed = true;
    }

    #availableKey(key: string) {
        return this.ignorePrototype
            ? key !== '__proto__'
            : true;
    }

    get currentKeys() : (keyof Type & string)[] {
        if (this.#materialized !== undefined) {
            return Object.keys(this.#materialized) as (keyof Type & string)[];
        }
        this.#observe();
        return this.#loadedEntries
            .filter(({ key }) => key.completed)
            .filter(({ key }) => this.#availableKey(key.current))
            .map(entry => entry.key.current);
    }

    get current() {
        if (this.#materialized !== undefined) return this.#materialized;
        this.#observe();
        return Object.fromEntries(
            this.#loadedEntries
                .filter(({ key }) => key.completed)
                .filter(({ key }) => this.#availableKey(key.current))
                .filter(({ value }) => value)
                .map(({ key, value }) => [ key.current, value?.current ])
        ) as Partial<Type>;
    }

    #resolveNext(lastParse: '{'|'}'|','|':'|LoadingEntry<Type>, nextChar: string, errorOptions: ParseErrorOptions) {
        const getParseType = () => resolveParseType(nextChar, { strict: this.strict, ignorePrototype: this.ignorePrototype }) as ParsingJsonString;
        switch(lastParse) {
            case '}':
                throw new BadParse("unexpected non-whitespace character after JSON object", errorOptions);
            case '{':
                if(nextChar === '}') return nextChar;
                if(nextChar === '"') return getParseType();
                throw new BadParse("expected double-quoted property name or '}'", errorOptions);
            case ',':
                if(nextChar === '"') return getParseType();
                throw new BadParse("expected double-quoted property name", errorOptions);
            case ':':
                const parser = getParseType();
                if (parser) return parser;
                throw new BadParse("unexpected character", errorOptions);
        }
        if(!lastParse.value) {
            if (!lastParse.key.completed) throw new BadParse('Incomplete property names.', errorOptions);
            if(nextChar === ':') return nextChar;
            throw new BadParse("expected ':' after property name in object", errorOptions);
        } else {
            if (!lastParse.key.completed) throw new BadParse('Incomplete property names.', errorOptions);
            if (!lastParse.value.completed) throw new BadParse('Incomplete property value.', errorOptions);
            if(this.strict) {
                const duplicatedKey = this.currentKeys.find((key, index, array) => array.indexOf(key) !== index);
                if (duplicatedKey) throw new BadParse(`property name "${duplicatedKey}" is duplicate.`, errorOptions);
            }

            if(nextChar === '}') return nextChar;
            if(nextChar === ',') return nextChar;
            throw new BadParse("expected ',' or '}' after property value in object", errorOptions);
        }
    }

    constructor(options?: StreamingJsonOptions) {
        let currentWriter: WritableStreamDefaultWriter|null = null;
        let pointer = 1;
        let lastParse = '{' as '{'|'}'|','|':'|LoadingEntry<Type>;
        let lastParsePoint = 0;
        const parseSign = (sign: '}'|':'|',') => {
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
                if(loaded[0] !== '{') {
                    throw new BadParse(`object must starts with '{', but passed '${loaded[0]}'.`, errorOptions());
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
                            'unexpected character in object',
                            { parsingJson: this, source: loaded, offset: scanned.offset }
                        );
                    }
                    const slice = loaded.slice(0, scanned.end);
                    let parsed: Type;
                    try {
                        parsed = JSON.parse(slice) as Type;
                    } catch (cause: unknown) {
                        throw new BadParse(
                            cause instanceof Error ? cause.message : String(cause),
                            { parsingJson: this, source: loaded, offset: 0 }
                        );
                    }
                    if (this.ignorePrototype && '__proto__' in parsed) {
                        delete (parsed as Record<string, unknown>)['__proto__'];
                    }
                    this.#materialized = parsed;
                    return scanned.end;
                }
                this.#incremental = true;
                const trim = () => {
                    pointer = loaded.length - loaded.slice(pointer).trimStart().length;
                    return loaded.slice(pointer);
                };

                while(true) {
                    if (currentWriter && lastParse instanceof Object) {
                        try {
                            await currentWriter.write(loaded.slice(pointer));
                        } catch (cause: unknown) {
                            if(cause instanceof ParsingException) {
                                throw new NestedParseException(
                                    lastParse.key.current, 
                                    { ...errorOptions(), cause }
                                );
                            }
                            throw new UncaughtParseError({ ...errorOptions(), cause });
                        }
                        const writing = lastParse.value ?? lastParse.key;
                        if(!writing.completed) {
                            pointer = loaded.length;
                            return null;
                        }
                        const closing = currentWriter.close();
                        currentWriter = null;
                        pointer = lastParsePoint + writing.source.length;
                        await closing;
                    }

                    let trimmed = trim();
                    if (!trimmed) return null;

                    const next = this.#resolveNext(lastParse, trimmed[0], errorOptions());

                    if (next === '}') {
                        parseSign(next);
                        return pointer;
                    }
                    if (next === ',' || next === ':') {
                        parseSign(next);
                        continue;
                    }
        
                    const lastEntry = this.#loadedEntries[this.#loadedEntries.length - 1];
                    if (lastParse !== ':') {
                        if (lastEntry && !lastEntry.value?.completed) {
                            throw new BadParse('Incomplete previous value.', {
                                parsingJson: this,
                                source: loaded,
                                offset: pointer,
                            });
                        }
                        if (!(next instanceof ParsingJsonString)) {
                            throw new BadParse(
                                'property names must be double-quoted string',
                                {
                                    parsingJson: this,
                                    source: loaded,
                                    offset: pointer,
                                }
                            );
                        }

                        lastParse = { key: next };
                        this.#loadedEntries.push(lastParse);
                    } else {
                        lastEntry.value = next as any;
                        lastParse = lastEntry;
                    }

                    currentWriter = next.getWriter();
                    lastParsePoint = pointer;
                }
            },
            options
        );
    }

    async get(key: keyof Type & string) {
        for await (const [ entryKey, value ] of this.entries()) {
            if(entryKey === key) return value;
        }
        return undefined;
    }

    async * keys() : AsyncGenerator<keyof Type> {
        this.#observe();
        if (this.#materialized !== undefined) {
            for (const key of Object.keys(this.#materialized)) {
                if (this.#availableKey(key)) yield key as keyof Type;
            }
            return;
        }
        let pointer = 0;
        while (true) {
            while (pointer < this.#loadedEntries.length) {
                const entry = this.#loadedEntries[pointer];
                const key = await entry.key.all();
                if (this.#availableKey(key)) yield key;
                pointer += 1;
            }
            if(this.completed) return;
            await this.waitNext();
        }
    }

    async * entries() : AsyncGenerator<MaterializedEntry<Type>|ParsingEntry<Type>> {
        this.#observe();
        if (this.#materialized !== undefined) {
            // 値が確定した後の反復。確定済みの子を返す
            for (const [ key, value ] of Object.entries(this.#materialized)) {
                if (!this.#availableKey(key)) continue;
                yield [
                    key as keyof Type & string,
                    new MaterializedJson(value, JSON.stringify(value))
                ];
            }
            return;
        }
        let pointer = 0;
        while (true) {
            while (pointer < this.#loadedEntries.length) {
                const entry = this.#loadedEntries[pointer];
                const key = await entry.key.all();
                if (!entry.value) break;
                if (this.#availableKey(key)) yield [ key, entry.value ];
                pointer += 1;
            }
            if(this.completed) return;
            await this.waitNext();
        }
    }
}

