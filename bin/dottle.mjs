#!/usr/bin/env node

import process from 'node:process';
import { realpathSync } from 'node:fs';
import * as url from 'node:url';

import { Parser } from '../lib/parser.js';
import { Emitter, toStream, asWriteableStream } from '../lib/emitter.js';

async function main(env, argv, stdin = process.stdin, stdout = process.stdout) {
    try {
        const readable = toStream(Emitter(Parser(stdin)));
        const writable = asWriteableStream(process.stdout);
        await readable.pipeTo(writable);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

if (
    import.meta.url.startsWith('file:')
    && realpathSync(process.argv[1]) === url.fileURLToPath(import.meta.url)
) {
    await main(process.env, process.argv.slice(2), process.stdin, process.stdout);
}
