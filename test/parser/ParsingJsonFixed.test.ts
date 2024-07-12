import { ParsingJsonFalse, ParsingJsonNull, ParsingJsonTrue } from "../../src/parser/ParsingJsonFixed";

describe('ParsingJsonNull', () => {
    it('should match initial string with "null"', () => {
        expect(ParsingJsonNull.matchInit('n')).toBe(true);
        expect(ParsingJsonNull.matchInit('nu')).toBe(true);
        expect(ParsingJsonNull.matchInit('nul')).toBe(true);
        expect(ParsingJsonNull.matchInit('null')).toBe(true);
        expect(ParsingJsonNull.matchInit('nn')).toBe(false);
    });

    it('should have type null', () => {
        const parsingJsonNull = new ParsingJsonNull();
        expect(parsingJsonNull.type).toBe(null);
    });

    it('should have current value null', () => {
        const parsingJsonNull = new ParsingJsonNull();
        expect(parsingJsonNull.current).toBe(null);
    });
});

describe('ParsingJsonTrue', () => {
    it('should match initial string with "true"', () => {
        expect(ParsingJsonTrue.matchInit('t')).toBe(true);
        expect(ParsingJsonTrue.matchInit('tr')).toBe(true);
        expect(ParsingJsonTrue.matchInit('tru')).toBe(true);
        expect(ParsingJsonTrue.matchInit('true')).toBe(true);
        expect(ParsingJsonTrue.matchInit('tt')).toBe(false);
    });

    it('should have type Boolean', () => {
        const parsingJsonTrue = new ParsingJsonTrue();
        expect(parsingJsonTrue.type).toBe(Boolean);
    });

    it('should have current value true', () => {
        const parsingJsonTrue = new ParsingJsonTrue();
        expect(parsingJsonTrue.current).toBe(true);
    });
});

describe('ParsingJsonFalse', () => {
    it('should match initial string with "false"', () => {
        expect(ParsingJsonFalse.matchInit('f')).toBe(true);
        expect(ParsingJsonFalse.matchInit('fa')).toBe(true);
        expect(ParsingJsonFalse.matchInit('fal')).toBe(true);
        expect(ParsingJsonFalse.matchInit('fals')).toBe(true);
        expect(ParsingJsonFalse.matchInit('false')).toBe(true);
        expect(ParsingJsonFalse.matchInit('ff')).toBe(false);
    });

    it('should have type Boolean', () => {
        const parsingJsonFalse = new ParsingJsonFalse();
        expect(parsingJsonFalse.type).toBe(Boolean);
    });

    it('should have current value false', () => {
        const parsingJsonFalse = new ParsingJsonFalse();
        expect(parsingJsonFalse.current).toBe(false);
    });
});