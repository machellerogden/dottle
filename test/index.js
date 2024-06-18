import { test } from 'zora';
import { readFileSync as readFile } from 'fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { Emit, styles } from '../lib/emitter.js';

const fixtures = {
    basic: readFile(path.resolve(__dirname, './fixtures/basic.json'), 'utf8'),
    parallel: readFile(path.resolve(__dirname, './fixtures/parallel.json'), 'utf8'),
    parallelBasic: readFile(path.resolve(__dirname, './fixtures/parallel-basic.json'), 'utf8'),
    catch: readFile(path.resolve(__dirname, './fixtures/catch.json'), 'utf8'),
    choice: readFile(path.resolve(__dirname, './fixtures/choice.json'), 'utf8'),
    kitchensink: readFile(path.resolve(__dirname, './fixtures/kitchensink.json'), 'utf8')
};

const normalizeString = (str) => str.replace(/\s+/g, ' ');

test('basic', async (assert) => {

    const expected =
        `digraph {
            ${styles.digraph}
            "start" -> "a";
            "a" -> "b";
            "b" -> "c";
            "c" -> "d";
            "d" -> "end";
        }`;

    const result = await Emit(JSON.parse(fixtures.basic));

    assert.equal(normalizeString(result), normalizeString(expected));
});

test('parallel - basic', async (assert) => {

    const expected =
        `digraph {
            ${styles.digraph}
            "start" -> "parallel_0";
            subgraph cluster_parallel_0_0 {
                ${styles.subgraph}
                "parallel_0" -> "foo_0";
                "foo_0" -> "end";
            }
            subgraph cluster_parallel_0_1 {
                ${styles.subgraph}
                "parallel_0" -> "bar_0";
                "bar_0" -> "end";
            }
        }`;

    const result = await Emit(JSON.parse(fixtures.parallelBasic));

    assert.equal(normalizeString(result), normalizeString(expected));

});

test('parallel', async (assert) => {

    const expected =
        `digraph {
    ${styles.digraph}
"start" -> "a";
"a" -> "b";
subgraph cluster_b_0 {
                ${styles.subgraph}
"b" -> "b1a";
"b1a" -> "b1p";
subgraph cluster_b1p_0 {
color=grey;
style="rounded";
"b1p" -> "b1pa";
"b1pa" -> "b1pb";
"b1pb" -> "b1b";
}
subgraph cluster_b1p_1 {
                ${styles.subgraph}
"b1p" -> "b2pa";
"b2pa" -> "b2pb";
"b2pb" -> "b1b";
}
"b1b" -> "c";
}
subgraph cluster_b_1 {
                ${styles.subgraph}
"b" -> "b2a";
"b2a" -> "b2b";
"b2b" -> "c";
}
"c" -> "end";
}`;

    const result = await Emit(JSON.parse(fixtures.parallel));

    assert.equal(normalizeString(result), normalizeString(expected));
});

test('catch', async (assert) => {

    const expected =
        `digraph {
    ${styles.digraph}

    "start" -> "a";
    "a" -> "b";
    "b" -> "c";
    "b" -> "d";
    "d" -> "end";
    "b" -> "e";
    "e" -> "end";
    "c" -> "end";
}`.replace(/\s+/g, ' ');

    const result = await Emit(JSON.parse(fixtures.catch));

    assert.equal(result.replace(/\s+/g, ' '), expected);
});

test('choice', async (assert) => {

    const expected =
        `digraph {
            ${styles.digraph}
            "start" -> "a";
            "a" -> "b";
            "b" -> "d";
            "b" -> "e";
            "b" -> "c";
            "d" -> "end";
            "e" -> "end";
        }`.replace(/\s+/g, ' ');

    const result = await Emit(JSON.parse(fixtures.choice));

    assert.equal(result.replace(/\s+/g, ' '), expected);
});

test('kitchensink', async (assert) => {

    const expected =
        `digraph {
            ${styles.digraph}
"start" -> "CreatePrompts";
subgraph cluster_CreatePrompts_0 {
                ${styles.subgraph}
"CreatePrompts" -> "CreateExamples";
subgraph cluster_CreateExamples_0 {
                ${styles.subgraph}
"CreateExamples" -> "CreateExample";
subgraph cluster_CreateExample_0 {
                ${styles.subgraph}
"CreateExample" -> "FetchExampleIssue";
"FetchExampleIssue" -> "FormatExampleText";
}
subgraph cluster_CreateExample_1 {
                ${styles.subgraph}
"CreateExample" -> "FetchExampleData";
"FetchExampleData" -> "FormatExampleText";
}
"FormatExampleText" -> "FormatSystemText";
}
"FormatSystemText" -> "GenerateCompletion";
}
subgraph cluster_CreatePrompts_1 {
                ${styles.subgraph}
"CreatePrompts" -> "FetchIssue";
"FetchIssue" -> "FormatIssueText";
"FormatIssueText" -> "FormatPromptText";
"FormatPromptText" -> "GenerateCompletion";
}
"GenerateCompletion" -> "CreateAndPopulateWorksheet";
"CreateAndPopulateWorksheet" -> "CheckStatus";
"CheckStatus" -> "PostSlackMessage";
"CheckStatus" -> "Failure";
"CheckStatus" -> "Failure";
"PostSlackMessage" -> "Success";
"PostSlackMessage" -> "Success";
"Success" -> "end";
"PostSlackMessage" -> "Failure";
"Failure" -> "end";
"Success" -> "end";
"Failure" -> "end";
        }`.replace(/\s+/g, ' ');

    const result = await Emit(JSON.parse(fixtures.kitchensink));

    assert.equal(result.replace(/\s+/g, ' '), expected);
});
