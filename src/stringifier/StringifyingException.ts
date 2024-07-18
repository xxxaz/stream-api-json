import { StringifyingJson } from "./StringifyingJson.js";

export type StringifyErrorOptions = {
    readonly stringifyingJson?: StringifyingJson;
    readonly cause?: unknown;
};

export abstract class StringifyingException extends Error {
    readonly stringifyingJson?: StringifyingJson;

    constructor(
        message: string,
        options?: StringifyErrorOptions
    ) {
        super(message, options);
        this.stringifyingJson = options?.stringifyingJson;
    }
}

export class NestedStringifyException extends StringifyingException {
    readonly name = 'NestedStringifyException';
    readonly cause!: StringifyingException;
    constructor(
        readonly key: number|string,
        options: StringifyErrorOptions & { cause: StringifyingException }
    ) {
        super('', options);
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
