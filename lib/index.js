import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
//#region lib/types/patch-store.js
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
/** Absolute path of the profile's own patch layer, derived from ctx.baseUrl. */
function profilePatchPath(ctx) {
	if (ctx.baseUrl === void 0) throw new Error("mcpAdmin: cannot locate the profile patch file: ctx.baseUrl is unset");
	return join(fileURLToPath(ctx.baseUrl), "cordis.patch.yml");
}
/** Leading-space count of a line (YAML block indentation). */
function leadingSpaces(line) {
	return line.length - line.trimStart().length;
}
/** The id scalar of a `- id:` line (any indent), quotes stripped; undefined otherwise. */
function entryId(line) {
	const trimmed = line.trimStart();
	if (!trimmed.startsWith("- id:")) return void 0;
	const raw = trimmed.slice(5).trim();
	if (raw.length >= 2 && raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1);
	if (raw.length >= 2 && raw.startsWith("\"") && raw.endsWith("\"")) return raw.slice(1, -1);
	return raw;
}
/** The start line of the entry block defining `id`, any nesting depth. */
function findEntryStart(lines, id) {
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line === void 0) continue;
		if (entryId(line) !== id) continue;
		return i;
	}
}
/**
* End (exclusive) of the entry block starting at `start`: the next sibling
* entry line at the same indentation, or the first shallower non-comment
* line. Comment lines never end a block.
*/
function blockEnd(lines, start) {
	const startLine = lines[start];
	if (startLine === void 0) return start;
	const indent = leadingSpaces(startLine);
	for (let j = start + 1; j < lines.length; j++) {
		const line = lines[j];
		if (line === void 0 || line.trim() === "") continue;
		const lineIndent = leadingSpaces(line);
		if (lineIndent < indent) {
			if (line.trimStart().startsWith("#")) continue;
			return j;
		}
		if (lineIndent === indent && line[lineIndent] === "-") return j;
	}
	return lines.length;
}
/** Rewrite an entry block so it carries the requested disabled key. */
function applyDisabled(lines, start, end, disabled) {
	const result = [...lines];
	const startLine = lines[start];
	if (startLine === void 0) return result;
	const keyIndent = leadingSpaces(startLine) + 2;
	const disabledLine = " ".repeat(keyIndent) + "disabled: " + String(disabled);
	const prefix = " ".repeat(keyIndent) + "disabled:";
	let replaced = false;
	for (let i = start + 1; i < end; i++) {
		const line = result[i];
		if (line !== void 0 && line.startsWith(prefix)) {
			result[i] = disabledLine;
			replaced = true;
		}
	}
	if (!replaced) result.splice(start + 1, 0, disabledLine);
	return result;
}
/**
* Append a top-level id-targeted override row. Used when the id is defined by
* an earlier patch layer (bundle or home), where an override row is the only
* valid patch form — inserting a second definition would duplicate the entry.
*/
function appendRow(lines, id, disabled) {
	const result = [...lines];
	if (result.length > 0 && result[result.length - 1] !== "") result.push("");
	result.push("- id: " + id, "  disabled: " + String(disabled));
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
function editEntryDisabled(content, id, disabled) {
	const trailing = content.endsWith("\n");
	const lines = content.split("\n");
	if (trailing && lines[lines.length - 1] === "") lines.pop();
	const start = findEntryStart(lines, id);
	let edited;
	if (start !== void 0) edited = applyDisabled(lines, start, blockEnd(lines, start), disabled);
	else edited = appendRow(lines, id, disabled);
	return edited.join("\n") + (trailing ? "\n" : "");
}
/** Current text of a file, or undefined when it does not exist. */
function readPatchFile(path) {
	try {
		return readFileSync(path, "utf8");
	} catch (error) {
		if (error?.code === "ENOENT") return void 0;
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
function writeEntryDisabled(path, id, disabled) {
	const previous = readPatchFile(path);
	const base = previous ?? "# MCP server rows managed by dsh-plugin-mcp-toggle.\n";
	const next = editEntryDisabled(base, id, disabled);
	if (next === base) return previous;
	const tmp = path + ".tmp-" + String(process.pid);
	writeFileSync(tmp, next);
	renameSync(tmp, path);
	return previous;
}
/** Restore a previous patch-file state after a failed live apply. */
function restorePatchFile(path, previous) {
	if (previous === void 0) {
		rmSync(path, { force: true });
		return;
	}
	const tmp = path + ".tmp-" + String(process.pid);
	writeFileSync(tmp, previous);
	renameSync(tmp, path);
}
//#endregion
//#region lib/types/index.js
/**
* MCP server administration Remote: reads the live MCP client rows and
* toggles them from the Web settings UI. A toggle applies immediately through
* the Loader (connect on enable, disconnect on disable — no process restart)
* and persists to the profile's cordis.patch.yml, so the state survives a
* restart. The model-facing tool names stay `mcp__<serverName>__<tool>`.
* @module dsh-plugin-mcp-toggle
*/
var __runInitializers = function(thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
	function accept(f) {
		if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
		return f;
	}
	var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
	var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
	var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
	var _, done = false;
	for (var i = decorators.length - 1; i >= 0; i--) {
		var context = {};
		for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
		for (var p in contextIn.access) context.access[p] = contextIn.access[p];
		context.addInitializer = function(f) {
			if (done) throw new TypeError("Cannot add initializers after decoration has completed");
			extraInitializers.push(accept(f || null));
		};
		var result = (0, decorators[i])(kind === "accessor" ? {
			get: descriptor.get,
			set: descriptor.set
		} : descriptor[key], context);
		if (kind === "accessor") {
			if (result === void 0) continue;
			if (result === null || typeof result !== "object") throw new TypeError("Object expected");
			if (_ = accept(result.get)) descriptor.get = _;
			if (_ = accept(result.set)) descriptor.set = _;
			if (_ = accept(result.init)) initializers.unshift(_);
		} else if (_ = accept(result)) {
			if (kind === "field") initializers.unshift(_);
			else descriptor[key] = _;
		}
	}
	if (target) Object.defineProperty(target, contextIn.name, descriptor);
	done = true;
};
/** Runtime mirror: FiberState is a cross-package const enum. */
const FIBER_STATE = {
	PENDING: 0,
	LOADING: 1,
	ACTIVE: 2,
	FAILED: 3,
	DISPOSED: 4,
	UNLOADING: 5
};
/** Complete public projection of Cordis Fiber states. */
const FIBER_PHASE = {
	[FIBER_STATE.PENDING]: "pending",
	[FIBER_STATE.LOADING]: "loading",
	[FIBER_STATE.ACTIVE]: "active",
	[FIBER_STATE.FAILED]: "failed",
	[FIBER_STATE.DISPOSED]: null,
	[FIBER_STATE.UNLOADING]: "unloading"
};
/** The MCP client plugin row name every dsh profile mounts. */
const MCP_CLIENT_PLUGIN = "@deepseek-ai/dsh-mcp-client";
/**
* Remote-only service exposing the live MCP rows and the enable/disable
* operation over the Web API gateway.
*/
let MCPAdminGateway = (() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _list_decorators;
	let _toggle_decorators;
	return class MCPAdminGateway extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_list_decorators = [Remote("list")];
			_toggle_decorators = [Remote("toggle")];
			__esDecorate(this, null, _list_decorators, {
				kind: "method",
				name: "list",
				static: false,
				private: false,
				access: {
					has: (obj) => "list" in obj,
					get: (obj) => obj.list
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _toggle_decorators, {
				kind: "method",
				name: "toggle",
				static: false,
				private: false,
				access: {
					has: (obj) => "toggle" in obj,
					get: (obj) => obj.toggle
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		static inject = ["loader"];
		/** Serializes toggles: patch-file edits are atomic but must not interleave. */
		pending = (__runInitializers(this, _instanceExtraInitializers), Promise.resolve());
		constructor(ctx) {
			super(ctx, "mcpAdmin");
		}
		/**
		* Read the Loader directly on every call: Entry.disabled is the effective
		* state and Entry.fiber the live lifecycle, both maintained by Cordis.
		* @returns every MCP client row in Loader order.
		*/
		list() {
			const entries = [];
			for (const entry of this.ctx.loader.entries()) {
				if (entry.options.name !== MCP_CLIENT_PLUGIN) continue;
				const config = entry.options.config ?? {};
				entries.push({
					entryId: entry.options.id,
					serverName: typeof config.serverName === "string" ? config.serverName : entry.options.id,
					transport: typeof config.transport === "string" ? config.transport : "",
					disabled: entry.disabled,
					fiberPhase: entry.fiber === void 0 ? null : FIBER_PHASE[entry.fiber.state],
					...typeof config.command === "string" ? { command: config.command } : {},
					...typeof config.url === "string" ? { url: config.url } : {}
				});
			}
			return { entries };
		}
		/**
		* Enable or disable one MCP row: persist first (boot source of truth), then
		* apply live through the Loader, rolling the file back when the live apply
		* fails. Toggles are serialized per process.
		* @param entryId - the Loader entry id of an MCP row.
		* @param enabled - target state (true connects, false disconnects).
		* @returns the refreshed snapshot after the apply.
		*/
		toggle(entryId, enabled) {
			const run = this.pending.then(() => this.doToggle(entryId, enabled));
			this.pending = run.catch(() => {});
			return run;
		}
		async doToggle(entryId, enabled) {
			const entry = [...this.ctx.loader.entries()].find((candidate) => candidate.options.id === entryId && candidate.options.name === MCP_CLIENT_PLUGIN);
			if (entry === void 0) throw new Error(`mcpAdmin: no MCP server entry with id "${entryId}"`);
			if (entry.disabled === !enabled) return this.list();
			const patchPath = profilePatchPath(this.ctx);
			const previous = writeEntryDisabled(patchPath, entryId, !enabled);
			try {
				await this.ctx.loader.update(entry.id, { disabled: !enabled });
			} catch (error) {
				try {
					restorePatchFile(patchPath, previous);
				} catch (rollbackError) {
					throw new AggregateError([error, rollbackError], `mcpAdmin: toggle "${entryId}" failed and the patch file could not be restored`);
				}
				throw error;
			}
			return this.list();
		}
	};
})();
//#endregion
export { MCPAdminGateway, MCPAdminGateway as default };
