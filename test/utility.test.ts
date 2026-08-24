import { LazyResolvers, iterate, iterateStream } from "../src/utility.js";
import { MockStream } from "./mock.js";

describe("LazyResolvers", () => {
    it("resolves once and reports state", async () => {
        const resolvers = new LazyResolvers<number>();
        expect(resolvers.pending).toBe(true);
        resolvers.resolve(1);
        await expect(resolvers.promise).resolves.toBe(1);
        expect(resolvers.fulfilled).toBe(true);
        expect(resolvers.pending).toBe(false);
        expect(resolvers.result).toBe(1);

        // 2 回目以降は無視される
        resolvers.resolve(2);
        await expect(resolvers.promise).resolves.toBe(1);
    });

    it("resolves with an awaited value", async () => {
        const resolvers = new LazyResolvers<number>();
        resolvers.resolve(Promise.resolve(5));
        await expect(resolvers.promise).resolves.toBe(5);
    });

    it("rejects when the awaited value fails", async () => {
        const resolvers = new LazyResolvers<number>();
        resolvers.resolve(Promise.reject(new Error('failed')));
        await expect(resolvers.promise).rejects.toThrow('failed');
        expect(resolvers.rejected).toBe(true);
    });

    it("keeps the first rejection", async () => {
        const resolvers = new LazyResolvers<number>();
        resolvers.reject(new Error('first'));
        resolvers.reject(new Error('second'));
        await expect(resolvers.promise).rejects.toThrow('first');
        expect(resolvers.fulfilled).toBe(false);
    });

    it("ignores resolve after reject", async () => {
        const resolvers = new LazyResolvers<number>();
        resolvers.reject(new Error('failed'));
        resolvers.resolve(1);
        await expect(resolvers.promise).rejects.toThrow('failed');
    });
});

describe("iterate", () => {
    it("passes through iterables", async () => {
        const received = [] as number[];
        for await (const value of iterate([1, 2, 3])) received.push(value);
        expect(received).toEqual([1, 2, 3]);
    });

    it("wraps a ReadableStream", async () => {
        const received = [] as string[];
        for await (const chunk of iterate(new MockStream(['a', 'b']))) received.push(chunk);
        expect(received).toEqual(['a', 'b']);
    });

    it("iterates a ReadableStream directly", async () => {
        const received = [] as string[];
        for await (const chunk of iterateStream(new MockStream(['x']))) received.push(chunk);
        expect(received).toEqual(['x']);
    });

    it("passes through async iterables", async () => {
        async function* source() {
            yield 1;
            yield 2;
        }
        const received = [] as number[];
        for await (const value of iterate(source())) received.push(value);
        expect(received).toEqual([1, 2]);
    });
});
