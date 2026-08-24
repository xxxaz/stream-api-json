import { BadParse } from "./ParsingException.js";
import { createValueScanner } from "./scanValueExtent.js";
import { iterate } from "../utility.js";
import { type ParseSource } from "./JsonStreamingParser.js";
import { type Serializable, type SerializableObject } from "../types.js";

/**
 * 消費した分を保持しない逐次取り出し。
 *
 * `JsonStreamingParser` (と `ParsingJson`) は「あとで全体値も取れる」ことを保証するため、
 * 完了した子を保持し続ける。そのため巨大な配列を逐次消費してもメモリが有界にならない。
 *
 * ここでは全体値を返す口 (`all()`) を初めから持たず、要素ごとに値を確定して捨てる。
 * 「全体は要らないが件数が多い」消費 (帳票出力・移送・集計) 向け。
 * 全体値が必要な場合は `JsonStreamingParser` を使うこと。
 */

const whitespace = new Set([' ', '\t', '\n', '\r']);

type Cursor = {
    /** 未消費のテキスト */
    buffer: string;
    /** buffer 内の走査位置 */
    offset: number;
    /** 入力が尽きたか */
    drained: boolean;
};

function trimLeft(cursor: Cursor) {
    while (cursor.offset < cursor.buffer.length && whitespace.has(cursor.buffer[cursor.offset])) {
        cursor.offset += 1;
    }
}

/** 消費済みの前方を捨てる (未消費分だけを保持し続ける) */
function release(cursor: Cursor) {
    if (!cursor.offset) return;
    cursor.buffer = cursor.buffer.slice(cursor.offset);
    cursor.offset = 0;
}

async function* readChunks(input: ParseSource) {
    for await (const chunk of iterate(input) as AsyncIterable<string>) {
        yield chunk;
    }
}

/**
 * 値を 1 つ取り出す。
 * @returns 値と、その値が確定した時点の残余。入力が尽きて値が無ければ undefined
 */
async function* takeValues(
    cursor: Cursor,
    chunks: AsyncGenerator<string>,
    close: string,
    /** 値の区切りとして読み飛ばす文字 (配列は ',' / オブジェクトは ',' と ':') */
    separators: string,
): AsyncGenerator<Serializable> {
    while (true) {
        trimLeft(cursor);
        while (cursor.offset >= cursor.buffer.length) {
            const { done, value } = await chunks.next();
            if (done) {
                cursor.drained = true;
                throw new BadParse('unexpected end of JSON data', {
                    source: cursor.buffer,
                    offset: cursor.offset,
                });
            }
            cursor.buffer += value;
            trimLeft(cursor);
        }

        const char = cursor.buffer[cursor.offset];
        if (char === close) {
            cursor.offset += 1;
            release(cursor);
            return;
        }
        if (separators.includes(char)) {
            cursor.offset += 1;
            continue;
        }

        release(cursor);
        const scanner = createValueScanner();
        let scanned = scanner.consume(cursor.buffer);
        while (scanned.kind === 'incomplete') {
            const { done, value } = await chunks.next();
            if (done) {
                cursor.drained = true;
                throw new BadParse('unexpected end of JSON data', {
                    source: cursor.buffer,
                    offset: cursor.buffer.length,
                });
            }
            cursor.buffer += value;
            scanned = scanner.consume(value);
        }
        if (scanned.kind === 'invalid') {
            throw new BadParse('unexpected character', {
                source: cursor.buffer,
                offset: scanned.offset,
            });
        }

        const slice = cursor.buffer.slice(0, scanned.end);
        cursor.offset = scanned.end;
        release(cursor);
        try {
            yield JSON.parse(slice) as Serializable;
        } finally {
            // yield 済みの値は保持しない
        }
    }
}

async function openCursor(input: ParseSource, opening: '[' | '{') {
    const chunks = readChunks(input);
    const cursor: Cursor = { buffer: '', offset: 0, drained: false };
    while (true) {
        trimLeft(cursor);
        if (cursor.offset < cursor.buffer.length) break;
        const { done, value } = await chunks.next();
        if (done) {
            throw new BadParse('no data', { source: cursor.buffer, offset: 0 });
        }
        cursor.buffer += value;
    }
    const char = cursor.buffer[cursor.offset];
    if (char !== opening) {
        throw new BadParse(
            `JSON data must starts with '${opening}', but passed '${char}'.`,
            { source: cursor.buffer, offset: cursor.offset },
        );
    }
    cursor.offset += 1;
    release(cursor);
    return { chunks, cursor };
}

/**
 * 配列を要素ごとに取り出す。消費した要素は保持しない。
 * 全体値は得られないため、必要な場合は `JsonStreamingParser` を使うこと。
 */
export async function* iterateJsonArray<Type extends Serializable = Serializable>(
    input: ParseSource,
): AsyncGenerator<Type> {
    const { chunks, cursor } = await openCursor(input, '[');
    for await (const value of takeValues(cursor, chunks, ']', ',')) {
        yield value as Type;
    }
}

/**
 * オブジェクトをエントリごとに取り出す。消費したエントリは保持しない。
 * 全体値は得られないため、必要な場合は `JsonStreamingParser` を使うこと。
 */
export async function* iterateJsonEntries<Type extends SerializableObject = SerializableObject>(
    input: ParseSource,
): AsyncGenerator<[keyof Type & string, Serializable]> {
    const { chunks, cursor } = await openCursor(input, '{');
    let key: string | null = null;
    // キーと値は同じ取り出し口から交互に来る (':' は区切りとして読み飛ばされる)
    for await (const value of takeValues(cursor, chunks, '}', ',:')) {
        if (key === null) {
            if (typeof value !== 'string') {
                throw new BadParse('property names must be double-quoted string', {
                    source: cursor.buffer,
                    offset: cursor.offset,
                });
            }
            key = value;
            continue;
        }
        yield [key as keyof Type & string, value];
        key = null;
    }
    if (key !== null) {
        throw new BadParse('unexpected end of JSON object', {
            source: cursor.buffer,
            offset: cursor.offset,
        });
    }
}
