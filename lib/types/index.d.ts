/**
 * MCP server administration Remote: reads the live MCP client rows and
 * toggles them from the Web settings UI. A toggle applies immediately through
 * the Loader (connect on enable, disconnect on disable — no process restart)
 * and persists to the profile's cordis.patch.yml, so the state survives a
 * restart. The model-facing tool names stay `mcp__<serverName>__<tool>`.
 * @module dsh-plugin-mcp-toggle
 */
import { type Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { McpServerSnapshot } from './types.ts';
export type * from './types.ts';
/**
 * Remote-only service exposing the live MCP rows and the enable/disable
 * operation over the Web API gateway.
 */
export declare class MCPAdminGateway extends TypertRemoteService {
    static inject: string[];
    /** Serializes toggles: patch-file edits are atomic but must not interleave. */
    private pending;
    constructor(ctx: Context);
    /**
     * Read the Loader directly on every call: Entry.disabled is the effective
     * state and Entry.fiber the live lifecycle, both maintained by Cordis.
     * @returns every MCP client row in Loader order.
     */
    list(): McpServerSnapshot;
    /**
     * Enable or disable one MCP row: persist first (boot source of truth), then
     * apply live through the Loader, rolling the file back when the live apply
     * fails. Toggles are serialized per process.
     * @param entryId - the Loader entry id of an MCP row.
     * @param enabled - target state (true connects, false disconnects).
     * @returns the refreshed snapshot after the apply.
     */
    toggle(entryId: string, enabled: boolean): Promise<McpServerSnapshot>;
    private doToggle;
}
export default MCPAdminGateway;
