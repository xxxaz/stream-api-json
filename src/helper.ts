import { JsonStreamingParser } from "./parser/JsonStreamingParser";

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
