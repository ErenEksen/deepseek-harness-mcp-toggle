/**
 * MCP server administration Remote: reads the live MCP client rows and
 * toggles them from the Web settings UI. A toggle applies immediately through
 * the Loader (connect on enable, disconnect on disable — no process restart)
 * and persists to the profile's cordis.patch.yml, so the state survives a
 * restart. The model-facing tool names stay `mcp__<serverName>__<tool>`.
 * @module dsh-plugin-mcp-toggle
 */
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { profilePatchPath, restorePatchFile, writeEntryDisabled } from "./patch-store.js";
/** Runtime mirror: FiberState is a cross-package const enum. */
const FIBER_STATE = {
    PENDING: 0,
    LOADING: 1,
    ACTIVE: 2,
    FAILED: 3,
    DISPOSED: 4,
    UNLOADING: 5,
};
/** Complete public projection of Cordis Fiber states. */
const FIBER_PHASE = {
    [FIBER_STATE.PENDING]: 'pending',
    [FIBER_STATE.LOADING]: 'loading',
    [FIBER_STATE.ACTIVE]: 'active',
    [FIBER_STATE.FAILED]: 'failed',
    [FIBER_STATE.DISPOSED]: null,
    [FIBER_STATE.UNLOADING]: 'unloading',
};
/** The MCP client plugin row name every dsh profile mounts. */
const MCP_CLIENT_PLUGIN = '@deepseek-ai/dsh-mcp-client';
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
            _list_decorators = [Remote('list')];
            _toggle_decorators = [Remote('toggle')];
            __esDecorate(this, null, _list_decorators, { kind: "method", name: "list", static: false, private: false, access: { has: obj => "list" in obj, get: obj => obj.list }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _toggle_decorators, { kind: "method", name: "toggle", static: false, private: false, access: { has: obj => "toggle" in obj, get: obj => obj.toggle }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        static inject = ['loader'];
        /** Serializes toggles: patch-file edits are atomic but must not interleave. */
        pending = (__runInitializers(this, _instanceExtraInitializers), Promise.resolve());
        constructor(ctx) {
            super(ctx, 'mcpAdmin');
        }
        /**
         * Read the Loader directly on every call: Entry.disabled is the effective
         * state and Entry.fiber the live lifecycle, both maintained by Cordis.
         * @returns every MCP client row in Loader order.
         */
        list() {
            const entries = [];
            for (const entry of this.ctx.loader.entries()) {
                if (entry.options.name !== MCP_CLIENT_PLUGIN)
                    continue;
                const config = entry.options.config ?? {};
                entries.push({
                    // The raw row id as written in the patch file (no include/group prefix).
                    entryId: entry.options.id,
                    serverName: typeof config.serverName === 'string' ? config.serverName : entry.options.id,
                    transport: typeof config.transport === 'string' ? config.transport : '',
                    disabled: entry.disabled,
                    fiberPhase: entry.fiber === undefined ? null : FIBER_PHASE[entry.fiber.state],
                    ...(typeof config.command === 'string' ? { command: config.command } : {}),
                    ...(typeof config.url === 'string' ? { url: config.url } : {}),
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
            this.pending = run.catch(() => { });
            return run;
        }
        async doToggle(entryId, enabled) {
            const entry = [...this.ctx.loader.entries()].find(candidate => candidate.options.id === entryId && candidate.options.name === MCP_CLIENT_PLUGIN);
            if (entry === undefined) {
                throw new Error(`mcpAdmin: no MCP server entry with id "${entryId}"`);
            }
            if (entry.disabled === !enabled)
                return this.list();
            const patchPath = profilePatchPath(this.ctx);
            const previous = writeEntryDisabled(patchPath, entryId, !enabled);
            try {
                // entry.id carries the tree prefix (include:<row>); the Loader resolves
                // the full path while the patch file keeps the raw row id.
                await this.ctx.loader.update(entry.id, { disabled: !enabled });
            }
            catch (error) {
                try {
                    restorePatchFile(patchPath, previous);
                }
                catch (rollbackError) {
                    throw new AggregateError([error, rollbackError], `mcpAdmin: toggle "${entryId}" failed and the patch file could not be restored`);
                }
                throw error;
            }
            return this.list();
        }
    };
})();
export { MCPAdminGateway };
export default MCPAdminGateway;
//# sourceMappingURL=index.js.map