import { iterateStream } from "../src/utility.js";

export class MockStream extends ReadableStream<string> {
    constructor(source: Iterable<string>) {
        super({
            pull: controller => {
                for (const chunk of source) {
                    controller.enqueue(chunk);
                }
                controller.close();
            }
        });
    }

    static pipe(source: Iterable<string>, target: WritableStream<string>) {
        return new MockStream(source).pipeTo(target);
    }
}

export async function readAll(stream: ReadableStream<string>) {
    let result = '';
    for await (const chunk of iterateStream(stream)) {
        result += chunk;
    }
    return result;
}
