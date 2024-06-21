export const styles = {
    digraph: `
rankdir=TB;
ratio=fill;
// splines=curved;
ranksep=0.5;
nodesep=0.5;
edge [arrowsize=0.75 color="#333333"];
node [shape=rect fillcolor="#f0f8ff" color="#6d879d" style="filled,rounded" margin="0.2,0.1" fontname="Helvetica" fontsize=11];
start [shape=circle fillcolor="#a9ffd2" style="filled" fontname="Helvetica" fontsize=10 margin="0,0"];
end [shape=circle fillcolor="#a9ffd2" style="filled" fontname="Helvetica" fontsize=10 margin="0,0"];
`.trim(),
    subgraph: `
color="#cd98c9";
fillcolor="#f9f0f8";
style="filled,rounded";
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

const emitEdge = ({ points: [a, b], label }) =>
    `"${a}" -> "${b}"${label ? ` [label="${label}" fontcolor="gray" fontsize=9 fontname="Helvetica"]` : ''};`;

function edge(a, b, label) {
    return {
        type: 'edge',
        points: [a, b],
        label
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
                    edge(StartAt, clause.Next, 'Catch'),
                    ...walk(States, clause.Next, EndAt, visited)
                );
            }
        }

        if (current.Type === 'Parallel' || current.Type === 'Map') {
            const branches = current.Type === 'Map'
                ? [current.ItemProcessor ?? current.Iterator]
                : current.Branches;

            const subgraph = branches.flatMap((Branch, i) => {
                const edges = walk(Branch.States, Branch.StartAt, current.Next ?? EndAt, visited);
                const enter = edge(StartAt, Branch.StartAt);
                const exit = edges.pop();
                return [
                    enter,
                    {
                        type: 'branch',
                        name: `${StartAt}_${i}`,
                        edges
                    },
                    exit
                ];
            });

            return [
                ...subgraph,
                ...walk(States, current.Next, EndAt, visited),
                ...commonEdges
            ];
        }

        if (current.Type === 'Choice') {
            const clauses = current.Choices ?? [];
            const body = current.Default
                ? [edge(StartAt, current.Default)]
                : [];

            return [
                ...clauses.map(clause => edge(StartAt, clause.Next)),
                ...body,
                ...clauses.flatMap(clause => walk(States, clause.Next, EndAt, visited)),
                ...commonEdges
            ];
        }

        if (current.Next) {
            return [
                edge(StartAt, current.Next),
                ...walk(States, current.Next, EndAt, visited),
                ...commonEdges
            ];
        }

        if (current.End || current.Type === 'Succeed' || current.Type === 'Fail') {
            return [
                edge(StartAt, EndAt),
                ...commonEdges
            ];
        }

    } else {
        return [];
    }
}

function emit(dot) {
    if (Array.isArray(dot)) return dot.map(emit);
    if (dot.type === 'edge') return emitEdge(dot);
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
