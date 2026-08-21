/**
 * MCP Servers settings section, browser half: mounts the mcpAdmin Remote and
 * registers the settings section that lists and toggles the profile's MCP
 * servers.
 */

// Type-only: pulls the ctx.remote merge (generated namespace face) into this program.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: pulls the settings shell's SlotMap merge (the 'settings.section' entry).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { TypertClientRemote } from '@deepseek-ai/dsh-typert-protocol'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { TYPERT_REMOTE } from '../remote.ts'
import type { McpServerSnapshot } from '../types.ts'
import { McpServersSection, type McpServersSectionInjected } from './McpServersSection.tsx'
import { en, zh, type McpServersLocaleKey } from './locales.ts'

export type { McpServersSectionInjected, McpServersSectionProps } from './McpServersSection.tsx'
export type { McpServersLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** MCP server management copy. */
    'settings.mcpServers': McpServersLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.mcpServers'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'remote']

/**
 * Mount the MCP admin Remote and register the settings section.
 * @param ctx - the browser plugin context.
 * @returns disposer unmounting the Remote contribution (the locale and slot
 * registrations leave with the plugin fiber).
 */
export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-plugin-mcp-toggle: dictionaries')
  const unmount = await ctx.remote.$mount(TYPERT_REMOTE)

  const t = ctx.locale.bind(NS)
  const getAdmin = () => {
    const admin = ctx.get('remote.mcpAdmin') as any
    if (!admin) throw new Error('remote.mcpAdmin service is not active')
    return admin
  }
  const remoteResult = async (result: any): Promise<McpServerSnapshot> => {
    if (!result.ok) {
      throw new Error(`mcpAdmin failed: ${result.error.code}: ${result.error.message}`)
    }
    return result.value
  }
  const injected = (): McpServersSectionInjected => ({
    list: async () => remoteResult(await getAdmin().list()),
    setEnabled: async (entryId, enabled) => remoteResult(await getAdmin().toggle(entryId, enabled)),
  })

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'mcp-servers',
    order: 30,
    label: () => t('nav'),
    locale: NS,
    inject: injected,
  }, McpServersSection))

  return unmount
}