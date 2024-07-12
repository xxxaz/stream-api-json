import { JsonStreamingParser } from "./parser/JsonStreamingParser";
import { type ServerResponse } from 'http';
import { type Stringifyable, stringify } from "./stringifier/Stringifyable";

export function responseToTextStream(response: Response) {
    if(!response.body) {
        throw new Error(`No response body.`);
    }
    const contentType = response.headers.get('Content-Type')?.trim() ?? '';
    const charset = contentType.match(/charset\s*=\s*([-\w]+)/)?.[1];
    return response.body.pipeThrough(new TextDecoderStream(charset));
}

export function parseFromResponse(response: Response) {
    const contentType = response.headers.get('Content-Type')?.trim() ?? '';
    if(!contentType.startsWith('application/json')) {
        throw new Error(`Respond content-type is not JSON. (Content-Type="${contentType}")`);
    }
    return JsonStreamingParser
        .readFrom(responseToTextStream(response))
        .root();
}

export async function responseChunkedJson(
    response: ServerResponse,
    source: Stringifyable,
    strict: boolean = false
) {
    response.writeHead(200, {
        'Content-Type': 'application/json',
        'Transfer-Encoding': 'chunked'
    });
    for await(const chunk of stringify(source, strict)) {
        response.write(chunk);
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    response.end();
}
