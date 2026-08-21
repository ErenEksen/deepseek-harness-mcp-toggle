/**
 * Profile patch-file persistence for MCP row toggles: surgical text edits on
 * the profile's cordis.patch.yml that keep every other byte (comments,
 * !!js expressions, formatting) untouched. The Loader applies the file at
 * boot; this package writes explicit `disabled: true|false` values so the
 * toggled state survives restarts.
 *
 * Entry rows the profile owns live either at the top level (an id-targeted
 * override of a row an earlier layer defined) or nested inside an
 * `- insert:` block (a new row this profile defines). Both forms are edited
 * in place; a row defined only by an earlier layer gets a new top-level
 * `- id: <id>` + `disabled` override row appended at the end.
 */
import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
/** Absolute path of the profile's own patch layer, derived from ctx.baseUrl. */
export function profilePatchPath(ctx) {
    if (ctx.baseUrl === undefined) {
        throw new Error('mcpAdmin: cannot locate the profile patch file: ctx.baseUrl is unset');
    }
    return join(fileURLToPath(ctx.baseUrl), 'cordis.patch.yml');
}
/** Leading-space count of a line (YAML block indentation). */
function leadingSpaces(line) {
    return line.length - line.trimStart().length;
}
/** The id scalar of a `- id:` line (any indent), quotes stripped; undefined otherwise. */
function entryId(line) {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith('- id:'))
        return undefined;
    const raw = trimmed.slice('- id:'.length).trim();
    if (raw.length >= 2 && raw.startsWith("'") && raw.endsWith("'"))
        return raw.slice(1, -1);
    if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"'))
        return raw.slice(1, -1);
    return raw;
}
/** The start line of the entry block defining `id`, any nesting depth. */
function findEntryStart(lines, id) {
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line === undefined)
            continue;
        if (entryId(line) !== id)
            continue;
        return i;
    }
    return undefined;
}
/**
 * End (exclusive) of the entry block starting at `start`: the next sibling
 * entry line at the same indentation, or the first shallower non-comment
 * line. Comment lines never end a block.
 */
function blockEnd(lines, start) {
    const startLine = lines[start];
    if (startLine === undefined)
        return start;
    const indent = leadingSpaces(startLine);
    for (let j = start + 1; j < lines.length; j++) {
        const line = lines[j];
        if (line === undefined || line.trim() === '')
            continue;
        const lineIndent = leadingSpaces(line);
        if (lineIndent < indent) {
            if (line.trimStart().startsWith('#'))
                continue;
            return j;
        }
        if (lineIndent === indent && line[lineIndent] === '-')
            return j;
    }
    return lines.length;
}
/** Rewrite an entry block so it carries the requested disabled key. */
function applyDisabled(lines, start, end, disabled) {
    const result = [...lines];
    const startLine = lines[start];
    if (startLine === undefined)
        return result;
    const keyIndent = leadingSpaces(startLine) + 2;
    const disabledLine = ' '.repeat(keyIndent) + 'disabled: ' + String(disabled);
    const prefix = ' '.repeat(keyIndent) + 'disabled:';
    let replaced = false;
    for (let i = start + 1; i < end; i++) {
        const line = result[i];
        if (line !== undefined && line.startsWith(prefix)) {
            result[i] = disabledLine;
            replaced = true;
        }
    }
    if (!replaced) {
        // Insert directly under the `- id:` line, before the entry's other keys.
        result.splice(start + 1, 0, disabledLine);
    }
    return result;
}
/**
 * Append a top-level id-targeted override row. Used when the id is defined by
 * an earlier patch layer (bundle or home), where an override row is the only
 * valid patch form — inserting a second definition would duplicate the entry.
 */
function appendRow(lines, id, disabled) {
    const result = [...lines];
    if (result.length > 0 && result[result.length - 1] !== '')
        result.push('');
    result.push('- id: ' + id, '  disabled: ' + String(disabled));
    return result;
}
/**
 * Edit `content` so it carries one explicit `disabled` value for `id`,
 * preserving the document otherwise.
 * @param content - current file text.
 * @param id - patch row id.
 * @param disabled - the value the row should persist.
 * @returns the edited text, identical to `content` when nothing changed.
 */
export function editEntryDisabled(content, id, disabled) {
    const trailing = content.endsWith('\n');
    const lines = content.split('\n');
    if (trailing && lines[lines.length - 1] === '')
        lines.pop();
    const start = findEntryStart(lines, id);
    let edited;
    if (start !== undefined) {
        edited = applyDisabled(lines, start, blockEnd(lines, start), disabled);
    }
    else {
        edited = appendRow(lines, id, disabled);
    }
    return edited.join('\n') + (trailing ? '\n' : '');
}
/** Current text of a file, or undefined when it does not exist. */
export function readPatchFile(path) {
    try {
        return readFileSync(path, 'utf8');
    }
    catch (error) {
        if (error?.code === 'ENOENT')
            return undefined;
        throw error;
    }
}
/**
 * Atomically persist one `disabled` edit on the profile patch file.
 * @param path - patch file path.
 * @param id - patch row id.
 * @param disabled - value to persist.
 * @returns the previous file content (undefined when the file did not exist),
 * for callers that need to roll the edit back.
 */
export function writeEntryDisabled(path, id, disabled) {
    const previous = readPatchFile(path);
    const base = previous ?? '# MCP server rows managed by dsh-plugin-mcp-toggle.\n';
    const next = editEntryDisabled(base, id, disabled);
    if (next === base)
        return previous;
    const tmp = path + '.tmp-' + String(process.pid);
    writeFileSync(tmp, next);
    renameSync(tmp, path);
    return previous;
}
/** Restore a previous patch-file state after a failed live apply. */
export function restorePatchFile(path, previous) {
    if (previous === undefined) {
        // The file did not exist before the edit: this package created it, so
        // rolling back removes it again.
        rmSync(path, { force: true });
        return;
    }
    const tmp = path + '.tmp-' + String(process.pid);
    writeFileSync(tmp, previous);
    renameSync(tmp, path);
}
//# sourceMappingURL=patch-store.js.map