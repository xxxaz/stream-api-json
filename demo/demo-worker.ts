
export function loader() {
    const worker = new Worker('/demo/worker.js', { type: 'module' });
    return new Promise((resolve) => {
        worker.onmessage = (event) => resolve(event.data);
    });
}
