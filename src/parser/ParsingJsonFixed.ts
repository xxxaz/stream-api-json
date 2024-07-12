import { type StreamingJsonOptions } from "../types";
import { BadParse } from "./ParsingException";
import { ParsingJson } from "./ParsingJson";

function matchPartially(key: string, initial: string): boolean {
    return key.startsWith(initial.slice(0, key.length));
}

export abstract class ParsingJsonFixed<Type extends null|boolean> extends ParsingJson<Type> {

    constructor(options?: StreamingJsonOptions) {
        super(
            async (loaded: string) => {
                const expect = JSON.stringify(this.current);
                if(!matchPartially(expect, loaded)) {
                    const passed = loaded.length <= expect.length ? loaded : loaded.slice(0, expect.length) + '...';
                    throw new BadParse(
                        `expects a string with "${expect}", but passed "${passed}".`,
                        {
                            parsingJson: this,
                            source: loaded,
                            offset: 0
                        }
                    );
                }
                return loaded.length < expect.length ? null : expect.length;
            },
            options
        );
    }
}

export class ParsingJsonNull extends ParsingJsonFixed<null> {
    static matchInit(initial: string): boolean {
        return matchPartially('null', initial);
    }

    get type() {
        return null;
    }

    get current() {
        return null;
    }
}

export class ParsingJsonTrue extends ParsingJsonFixed<true> {
    static matchInit(initial: string): boolean {
        return matchPartially('true', initial);
    }

    get type() {
        return Boolean;
    }

    get current() {
        return true as const;
    }
}

export class ParsingJsonFalse extends ParsingJsonFixed<false> {
    static matchInit(initial: string): boolean {
        return matchPartially('false', initial);
    }

    get type() {
        return Boolean;
    }

    get current() {
        return false as const;
    }
}