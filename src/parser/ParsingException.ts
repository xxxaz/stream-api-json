import { type ParsingJsonTypes } from "./ParsingJsonTypes.js";

export type ParseErrorOptions = {
    readonly cause?: unknown;
    readonly parsingJson?: ParsingJsonTypes;
    readonly source?: string;
    readonly offset?: number;
};

export abstract class ParsingException extends Error {
    readonly parsingJson?: ParsingJsonTypes;
    readonly source?: string;
    readonly offset?: number;

    constructor(
        message: string,
        options?: ParseErrorOptions
    ) {
        super(message, options);
        this.parsingJson = options?.parsingJson;
        this.source = options?.source;
        this.offset = options?.offset;
    }
}

export class NestedParseException extends ParsingException {
    readonly name = 'NestedParseException';
    readonly cause!: ParsingException;
    constructor(
        readonly key: number|string,
        options: ParseErrorOptions & { cause: ParsingException }
    ) {
        super('', options);
    }

    get message() {
        let path = '$';
        let cause: ParsingException = this;
        while(cause instanceof NestedParseException) {
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

export class UncaughtParseError extends ParsingException {
    readonly name = 'UncaughtParseError';
    constructor(
        options?: ParseErrorOptions
    ) {
        super(String(options?.cause ?? ''), options);
    }
}

export class ParsingStreamAborted extends ParsingException {
    readonly name = 'StreamAborted';
    constructor(
        readonly reason: any,
        options?: ParseErrorOptions
    ) {
        super(String(reason), options);
    }
}

export class IncompleteParse extends ParsingException {
    readonly name = 'IncompleteParse';
}

/** @see https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Errors/JSON_bad_parse */
export class BadParse extends ParsingException {
    readonly name = 'BadParse';
}
