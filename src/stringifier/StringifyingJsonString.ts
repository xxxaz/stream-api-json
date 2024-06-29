import { type IterateSource, type StreamingJsonOptions } from "../types";
import { iterate } from "../utility";
import { StringifyingJson } from "./StringifyingJson";

export class StringifyingJsonString extends StringifyingJson {
    constructor(source: IterateSource<string>, options?: StreamingJsonOptions) {
        super(
            () => this.#stringify(source),
            options
        );
    }

    async * #stringify(source: IterateSource<string>) : AsyncGenerator<string>
    {
        yield '"';
        for await(const chunk of iterate(source)) {
            if(!chunk) continue;
            yield JSON.stringify(chunk).slice(1, -1);
        }
        yield '"';
    }
}