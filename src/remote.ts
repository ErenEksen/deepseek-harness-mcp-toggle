/**
 * Typert Remote contribution for the mcpAdmin namespace, hand-written in the
 * shape @deepseek-ai/dsh-typert-generator emits for a Host service with
 * @Remote-decorated methods. The Client mounts it through ctx.remote.$mount;
 * the zod schemas validate every wire argument and result on the way.
 */
import { z } from 'zod'
import type { TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { McpServerSnapshot } from './types.ts'

const entryId$schema = z.string()
const enabled$schema = z.boolean()

const McpServerEntry$schema = z.object({
  'entryId': z.string().readonly(),
  'serverName': z.string().readonly(),
  'transport': z.string().readonly(),
  'disabled': z.boolean().readonly(),
  'fiberPhase': z.union([
    z.literal(null), z.literal('failed'), z.literal('pending'),
    z.literal('active'), z.literal('loading'), z.literal('unloading'),
  ]).readonly(),
  'command': z.string().readonly().optional(),
  'url': z.string().readonly().optional(),
})

const McpServerSnapshot$schema = z.object({
  'entries': z.array(McpServerEntry$schema).readonly(),
})

export const TYPERT_REMOTE: TypertRemoteContribution = {
  package: 'dsh-plugin-mcp-toggle',
  descriptors: [
    {
      id: 'dsh-plugin-mcp-toggle#mcpAdmin/list',
      service: 'mcpAdmin',
      namespace: 'mcpAdmin',
      method: 'list',
      invocation: { kind: 'direct' },
      parameters: [],
      result: {
        mode: 'strict',
        typeSymbol: 'dsh-plugin-mcp-toggle/types#McpServerSnapshot',
        schema: McpServerSnapshot$schema,
      },
      sourceLocation: { file: 'src/index.ts', line: 0, column: 0 },
    },
    {
      id: 'dsh-plugin-mcp-toggle#mcpAdmin/toggle',
      service: 'mcpAdmin',
      namespace: 'mcpAdmin',
      method: 'toggle',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'entryId',
          wire: 'entryId',
          source: 'json',
          codec: { mode: 'strict', typeSymbol: 'string', schema: entryId$schema },
        },
        {
          name: 'enabled',
          wire: 'enabled',
          source: 'json',
          codec: { mode: 'strict', typeSymbol: 'boolean', schema: enabled$schema },
        },
      ],
      result: {
        mode: 'strict',
        typeSymbol: 'dsh-plugin-mcp-toggle/types#McpServerSnapshot',
        schema: McpServerSnapshot$schema,
      },
      sourceLocation: { file: 'src/index.ts', line: 0, column: 0 },
    },
  ],
}

export default TYPERT_REMOTE

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespace$6d637041646d696e {
    list: () => Promise<{ ok: true; value: McpServerSnapshot } | {
      ok: false
      error: { code: string; message: string; details: object }
    }>
    toggle: (entryId: string, enabled: boolean) => Promise<{ ok: true; value: McpServerSnapshot } | {
      ok: false
      error: { code: string; message: string; details: object }
    }>
  }
  interface TypertRemoteMap {
    'mcpAdmin/list': TypertRemoteNamespace$6d637041646d696e['list']
    'mcpAdmin/toggle': TypertRemoteNamespace$6d637041646d696e['toggle']
  }
  interface TypertRemoteNamespaceMap {
    'mcpAdmin': TypertRemoteNamespace$6d637041646d696e
  }
}
