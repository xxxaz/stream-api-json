import { type StreamingJsonOptions } from "../types.js";
import { BadParse } from "./ParsingException.js";
import { ParsingJson } from "./ParsingJson.js";

const escapeChars: { readonly [char: string]: string } = {
    '"': '"',
    '\\': '\\',
    '/': '/',
    b: '\b',
    f: '\f',
    n: '\n',
    r: '\r',
    t: '\t',
};

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
    /**
     * 走査しながら組み立てた復号済みの途中値。
     *
     * 以前は「末尾から 1 文字ずつ削って JSON.parse が通る位置を探す」実装だったため、
     * 長い文字列では累積長に対して O(n) 回の全体パースが走っていた。
     * 復号は走査と同時に済ませ、途中値は組み立て済みのものを返す。
     */
    #decoded = '';

    get current(): T|string {
        return this.#result ?? this.#decoded;
    }

    constructor(options?: StreamingJsonOptions) {
        /** 走査済みの絶対位置 (開き引用符の次から) */
        let scanned = 1;
        let escaped = false;
        /** \uXXXX の収集中の桁 */
        let unicode: string|null = null;
        super(
            async (loaded: string, appended: string) => {
                if(!loaded.length) return null;
                if(loaded[0] !== '"') {
                    throw new BadParse(
                        `string must starts with '"', but passed '${loaded[0]}'.`,
                        {
                            parsingJson: this,
                            source: loaded,
                            offset: 0
                        }
                    );
                }

                const errorOptions = (offset: number) => {
                    return { parsingJson: this, source: loaded, offset };
                };

                // 走査は新たに届いた分だけを見る (累積テキストの再走査を避ける)
                const base = loaded.length - appended.length;
                for (let index = Math.max(scanned, base) - base; index < appended.length; index++) {
                    const char = appended[index];
                    const absolute = base + index;

                    if (unicode !== null) {
                        if (!/^[0-9a-fA-F]$/.test(char)) {
                            throw new BadParse('bad Unicode escape', errorOptions(absolute));
                        }
                        unicode += char;
                        if (unicode.length === 4) {
                            this.#decoded += String.fromCharCode(parseInt(unicode, 16));
                            unicode = null;
                        }
                        continue;
                    }

                    if (escaped) {
                        escaped = false;
                        if (char === 'u') {
                            unicode = '';
                            continue;
                        }
                        const unescaped = escapeChars[char];
                        if (unescaped === undefined) {
                            throw new BadParse(
                                `bad escaped character '${char}'`,
                                errorOptions(absolute)
                            );
                        }
                        this.#decoded += unescaped;
                        continue;
                    }

                    if (char === '\\') {
                        escaped = true;
                        continue;
                    }

                    if (char === '"') {
                        const end = absolute + 1;
                        scanned = end;
                        // 妥当性の最終判定は JSON.parse に委ねる (制御文字やサロゲートの扱いを合わせる)
                        this.#result = JSON.parse(loaded.slice(0, end)) as T;
                        return end;
                    }

                    this.#decoded += char;
                }
                scanned = loaded.length;
                return null;
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
