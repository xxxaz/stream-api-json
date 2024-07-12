import { BadParse, NestedParseException, ParseErrorOptions, ParsingException, UncaughtParseError } from "./ParsingException";
import { resolveParseType } from "./ParsingJsonTypes";
import { ParsingJson } from "./ParsingJson";
import { type StreamingJsonOptions, type PartialSerializableArray, type SerializableArray } from "../types";

export class ParsingJsonArray<Type extends SerializableArray>
    extends ParsingJson<Type, PartialSerializableArray<Type>>
    implements AsyncIterable<ParsingJson<Type[number]>>
{
    static matchInit(initial: string): boolean {
        return initial[0] === '[';
    }

    get type() {
        return Array;
    }

    readonly #loadedMembers: ParsingJson<Type[number]>[] = [];

    get current() {
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
                throw new BadParse("expected double-quoted property name", errorOptions);
        }
        if (!lastParse.completed) {
            throw new BadParse('Incomplete array member.', errorOptions);
        }
        if(nextChar === ']') return nextChar;
        if(nextChar === ',') return nextChar;
        throw new BadParse("expected ':' after property name in object", errorOptions);
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
            async (loaded: string) => {
                if(!loaded.length) return null;
                const errorOptions = () => {
                    return { parsingJson: this, source: loaded, offset: pointer };
                };
                if(loaded[0] !== '[') {
                    throw new BadParse(`array must starts with '[', but passed '${loaded[0]}'.`, errorOptions());
                }
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

    async * [Symbol.asyncIterator]() {
        let pointer = 0;
        while (true) {
            const members = this.#loadedMembers;
            if(members.length > pointer) {
                yield * members.slice(pointer);
                pointer = members.length;
            }
            if(this.completed) return;
            await this.waitNext();
        }
    }
}

