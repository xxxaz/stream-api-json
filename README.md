# Stream-API JSON

- JavaScriptオブジェクトとJSON文字列間の逐次的な変換を[Stream API](https://developer.mozilla.org/ja/docs/Web/API/Streams_API)を用いて実装しています。
  - [Fetch API](https://developer.mozilla.org/ja/docs/Web/API/Fetch_API)の[Response.body](https://developer.mozilla.org/ja/docs/Web/API/Response/body)にエンコードを行った上で`.pipeTo`可能です。
  - [チャンク化されたレスポンス](https://developer.mozilla.org/ja/docs/Web/HTTP/Headers/Transfer-Encoding#%E3%83%81%E3%83%A3%E3%83%B3%E3%82%AF%E5%8C%96%E3%81%AE%E7%AC%A6%E5%8F%B7%E5%8C%96)で特に効果を発揮するでしょう
- 各種モダンブラウザ及びNode.js(18以上)で共通して扱うことが可能です。
- 他パッケージに依存していません。
- 値を丸ごと取り出す消費 (`all()`) では、子要素ごとの中間ノードを生成せずに値を確定させます。
  - 逐次観測 (反復・`current`) を始めたコンテナだけが子ノードを作ります。
- 巨大な配列・オブジェクトを一定メモリで処理したい場合は `iterateJsonArray` / `iterateJsonEntries` を使ってください。
  - `JsonStreamingParser` は「あとで全体値も取れる」ことを保証するため、完了した子を保持し続けます。

---

- This library implements the sequential processing conversion between JavaScript objects and JSON strings with [Stream API](https://developer.mozilla.org/en/docs/Web/API/Streams_API).
  - It can be encoded and piped to [Response.body](https://developer.mozilla.org/en/docs/Web/API/Response/body) of [Fetch API](https://developer.mozilla.org/en/docs/Web/API/Fetch_API).
  - It is particularly effective with [chunked responses](https://developer.mozilla.org/en/docs/Web/HTTP/Headers/Transfer-Encoding#chunked_encoding).
- It can be used in various modern browsers and Node.js (version 18 and above).
- It does not depend on any other packages.
- When a value is consumed as a whole (`all()`), it is materialized without creating intermediate nodes for each child.
  - Only containers that started incremental observation (iteration or `current`) create child nodes.
- To process huge arrays or objects with bounded memory, use `iterateJsonArray` / `iterateJsonEntries`.
  - `JsonStreamingParser` keeps completed children so that the whole value can still be obtained later.


## Bounded memory consumption

消費した分を保持しない逐次取り出しの入口です。全体値を返す `all()` を持たないため、
「全体は要らないが件数が多い」処理 (帳票出力・移送・集計) を一定メモリで回せます。

These entry points do not retain what has been consumed. They have no `all()` that returns
the whole value, so you can process "many items, whole value not needed" workloads
(reporting, transfer, aggregation) with bounded memory.

```ts
import { iterateJsonArray, iterateJsonEntries } from '@xxxaz/stream-api-json';

// 配列を要素ごとに取り出す / take each member of an array
for await (const row of iterateJsonArray<Row>(response.body!.pipeThrough(new TextDecoderStream()))) {
    await writeRow(row);
}

// オブジェクトをエントリごとに取り出す / take each entry of an object
for await (const [key, value] of iterateJsonEntries(source)) {
    console.log(key, value);
}
```

実測 (1MB / 4,000 要素の配列を捨てながら消費 / consuming a 1MB array of 4,000 members and discarding):

| | heap |
|---|---|
| `JsonStreamingParser` + 反復 / iteration | +43.7MB |
| `iterateJsonArray` | **+3.9MB** |

## Notes on parsing behavior

- 観測されていないコンテナは子ノードを作らないため、パース中の `current` は空 (`{}` / `[]`) を返します。
  途中の構造を見たい場合は反復を始めるか `current` に触れてください (次のチャンクから逐次パスに切り替わります)。
- 値が確定した後で反復を始めた場合、返るのは確定値を持つ `MaterializedJson` です
  (`instanceof ParsingJsonString` 等での判定は逐次パスでのみ成立します)。
- `strict` を指定した場合は、`JSON.parse` が見逃す検査 (キー重複など) を行うため常に逐次パスを使います。

- While a container is not observed, no child nodes are created, so `current` returns an empty
  value (`{}` / `[]`) during parsing. Start iterating (or touch `current`) to switch to the
  incremental path from the next chunk.
- If iteration starts after the value has been determined, members are returned as
  `MaterializedJson` holding the value (`instanceof ParsingJsonString` checks only hold on the
  incremental path).
- With `strict`, the incremental path is always used because it performs checks that
  `JSON.parse` does not (such as duplicate keys).


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