
import { readFileSync } from 'fs';
import { createServer } from 'http';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { TypeScriptServerResponse } from './TypeScriptServerResponse.js';
import { loadYabu } from './loadYabu.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

createServer((req, res) => {
    const response = new TypeScriptServerResponse(res);

    if(req.url === '/' || req.url === '/demo') {
        return response.redirect('/demo/');
    }

    if(req.url?.startsWith('/demo/') || req.url?.startsWith('/src/')) {
        const filePath = resolve(__dirname, '..' + req.url);
        return response.file(filePath);
    }

    if(req.url === '/load-yabu') {
        const text = readFileSync(resolve(__dirname, 'yabu.txt')).toString();
        const [transfer, display] = loadYabu(text).tee();
        loggingChunk(display);
        return response.chunkedJson(transfer as any);
    }

    return response.notFound();
})
.listen(9000);
console.info(`Server running at http://localhost:9000/demo/`);

async function loggingChunk(stream: ReadableStream<string>) {
    const reader = stream.getReader();
    while(true) {
        const { done, value } = await reader.read();
        if(done) break;
        console.log('[Chunk from Server] =>', value);
    }
}
