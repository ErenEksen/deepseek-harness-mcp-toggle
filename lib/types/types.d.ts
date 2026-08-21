/** Wire vocabulary for the mcpAdmin Remote (Host list/toggle → Client settings UI). */
/** One MCP server row from the live Loader tree. */
export interface McpServerEntry {
    /** Loader entry id — the cordis patch row id, e.g. `mcp-exa`. */
    entryId: string;
    /** Model-facing namespace: tools arrive as `mcp__<serverName>__<tool>`. */
    serverName: string;
    /** `stdio` or `streamable-http`, as configured on the row. */
    transport: string;
    /** Effective disabled state: the row does not start (or stays stopped) while true. */
    disabled: boolean;
    /** Root fiber phase, or null when the row has no live fiber. */
    fiberPhase: 'pending' | 'loading' | 'active' | 'failed' | 'unloading' | null;
    /** Spawned command line, when transport is stdio. */
    command?: string;
    /** Endpoint URL, when transport is streamable-http. */
    url?: string;
}
/** Complete answer of {@link mcpAdminList}. */
export interface McpServerSnapshot {
    /** Live MCP rows in Loader order. */
    entries: McpServerEntry[];
}
