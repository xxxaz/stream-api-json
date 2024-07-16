export type Primitive = null|boolean|number|string;
export type SerializableArray = readonly Serializable[];
export type SerializableObject = { readonly [property: string]: Serializable };
export type Serializable = Primitive|SerializableArray|SerializableObject;

export type PartialSerializableArray<A extends SerializableArray>
    = A extends [...infer P, any]
        ? P extends SerializableArray
            ? A|PartialSerializableArray<P>
            : never
        : [];

export type IterateSource<T>
    = Iterable<T>
    | AsyncIterable<T>
    | ReadableStream<T>;

export type StreamingJsonOptions = {
    /**
     * @default false
     * @description If true, object with duplicated key will throw an error. 
     */
    strict?: boolean;
    /**
     * @default true
     * @description If true, the **"\_\_proto\_\_"** parameter of the object will be ignored.
     */
    ignorePrototype?: boolean;
    strategy?: QueuingStrategy<string>;
};
    