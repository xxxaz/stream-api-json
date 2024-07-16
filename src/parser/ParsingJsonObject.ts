import { ParsingException, UncaughtParseError, BadParse, NestedParseException, ParseErrorOptions } from "./ParsingException";
import { resolveParseType } from "./ParsingJsonTypes";
import { ParsingJson } from "./ParsingJson";
import { ParsingJsonString } from "./ParsingJsonString";
import { type StreamingJsonOptions, type SerializableObject } from "../types";

type LoadingEntry<T extends SerializableObject, K extends keyof T & string = keyof T & string> = {
    key: ParsingJsonString<K>;
    value?: ParsingJson<T[K]>;
};

export type ParsingEntry<T extends SerializableObject, K extends keyof T & string = keyof T & string> = [
    K, ParsingJson<T[K]>
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

    #availableKey(key: string) {
        return this.ignorePrototype
            ? key !== '__proto__'
            : true;
    }

    get currentKeys() : (keyof Type & string)[] {
        return this.#loadedEntries
            .filter(entry => entry.key.completed)
            .filter(({ key }) => this.#availableKey(key.current))
            .map(entry => entry.key.current);
    }

    get current() {
        return Object.fromEntries(
            this.#loadedEntries
                .filter(entry => entry.key.completed)
                .filter(entry => entry.value?.completed)
                .filter(({ key }) => this.#availableKey(key.current))
                .map(entry => [ entry.key.current, entry.value?.current ])
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
            async (loaded: string) => {
                if(!loaded.length) return null;
                const errorOptions = () => {
                    return { parsingJson: this, source: loaded, offset: pointer };
                };
                if(loaded[0] !== '{') {
                    throw new BadParse(`object must starts with '{', but passed '${loaded[0]}'.`, errorOptions());
                }
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

    async * entries() : AsyncGenerator<ParsingEntry<Type>> {
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

