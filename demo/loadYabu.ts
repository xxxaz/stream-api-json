import { StringifyingJsonString, StringifyingJsonArray, StringifyingJsonObject, StringifyingJsonEntry } from '../src/index.js';

export function loadYabu(content: string) {
    return new StringifyingJsonObject(entries(content));
}

function sleep(ms: number) {
    return new Promise<void>(resolve => setTimeout(resolve, ms));
}

async function * entries(content: string) : AsyncGenerator<StringifyingJsonEntry> {
    yield ['title', '藪の中'];
    await sleep(200);
    yield ['author', '芥川龍之介'];
    await sleep(200);
    yield ['published', 1922];
    await sleep(200);

    const [firstHalf, secondHalf] = content.split('―――――――――――――');
    const testimonies = paragraphs(firstHalf);
    yield ['testimonies', new StringifyingJsonArray(testimonies)];
    await testimonies.return?.(null);
    const confessions = paragraphs(secondHalf);
    yield ['confessions', new StringifyingJsonArray(confessions)];
}

async function * paragraphs(content: string) : AsyncGenerator<StringifyingJsonObject> {
    for(const paragraph of content.split('\n\n')) {
        const lines = paragraph.trim().split('\n');
        const subtitle = lines.shift()!;
        if(!subtitle) continue;
        
        async function * paragraphContent() : AsyncGenerator<string> {
            for(const line of lines) {
                await sleep(Math.min(line.length, 500));
                yield line.startsWith('　') ? line.slice(1) : line;
            }
        }
        async function * paragraphObject() : AsyncGenerator<StringifyingJsonEntry> {
            yield ['subtitle', subtitle];
            yield ['content', new StringifyingJsonArray(paragraphContent())];
        }

        yield new StringifyingJsonObject(paragraphObject());
    }
}