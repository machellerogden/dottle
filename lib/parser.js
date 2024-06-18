export const Parse = JSON.parse;

export async function* Parser(it) {

    let incoming = '';
    let depth = 0;
    let quoted = false;

    for await (const chunk of it) {
        const str = chunk.toString();
        const chars = str.split('');

        for (let i = 0; i < chars.length; i++) {
            incoming += chars[i];
            if (chars[i - 1] == '\\' && chars[i] == '"') continue;
            if (chars[i] == '"') {
                quoted = !quoted;
                continue;
            }
            if (quoted) continue;
            if (['{','['].includes(chars[i])) {
                depth++;
                continue;
            }
            if (['}',']'].includes(chars[i])) {
                depth--;
                continue;
            }
            if (depth == 0 && !quoted) {
                yield Parse(incoming);
                incoming = '';
            }
        }
    }
}
