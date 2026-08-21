/**
 * MCP server administration Remote: reads the live MCP client rows and
 * toggles them from the Web settings UI. A toggle applies immediately through
 * the Loader (connect on enable, disconnect on disable — no process restart)
 * and persists to the profile's cordis.patch.yml, so the state survives a
 * restart. The model-facing tool names stay `mcp__<serverName>__<tool>`.
 * @module dsh-plugin-mcp-toggle
 */

import { FiberState, type Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { profilePatchPath, restorePatchFile, writeEntryDisabled } from './patch-store.ts'
import type { McpServerEntry, McpServerSnapshot } from './types.ts'

export type * from './types.ts'

/** Runtime mirror: FiberState is a cross-package const enum. */
const FIBER_STATE = {
  PENDING: 0 as FiberState.PENDING,
  LOADING: 1 as FiberState.LOADING,
  ACTIVE: 2 as FiberState.ACTIVE,
  FAILED: 3 as FiberState.FAILED,
  DISPOSED: 4 as FiberState.DISPOSED,
  UNLOADING: 5 as FiberState.UNLOADING,
} as const

/** Complete public projection of Cordis Fiber states. */
const FIBER_PHASE = {
  [FIBER_STATE.PENDING]: 'pending',
  [FIBER_STATE.LOADING]: 'loading',
  [FIBER_STATE.ACTIVE]: 'active',
  [FIBER_STATE.FAILED]: 'failed',
  [FIBER_STATE.DISPOSED]: null,
  [FIBER_STATE.UNLOADING]: 'unloading',
} as const satisfies Record<FiberState, McpServerEntry['fiberPhase']>

/** The MCP client plugin row name every dsh profile mounts. */
const MCP_CLIENT_PLUGIN = '@deepseek-ai/dsh-mcp-client'

/**
 * Remote-only service exposing the live MCP rows and the enable/disable
 * operation over the Web API gateway.
 */
export class MCPAdminGateway extends TypertRemoteService {
  static inject = ['loader']

  /** Serializes toggles: patch-file edits are atomic but must not interleave. */
  private pending: Promise<unknown> = Promise.resolve()

  constructor(ctx: Context) {
    super(ctx, 'mcpAdmin')
  }

  /**
   * Read the Loader directly on every call: Entry.disabled is the effective
   * state and Entry.fiber the live lifecycle, both maintained by Cordis.
   * @returns every MCP client row in Loader order.
   */
  @Remote('list')
  list(): McpServerSnapshot {
    const entries: McpServerEntry[] = []
    for (const entry of this.ctx.loader.entries()) {
      if (entry.options.name !== MCP_CLIENT_PLUGIN) continue
      const config = entry.options.config ?? {}
      entries.push({
        // The raw row id as written in the patch file (no include/group prefix).
        entryId: entry.options.id,
        serverName: typeof config.serverName === 'string' ? config.serverName : entry.options.id,
        transport: typeof config.transport === 'string' ? config.transport : '',
        disabled: entry.disabled,
        fiberPhase: entry.fiber === undefined ? null : FIBER_PHASE[entry.fiber.state],
        ...(typeof config.command === 'string' ? { command: config.command } : {}),
        ...(typeof config.url === 'string' ? { url: config.url } : {}),
      })
    }
    return { entries }
  }

  /**
   * Enable or disable one MCP row: persist first (boot source of truth), then
   * apply live through the Loader, rolling the file back when the live apply
   * fails. Toggles are serialized per process.
   * @param entryId - the Loader entry id of an MCP row.
   * @param enabled - target state (true connects, false disconnects).
   * @returns the refreshed snapshot after the apply.
   */
  @Remote('toggle')
  toggle(entryId: string, enabled: boolean): Promise<McpServerSnapshot> {
    const run = this.pending.then(() => this.doToggle(entryId, enabled))
    this.pending = run.catch(() => {})
    return run
  }

  private async doToggle(entryId: string, enabled: boolean): Promise<McpServerSnapshot> {
    const entry = [...this.ctx.loader.entries()].find(candidate =>
      candidate.options.id === entryId && candidate.options.name === MCP_CLIENT_PLUGIN)
    if (entry === undefined) {
      throw new Error(`mcpAdmin: no MCP server entry with id "${entryId}"`)
    }
    if (entry.disabled === !enabled) return this.list()

    const patchPath = profilePatchPath(this.ctx)
    const previous = writeEntryDisabled(patchPath, entryId, !enabled)
    try {
      // entry.id carries the tree prefix (include:<row>); the Loader resolves
      // the full path while the patch file keeps the raw row id.
      await this.ctx.loader.update(entry.id, { disabled: !enabled })
    } catch (error) {
      try {
        restorePatchFile(patchPath, previous)
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], `mcpAdmin: toggle "${entryId}" failed and the patch file could not be restored`)
      }
      throw error
    }
    return this.list()
  }
}

export default MCPAdminGateway