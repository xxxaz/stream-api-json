import { type ServerResponse } from 'http';
import { readFileSync, existsSync, lstatSync } from 'fs';
import { resolve } from 'path';
import { Readable } from 'stream';
import { transpile, ScriptTarget, ModuleKind } from 'typescript';

import { type Stringifyable } from "../src/stringifier/Stringifyable.js";
import { toNodeReadable } from "../src/helpers-node.js";
import { StreamingJsonOptions } from '../src/types.js';

type HttpServerOptions = {
    indexFile?: string;
    mimeTypes?: Record<string, string>;
};
export class TypeScriptServerResponse {
    readonly indexFile: string;
    readonly mimeTypes: Record<string, string>;

    constructor(readonly response: ServerResponse, options: HttpServerOptions = {}) {
        this.indexFile = options.indexFile ?? 'index.html';
        this.mimeTypes = options.mimeTypes ?? {
            html: 'text/html',
            js: 'text/javascript',
            txt: 'text/plain',
            json: 'application/json',
        };
    }

    file(filePath: string, contentType?: string) {
        if(existsSync(filePath) && lstatSync(filePath).isDirectory()) {
            filePath = resolve(filePath, this.indexFile);
        }
        contentType ??= this.contentType(filePath);

        if(existsSync(filePath) && lstatSync(filePath).isFile()) {
            return this.response
                .writeHead(200, { 'Content-Type': contentType })
                .end(readFileSync(filePath, 'utf8'));
        }

        if(filePath.endsWith('.js')) {
            const javascript = this.loadTypescript(filePath);
            if (javascript !== null) {
                return this.response
                    .writeHead(200, { 'Content-Type': contentType })
                    .end(javascript);
            }
        }

        return this.notFound();
    }

    chunkedJson(source: Stringifyable, options?: StreamingJsonOptions) {
        const stream = toNodeReadable(source, options, Readable);
        this.response.writeHead(200, {
            'Content-Type': 'application/json',
            'Transfer-Encoding': 'chunked'
        })
        return stream.pipe(this.response);
    }

    contentType(filePath: string) : string {
        for(const [ext, type] of Object.entries(this.mimeTypes)) {
            if(filePath.endsWith('.' + ext)) return type;
        }
        return 'application/octet-stream';
    }
    
    loadTypescript(jsPath: string) : string|null {
        if(!jsPath.endsWith('.js')) return null;

        const tsPath = jsPath.replace(/\.js$/, '.ts');
        if(existsSync(tsPath) && lstatSync(tsPath).isFile()) {
            const tsCode = readFileSync(tsPath).toString();
            return transpile(tsCode, {
                target: ScriptTarget.ESNext,
                module: ModuleKind.ESNext,
                declaration: true
            });
        }

        return null;
    }

    notFound(message?: string) {
        return this.response
            .writeHead(404, {
                'Content-Type': 'application/json'
            })
            .end(JSON.stringify({
                status: 404,
                error: 'Not Found.',
                path: this.response.req.url,
                message
            }));
    }

    redirect(path: string) {
        return this.response
            .writeHead(302, {
                'Location': path
            })
            .end();
    }
}
