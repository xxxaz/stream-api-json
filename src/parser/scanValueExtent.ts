/**
 * JSON 値の範囲走査。
 *
 * ストリーミングパースは値ごとにノード (WritableStream) を生成するため、元データの
 * 数百倍のヒープを消費する。部分木を丸ごと必要とする消費者 (`all()`) に対しては
 * ノードを作らず「値の終端まで走査して `JSON.parse` する」方が桁で軽い。
 * その終端探索を担うのがこの関数。
 *
 * 妥当性の検証は行わず構造だけを追う (最終的な検証は切り出した部分文字列の
 * `JSON.parse` が担う)。
 */
export type ScanResult =
    /** 値の終端が確定した (end は値の直後の位置) */
    | { readonly kind: 'complete'; readonly end: number }
    /** バッファが値の途中で尽きた (続きのチャンクを待つ) */
    | { readonly kind: 'incomplete' }
    /** 構造として成立しない */
    | { readonly kind: 'invalid'; readonly offset: number };

const whitespace = new Set([' ', '\t', '\n', '\r']);

/** 文字列リテラルの終端 (閉じ引用符の直後) を返す */
function scanString(source: string, start: number): ScanResult {
    for (let i = start + 1; i < source.length; i++) {
        const char = source[i];
        if (char === '\\') {
            i += 1;
            continue;
        }
        if (char === '"') return { kind: 'complete', end: i + 1 };
    }
    return { kind: 'incomplete' };
}

const literals = ['null', 'true', 'false'] as const;

/** null / true / false の終端を返す */
function scanLiteral(source: string, start: number): ScanResult {
    for (const literal of literals) {
        if (source.startsWith(literal, start)) {
            return { kind: 'complete', end: start + literal.length };
        }
        // チャンクが途中で切れている可能性 (例: "tr" で尽きた)
        if (literal.startsWith(source.slice(start))) return { kind: 'incomplete' };
    }
    return { kind: 'invalid', offset: start };
}

const numberChars = new Set('0123456789+-.eE');

/**
 * 数値の終端を返す。
 * 数値は終端記号を持たないため、後続に区切り文字が現れるまで確定できない。
 */
function scanNumber(source: string, start: number): ScanResult {
    for (let i = start; i < source.length; i++) {
        if (numberChars.has(source[i])) continue;
        if (i === start) return { kind: 'invalid', offset: start };
        return { kind: 'complete', end: i };
    }
    return { kind: 'incomplete' };
}

/**
 * `source[start]` から始まる JSON 値の終端を走査する。
 * 先頭の空白は呼び出し側で除いておくこと。
 */
export function scanValueExtent(source: string, start: number): ScanResult {
    if (start >= source.length) return { kind: 'incomplete' };

    const initial = source[start];
    if (initial === '"') return scanString(source, start);
    if (initial === 'n' || initial === 't' || initial === 'f') {
        return scanLiteral(source, start);
    }
    if (initial !== '{' && initial !== '[') return scanNumber(source, start);

    // 配列・オブジェクトは深さを数える (文字列内の括弧は無視する)
    const stack = [initial] as ('{' | '[')[];
    for (let i = start + 1; i < source.length; i++) {
        const char = source[i];
        if (char === '"') {
            const scanned = scanString(source, i);
            if (scanned.kind !== 'complete') return scanned;
            i = scanned.end - 1;
            continue;
        }
        if (char === '{' || char === '[') {
            stack.push(char);
            continue;
        }
        if (char === '}' || char === ']') {
            const opening = stack.pop();
            const expected = char === '}' ? '{' : '[';
            if (opening !== expected) return { kind: 'invalid', offset: i };
            if (!stack.length) return { kind: 'complete', end: i + 1 };
            continue;
        }
        if (
            char === ',' ||
            char === ':' ||
            whitespace.has(char) ||
            numberChars.has(char) ||
            char === 'n' ||
            char === 't' ||
            char === 'f' ||
            char === 'a' ||
            char === 'l' ||
            char === 's' ||
            char === 'e' ||
            char === 'u' ||
            char === 'r'
        ) {
            continue;
        }
        return { kind: 'invalid', offset: i };
    }
    return { kind: 'incomplete' };
}
