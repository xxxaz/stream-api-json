
export async function loader() {
    const response = await fetch('/load-yabu');
    return response.body?.pipeThrough(new TextDecoderStream());
}
