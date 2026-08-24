import { ParsingJsonArray } from "../../src/parser/ParsingJsonArray.js";
import { ParsingJsonObject } from "../../src/parser/ParsingJsonObject.js";
import { MockStream } from "../mock.js";

describe("ParsingJsonArray", () => {
    it("should match initial character '['", () => {
        const initial = "[";
        const result = ParsingJsonArray.matchInit(initial);
        expect(result).toBe(true);
    });

    it("should not match initial character other than '['", () => {
        const initial = "{";
        const result = ParsingJsonArray.matchInit(initial);
        expect(result).toBe(false);
    });

    it("should have type Array", () => {
        const jsonArray = new ParsingJsonArray();
        expect(jsonArray.type).toBe(Array);
    });

    it("should parse empty array", async () => {
        const jsonArray = new ParsingJsonArray();
        MockStream.pipe("[]", jsonArray);
        await expect(jsonArray.all()).resolves.toEqual([]);
    });

    it("should iterate over parsed JSON objects", async () => {
        const input = `[
            { "name": "John", "age": 30 },
            { "name": "Jane", "age": 25 },
            { "name": "Bob", "age": 40 }
        ]`;
        const expectedObjects = [
            { name: "John", age: 30 },
            { name: "Jane", age: 25 },
            { name: "Bob", age: 40 },
        ];
        const jsonArray = new ParsingJsonArray();
        MockStream.pipe(input, jsonArray);
        let index = 0;
        for await (const parsedObject of jsonArray) {
            expect(parsedObject).toBeInstanceOf(ParsingJsonObject);
            await expect(parsedObject.all()).resolves.toEqual(expectedObjects[index]);
            index++;
        }
        await expect(jsonArray.all()).resolves.toEqual(expectedObjects);
    });

    it("should not skip members when the consumer awaits between iterations", async () => {
        // 消費側が yield の合間に await すると、その間にパーサが members を伸ばせる。
        // 「今回 yield する範囲」を先に確定させないと、その分を消費済みとして飛ばす。
        const count = 200;
        const members = Array.from({ length: count }, (_, i) => ({ index: i }));
        const input = JSON.stringify(members);
        const chunkSize = Math.ceil(input.length / 4);
        const chunks = Array.from(
            { length: Math.ceil(input.length / chunkSize) },
            (_, i) => input.slice(i * chunkSize, (i + 1) * chunkSize)
        );

        const jsonArray = new ParsingJsonArray<{ index: number }[]>();
        MockStream.pipe(chunks, jsonArray);

        const received = [] as number[];
        for await (const member of jsonArray) {
            const value = await member.all();
            // 反復の合間にマクロタスクを挟み、パース側を進ませる
            await new Promise(resolve => setTimeout(resolve, 0));
            received.push(value.index);
        }

        expect(received).toEqual(members.map(({ index }) => index));
    });
});
describe("switching to incremental observation", () => {
    it("最初のチャンクに含まれる要素も、反復開始が後でも取り出せる", async () => {
        // 観測が始まるまで子ノードを作らないため、切替時に蓄積分を掛け直さないと
        // そのチャンクの要素が次のチャンクまで現れない
        const parser = new ParsingJsonArray<number[]>();
        const writer = parser.getWriter();
        await writer.write('[1,2,');

        const received = [] as number[];
        const iterating = (async () => {
            for await (const member of parser) {
                received.push(await member.all() as number);
            }
        })();

        // 追加のチャンクを送る前に、既に届いている 2 要素が出てくる
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(received).toEqual([1, 2]);

        await writer.write('3]');
        await writer.close();
        await iterating;
        expect(received).toEqual([1, 2, 3]);
    });

    it("current に触れた後も逐次の途中値が見える", async () => {
        const parser = new ParsingJsonArray<number[]>();
        const writer = parser.getWriter();
        await writer.write('[1,2,');

        // 観測を要求した時点で蓄積分が掛け直される
        expect(parser.current).toEqual([]);
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(parser.current).toEqual([1, 2]);

        await writer.write('3]');
        await writer.close();
        await expect(parser.all()).resolves.toEqual([1, 2, 3]);
    });
});
