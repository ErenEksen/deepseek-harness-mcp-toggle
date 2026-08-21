import type { Context } from '@deepseek-ai/cordis';
/** Absolute path of the profile's own patch layer, derived from ctx.baseUrl. */
export declare function profilePatchPath(ctx: Context): string;
/**
 * Edit `content` so it carries one explicit `disabled` value for `id`,
 * preserving the document otherwise.
 * @param content - current file text.
 * @param id - patch row id.
 * @param disabled - the value the row should persist.
 * @returns the edited text, identical to `content` when nothing changed.
 */
export declare function editEntryDisabled(content: string, id: string, disabled: boolean): string;
/** Current text of a file, or undefined when it does not exist. */
export declare function readPatchFile(path: string): string | undefined;
/**
 * Atomically persist one `disabled` edit on the profile patch file.
 * @param path - patch file path.
 * @param id - patch row id.
 * @param disabled - value to persist.
 * @returns the previous file content (undefined when the file did not exist),
 * for callers that need to roll the edit back.
 */
export declare function writeEntryDisabled(path: string, id: string, disabled: boolean): string | undefined;
/** Restore a previous patch-file state after a failed live apply. */
export declare function restorePatchFile(path: string, previous: string | undefined): void;
