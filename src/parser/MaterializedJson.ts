import { IncompleteParse } from "./ParsingException.js";
import { type TypeConstructor } from "./ParsingJson.js";
import { type Serializable } from "../types.js";

/**
 * 既に値が確定している「ノードのように振る舞う」値。
 *
 * 観測されていないコンテナは子ノードを作らず範囲走査 + `JSON.parse` で値を得る
 * (ノードごとに WritableStream を生成すると元データの数百倍のヒープを消費するため)。
 * その後で消費側が反復を始めた場合に、確定済みの子を返すための器。
 */
export class MaterializedJson<Type extends Serializable = Serializable> {
    constructor(
        readonly current: Type,
        readonly source: string,
    ) {}

    get type(): TypeConstructor {
        const value = this.current;
        if (value === null) return null;
        switch (typeof value) {
            case 'boolean': return Boolean;
            case 'number': return Number;
            case 'string': return String;
        }
        return value instanceof Array ? Array : Object;
    }

    get completed(): boolean {
        return true;
    }

    get stopped(): boolean {
        return false;
    }

    async all(): Promise<Type> {
        return this.current;
    }

    async waitNext(): Promise<void> {}

    toJSON(): Type {
        if (this.current === undefined) throw new IncompleteParse('');
        return this.current;
    }
}

/** 反復で返り得るノード相当の型 (逐次パース中のノード or 確定済みの値) */
export type ParsedMember<Type extends Serializable = Serializable> =
    | MaterializedJson<Type>
    | {
        readonly type: TypeConstructor;
        readonly current: unknown;
        readonly completed: boolean;
        readonly stopped: boolean;
        readonly source: string;
        all(): Promise<Type>;
        waitNext(): Promise<void>;
    };
