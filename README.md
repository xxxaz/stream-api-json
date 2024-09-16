# Stream-API JSON

- JavaScriptオブジェクトとJSON文字列間の逐次的な変換を[Stream API](https://developer.mozilla.org/ja/docs/Web/API/Streams_API)を用いて実装しています。
  - [Fetch API](https://developer.mozilla.org/ja/docs/Web/API/Fetch_API)の[Response.body](https://developer.mozilla.org/ja/docs/Web/API/Response/body)にエンコードを行った上で`.pipeTo`可能です。
  - [チャンク化されたレスポンス](https://developer.mozilla.org/ja/docs/Web/HTTP/Headers/Transfer-Encoding#%E3%83%81%E3%83%A3%E3%83%B3%E3%82%AF%E5%8C%96%E3%81%AE%E7%AC%A6%E5%8F%B7%E5%8C%96)で特に効果を発揮するでしょう
- 各種モダンブラウザ及びNode.js(18以上)で共通して扱うことが可能です。
- 他パッケージに依存していません。
- 巨大なJSON文字列を限定されたメモリ環境下で扱うユースケースは想定されて**いません**
  - JSONのパース処理において途中経過のデータは全てメモリ上に保持しています

---

- This library implements the sequential processing conversion between JavaScript objects and JSON strings with [Stream API](https://developer.mozilla.org/en/docs/Web/API/Streams_API).
  - It can be encoded and piped to [Response.body](https://developer.mozilla.org/en/docs/Web/API/Response/body) of [Fetch API](https://developer.mozilla.org/en/docs/Web/API/Fetch_API).
  - It is particularly effective with [chunked responses](https://developer.mozilla.org/en/docs/Web/HTTP/Headers/Transfer-Encoding#chunked_encoding).
- It can be used in various modern browsers and Node.js (version 18 and above).
- It does not depend on any other packages.
- This library is **not** intended for use cases involving handling huge JSON strings in limited memory environments.
  - All intermediate data during the JSON parsing process is stored in memory.


## Usage

### Server
```ts
import { createServer } from 'http';
import { StringifyingJsonArray, StringifyingJsonString, toNodeReadable } from '@xxxaz/stream-api-json';

async function * outputStream() {
    yield "one";
    yield "two";
    yield "three";
    yield new StringifyingJsonString(fibonacci());
}

async function * fibonacci() {
    let prev = 0;
    let cur = 1;
    while (cur < 1000) {
        yield String(cur);
        const sw = cur;
        cur += prev;
        prev = sw;
    }
}

createServer(async (req, res) => {
    const source = new StringifyingJsonArray(outputStream());
    const stream = await toNodeReadable(source);
    res.writeHead(200, {
        'Content-Type': 'application/json',
        'Transfer-Encoding': 'chunked'
    })
    stream.pipe(res);
})
.listen(8080);
```

### Client
```ts
import { JsonStreamingParser, ParsingJsonArray, ParsingJsonString } from '@xxxaz/stream-api-json';

async function fetchStream(url: string) {
    const response = await fetch(url);
    const readableStream = response.body?.pipeThrough(new TextDecoderStream());
    const root = await JsonStreamingParser
        .readFrom(readableStream)
        .root();
    const element = document.querySelector('#parsing');
    if(!(root instanceof ParsingJsonArray)) throw new Error('response is not Array');
    for await (const row of root) {
        if(!(row instanceof ParsingJsonString)) throw new Error('row is not String');
        const p = document.createElement('p');
        p.innerText = await row.all();
        element.textContent = JSON.stringify(root.current, null, 4);
    }
}
```