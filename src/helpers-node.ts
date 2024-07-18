import { type ServerResponse } from 'http';
import { type Readable } from 'stream';
import { JsonStreamingParser } from "./parser/JsonStreamingParser.js";
import { type Stringifyable, stringify } from "./stringifier/Stringifyable.js";
import { StreamingJsonOptions } from "./types.js";

export function fromNodeReadable(
    stream: Readable,
    options?: StreamingJsonOptions
) {
    const parser = new JsonStreamingParser(options);
    new ReadableStream({
        start(controller) {
            stream.on('error', (error) => controller.error(error));
            stream.on('data', (chunk) => controller.enqueue(chunk));
            stream.on('end', () => controller.close());
        }
    }).pipeTo(parser);
    return parser;
}

export async function toNodeReadable(
    source: Stringifyable,
    options?: StreamingJsonOptions
) {
    const { Readable } = await import('stream');
    const generator = stringify(source, options);
    return new Readable({
        async destroy(error, callback) {
            if (error) await generator.throw(error);
            callback(error);
        },
        async read() {
            const { done, value } = await generator.next();
            if (done) {
                this.push(null);
            } else {
                this.push(value);
            }
        }
    });
}

export async function serverResponseChunkedJson(
    response: ServerResponse,
    source: Stringifyable,
    options?: StreamingJsonOptions
) {
    const stream = await toNodeReadable(source, options);
    response.writeHead(200, {
        'Content-Type': 'application/json',
        'Transfer-Encoding': 'chunked'
    })
    stream.pipe(response);
}
