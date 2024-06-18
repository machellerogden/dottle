export const styles = {
    digraph: `
rankdir=TB;
ratio=fill;
splines=curved;
edge [arrowsize=0.75 color="#333333"];
node [shape=rect color="#aaaaaa" style="rounded"];
start [shape=circle fillcolor="#ffda75" style="filled"];
end [shape=circle fillcolor="#ffda75" style="filled"];
`.trim(),
    subgraph: `
color=grey;
style="rounded";
`.trim()
};

const emitDigraph = edges => [
    'digraph {',
    styles.digraph,
    ...edges.flat(),
    '}'
];

const emitSubgraph = (name, edges) => [
    `subgraph cluster_${name} {`,
    styles.subgraph,
    ...edges.flat(),
    '}'
];

const emitEdge = (a, b) => `"${a}" -> "${b}";`;

function edge(a, b) {
    return {
        type: 'edge',
        points: [a, b]
    };
}

function walk(States, StartAt, EndAt, visited = new Set()) {

    const current = States[StartAt];

    if (visited.has(current)) return [];

    if (current) {

        const commonEdges = [];

        if (current.Catch) {
            const clauses = current.Catch;
            for (const clause of clauses) {
                commonEdges.push(
                    edge(StartAt, clause.Next),
                    ...walk(States, clause.Next, EndAt, visited)
                );
            }
        }

        if (current.Type === 'Parallel' || current.Type === 'Map') {
            const branches = current.Type === 'Map'
                ? [current.ItemProcessor ?? current.Iterator]
                : current.Branches;

            const subgraph = branches.map((Branch, i) => ({
                type: 'branch',
                name: `${StartAt}_${i}`,
                edges: [
                    edge(StartAt, Branch.StartAt),
                    ...walk(Branch.States, Branch.StartAt, current.Next ?? EndAt, visited)
                ]
            }));

            return [
                ...subgraph,
                ...commonEdges,
                ...walk(States, current.Next, EndAt, visited)
            ];
        }

        if (current.Type === 'Choice') {
            const clauses = current.Choices ?? [];
            const body = current.Default
                ? [edge(StartAt, current.Default)]
                : [];

            return [
                ...clauses.map(clause => edge(StartAt, clause.Next)),
                ...commonEdges,
                ...body,
                ...clauses.flatMap(clause => walk(States, clause.Next, EndAt, visited))
            ];
        }

        if (current.Next) {
            return [
                edge(StartAt, current.Next),
                ...commonEdges,
                ...walk(States, current.Next, EndAt, visited)
            ];
        }

        if (current.End || current.Type === 'Succeed' || current.Type === 'Fail') {
            return [
                ...commonEdges,
                edge(StartAt, EndAt)
            ];
        }

    } else {
        return [];
    }
}

function emit(dot) {
    if (Array.isArray(dot)) return dot.map(emit);
    if (dot.type === 'edge') return emitEdge(...dot.points);
    if (dot.type === 'branch') return emitSubgraph(dot.name, dot.edges.map(emit));
}

export function Emit(machine, InitialStartAt = 'start', EndAt = 'end') {
    const { StartAt, States } = machine;
    const dots = [
        edge(InitialStartAt, StartAt),
        ...walk(States, StartAt, EndAt)
    ];
    return emitDigraph(emit(dots)).join('\n');
}

export async function* Emitter(it) {
    for await (const machine of it) yield Emit(machine);
}

export function toStream(it, batchSize = 1) {

    if (typeof it?.[Symbol.asyncIterator] !== 'function') {
        throw new TypeError('First argument must be an ES6 Async Iterator');
    }

    return new ReadableStream({
        async pull(controller) {
            try {
                let i = 0;
                while (i++ < batchSize) {
                    const { value, done } = await it.next(); if (done) {
                        controller.close();
                        return;
                    }
                    controller.enqueue(value);
                }
            } catch (error) {
                controller.error(error);
            }
        },
        cancel() {
            // Clean up the iterator if needed
            if (typeof it.return === 'function') {
                it.return();
            }
        }
    });
}

export function asWriteableStream(writable) {
    return new WritableStream({
        write(chunk) {
            return new Promise((resolve, reject) => {
                writable.write(chunk, (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
        },
        close() {
            writable.end();
        },
        abort(err) {
            writable.destroy(err);
        }
    });
}
