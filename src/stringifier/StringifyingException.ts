import { StringifyingJson } from "./StringifyingJson.js";

export type StringifyErrorOptions = {
    readonly stringifyingJson?: StringifyingJson;
    readonly cause?: unknown;
};

export abstract class StringifyingException extends Error {
    readonly stringifyingJson?: StringifyingJson;

    constructor(
        /**
         * 省略時は Error の own property を作らないため、サブクラスの message getter が有効になる
         * (空文字を渡すと own property が getter を隠してしまう)
         */
        message?: string,
        options?: StringifyErrorOptions
    ) {
        super(message, options);
        this.stringifyingJson = options?.stringifyingJson;
    }
}

export class NestedStringifyException extends StringifyingException {
    readonly name = 'NestedStringifyException';
    // declare にしないとクラスフィールド定義が Error の cause を undefined で上書きする
    declare readonly cause: StringifyingException;
    constructor(
        readonly key: number|string,
        options: StringifyErrorOptions & { cause: StringifyingException }
    ) {
        // message は渡さない (下の getter でパスを組み立てる)
        super(undefined, options);
    }

    get message() {
        let path = '$';
        let cause: StringifyingException = this;
        while(cause instanceof NestedStringifyException) {
            if(typeof cause.key === 'number') {
                path += `[${cause.key}]`;
            } else {
                path += `.${cause.key}`;
            }
            cause = cause.cause;
        }
        return `at ${path} cause ${String(cause)}`;
    }
}

export class BadStringify extends StringifyingException {
    readonly name = 'BadStringify';
}

export class UncaughtStringifyError extends StringifyingException {
    readonly name = 'UncaughtStringifyError';
    constructor(
        options?: StringifyErrorOptions
    ) {
        super(String(options?.cause ?? ''), options);
    }
}

export class StringifyingStreamAborted extends StringifyingException {
    readonly name = 'StreamAborted';
    constructor(
        readonly reason: any,
        options?: StringifyErrorOptions
    ) {
        super(String(reason), options);
    }
}
