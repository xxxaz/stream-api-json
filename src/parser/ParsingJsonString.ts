import { type StreamingJsonOptions } from "../types";
import { BadParse } from "./ParsingException";
import { ParsingJson } from "./ParsingJson";

export class ParsingJsonString<T extends string = string>
    extends ParsingJson<T, string>
    implements AsyncIterable<string>
{
    static matchInit(initial: string): boolean {
        return initial[0] === '"';
    }

    get type() {
        return String;
    }

    #result: T|null = null;
    get current(): T|string {
        if(this.#result !== null) {
            return this.#result;
        }
        const start = this.source.indexOf('"');
        for(let i = this.source.length; i > start; i--) {
            try {
                return JSON.parse(this.source.slice(0, i) + '"');
            } catch (_) {}
        }
        return '';
    }

    constructor(options?: StreamingJsonOptions) {
        let pointer = 1;
        super(
            async (loaded: string) => {
                if(!loaded.length) return null;
                if(loaded[0] !== '"') {
                    throw new BadParse(
                        `string must starts with '"', but passed '${loaded[0]}'.`,
                        {
                            streamJson: this,
                            source: loaded,
                            offset: 0
                        }
                    );
                }

                while (true) {
                    const endQuoted = loaded.indexOf('"', pointer);
                    if(endQuoted < 0) return null;
                    try {
                        const quoted = loaded.slice(0, endQuoted + 1);
                        this.#result = JSON.parse(quoted);
                        return quoted.length;
                    } catch (_) {}
                    pointer = endQuoted + 1;
                }
            },
            options
        );
    }
    
    async * [Symbol.asyncIterator]() {
        let pointer = 0;
        while (true) {
            const current = this.current;
            if(current.length > pointer) {
                yield current.slice(pointer);
                pointer = current.length;
            }
            if(this.completed) return;
            await this.waitNext();
        }
    }
}
