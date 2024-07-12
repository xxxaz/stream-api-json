import { type IterateSource } from "./types";

type Resolve<T> = (value: T | PromiseLike<T>) => void;
type Reject = (reason: unknown) => void;

const Incomplete = Symbol('Incomplete');
export class LazyResolvers<T> {
    #resolve: Resolve<T>|null = null;
    #value: T|typeof Incomplete = Incomplete;
    readonly resolve: Resolve<T> = async (value) => {
        if(!this.pending) return;
        if((value as PromiseLike<T>)?.then instanceof Function) {
            try {
                const resolved = await value;
                this.resolve(resolved);
            } catch (err) {
                this.reject(err);
            }
            return;
        }
        this.#value = value as T;
        this.#resolve?.(value);
    };

    #reject: Reject|null = null;
    #reason: unknown|typeof Incomplete = Incomplete;
    readonly reject: Reject = (reason) => {
        if(!this.pending) return;
        this.#reason = reason;
        this.#reject?.(reason);
    };

    #promise: Promise<T>|null = null;
    get promise(): Promise<T> {
        if(this.#value !== Incomplete) return Promise.resolve(this.#value);
        if(this.#reason !== Incomplete) return Promise.reject(this.#reason);
        return this.#promise ??= new Promise<T>((res, rej) => {
            this.#resolve = res;
            this.#reject = rej;
        });
    }

    get result(): T|undefined {
        return this.#value === Incomplete ? undefined : this.#value;
    }

    get fulfilled(): boolean {
        return this.#value !== Incomplete;
    }

    get rejected(): boolean {
        return this.#reason !== Incomplete;
    }

    get pending(): boolean {
        return this.#value === Incomplete && this.#reason === Incomplete;
    }

    get state(): 'pending'|'fulfilled'|'rejected' {
        if(this.fulfilled) return 'fulfilled';
        if(this.rejected) return 'rejected';
        return 'pending';
    }
}

export function iterate<T>(source: IterateSource<T>) : AsyncIterable<T>|Iterable<T>
{
    if (source instanceof ReadableStream) {
        return iterateStream(source);
    }
    return source;
}

export async function * iterateStream<T>(source: ReadableStream<T>) : AsyncGenerator<T> 
{
    const reader = source.getReader();
    while(true) {
        const { done, value } = await reader.read()
        if(done) return;
        yield value;
    }
}
