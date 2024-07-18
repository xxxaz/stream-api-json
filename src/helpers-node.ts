import { type Readable } from 'stream';
import { JsonStreamingParser } from "./parser/JsonStreamingParser.js";
import { type Stringifyable, stringify } from "./stringifier/Stringifyable.js";
import { StreamingJsonOptions } from "./types.js";
import { iterateStream } from './utility.js';

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

type Source = Stringifyable|ReadableStream<string>;
type NodeReadable = typeof import('stream').Readable;
export function toNodeReadable(source: Source, options?: StreamingJsonOptions): Promise<Readable>;
export function toNodeReadable(source: Source, options: StreamingJsonOptions|undefined, Readable: NodeReadable): Readable;
export function toNodeReadable(
    source: Source,
    options?: StreamingJsonOptions,
    Readable?: NodeReadable
) : Readable|Promise<Readable> {
    if(!Readable) {
        return import('stream').then(({ Readable }) => toNodeReadable(source, options, Readable));
    }

    const generator = (source instanceof ReadableStream)
        ? iterateStream(source)
        : stringify(source, options);
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
