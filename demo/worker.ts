import { loadYabu } from './loadYabu.js';

(async () => {
    const res = await fetch('/demo/yabu.txt');
    const text = await res.text();

    const [transfer, display] = loadYabu(text).tee();
    globalThis.postMessage(transfer, { transfer: [transfer] });
    for await (const chunk of display) {
        console.log('[Chunk from Worker] =>', chunk);
    }
})();