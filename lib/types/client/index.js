/**
 * MCP Servers settings section, browser half: mounts the mcpAdmin Remote and
 * registers the settings section that lists and toggles the profile's MCP
 * servers.
 */
import { TYPERT_REMOTE } from "../remote.js";
import { McpServersSection } from "./McpServersSection.js";
import { en, zh } from "./locales.js";
/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.mcpServers';
/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'remote'];
/**
 * Mount the MCP admin Remote and register the settings section.
 * @param ctx - the browser plugin context.
 * @returns disposer unmounting the Remote contribution (the locale and slot
 * registrations leave with the plugin fiber).
 */
export async function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-plugin-mcp-toggle: dictionaries');
    const unmount = await ctx.remote.$mount(TYPERT_REMOTE);
    const t = ctx.locale.bind(NS);
    const getAdmin = () => {
        const admin = ctx.get('remote.mcpAdmin');
        if (!admin)
            throw new Error('remote.mcpAdmin service is not active');
        return admin;
    };
    const remoteResult = async (result) => {
        if (!result.ok) {
            throw new Error(`mcpAdmin failed: ${result.error.code}: ${result.error.message}`);
        }
        return result.value;
    };
    const injected = () => ({
        list: async () => remoteResult(await getAdmin().list()),
        setEnabled: async (entryId, enabled) => remoteResult(await getAdmin().toggle(entryId, enabled)),
    });
    ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'mcp-servers',
        order: 30,
        label: () => t('nav'),
        locale: NS,
        inject: injected,
    }, McpServersSection));
    return unmount;
}
//# sourceMappingURL=index.js.map