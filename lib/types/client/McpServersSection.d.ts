/**
 * MCP Servers settings section: one row per live MCP server with an enable
 * switch, a status line, and a refresh control. All data arrives through the
 * injected callbacks; every mutation goes back to the Host Remote.
 */
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { McpServerSnapshot } from '../types.ts';
/** Registration-side business face for the MCP Servers section. */
export interface McpServersSectionInjected {
    /** Read the live MCP rows from the Host. */
    list: () => Promise<McpServerSnapshot>;
    /** Enable or disable one server; resolves with the refreshed snapshot. */
    setEnabled: (entryId: string, enabled: boolean) => Promise<McpServerSnapshot>;
}
/** Full component props. */
export type McpServersSectionProps = PropsRuntime<'settings.section'> & PropsLocale<'settings.mcpServers'> & InjectFace<McpServersSectionInjected>;
/**
 * Render the MCP Servers settings section.
 * @param props - composed slot props.
 * @returns the section element tree.
 */
export declare function McpServersSection({ list, setEnabled, t }: McpServersSectionProps): import("react").JSX.Element;
