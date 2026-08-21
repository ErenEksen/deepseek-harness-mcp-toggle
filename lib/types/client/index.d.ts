/**
 * MCP Servers settings section, browser half: mounts the mcpAdmin Remote and
 * registers the settings section that lists and toggles the profile's MCP
 * servers.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type McpServersLocaleKey } from './locales.ts';
export type { McpServersSectionInjected, McpServersSectionProps } from './McpServersSection.tsx';
export type { McpServersLocaleKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** MCP server management copy. */
        'settings.mcpServers': McpServersLocaleKey;
    }
}
/** Dictionary namespace owned by this plugin. */
export declare const NS = "settings.mcpServers";
/** Required services (cordis fiber inject). */
export declare const inject: string[];
/**
 * Mount the MCP admin Remote and register the settings section.
 * @param ctx - the browser plugin context.
 * @returns disposer unmounting the Remote contribution (the locale and slot
 * registrations leave with the plugin fiber).
 */
export declare function apply(ctx: ClientContext): Promise<() => Promise<void>>;
