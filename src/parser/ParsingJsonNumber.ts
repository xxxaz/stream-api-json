import { type StreamingJsonOptions } from "../types";
import { BadParse } from "./ParsingException";
import { ParsingJson } from "./ParsingJson";

export class ParsingJsonNumber extends ParsingJson<number, null> {
    static matchInit(initial: string): boolean {
        return Boolean(initial.match(/^[-\d]/));
    }

    get type() {
        return Number;
    }

    get current() {
        return this.source.length > 0
            ? Number(this.source)
            : null;
    }

    constructor(options?: StreamingJsonOptions) {
        super(
            async (loaded: string) => {
                let trimmed = loaded;
                const errorOptions = () => {
                    return {
                        parsingJson: this,
                        source: loaded,
                        offset: loaded.length - trimmed.length
                    };
                };

                if(trimmed.startsWith('-')) {
                    trimmed = trimmed.slice(1);
                    if(!trimmed) return null;
                    if(!trimmed.match(/^\d+/)) {
                        throw new BadParse(`no number after minus sign`, errorOptions());
                    }
                }

                const integer = trimmed.match(/^\d+/)?.[0];
                if(!integer) throw new BadParse(`unexpected non-digit`, errorOptions());
                trimmed = trimmed.slice(integer.length);
                if(!trimmed) return null;

                if(trimmed.startsWith('.')) {
                    trimmed = trimmed.slice(1);
                    if(!trimmed) return null;

                    const fractional = trimmed.match(/^\d+/)?.[0];
                    if(!fractional) throw new BadParse(`missing digits after decimal point`, errorOptions());
                    trimmed = trimmed.slice(fractional.length);
                }

                if(trimmed.startsWith('e')) {
                    trimmed = trimmed.slice(1);
                    if(!trimmed) return null;
                    
                    if(trimmed.match(/^(\+|-)/)) {
                        trimmed = trimmed.slice(1);
                        if(!trimmed) return null;
                        if(!trimmed.match(/^\d+/)) {
                            throw new BadParse(`missing digits after exponent sign`, errorOptions());
                        }
                    }
            
                    const exponent = trimmed.match(/^\d+/)?.[0];
                    if(!exponent) {
                        throw new BadParse(`missing digits after exponent indicator`, errorOptions());
                    }
                    trimmed = trimmed.slice(exponent.length);
                }
                
                const matched = loaded.slice(0, -trimmed.length);
                const parsed = Number(matched);
                if(isNaN(parsed)) {
                    if(trimmed) throw new BadParse(`unexpected non-digit`, errorOptions());
                }
                return trimmed ? matched.length : null;
            },
            options
        );
    }
}
