/** Dictionaries for the MCP Servers settings section. */
export declare const en: {
    readonly nav: "MCP Servers";
    readonly intro: "Enable or disable MCP servers. Changes apply immediately and survive a restart.";
    readonly refresh: "Refresh";
    readonly loading: "Loading servers…";
    readonly empty: "No MCP servers are configured in this profile.";
    readonly statusDisabled: "Disabled";
    readonly statusEnabled: "Connected";
    readonly statusPending: "Starting…";
    readonly statusFailed: "Failed to start";
    readonly statusOff: "Stopped";
    readonly toggleEnable: "Enable {serverName}";
    readonly toggleDisable: "Disable {serverName}";
    readonly errorRead: "Failed to read MCP servers: {message}";
    readonly errorToggle: "Failed to update {serverName}: {message}";
};
export declare const zh: {
    readonly nav: "MCP 服务器";
    readonly intro: "启用或禁用 MCP 服务器。修改立即生效，并会在重启后保留。";
    readonly refresh: "刷新";
    readonly loading: "正在加载服务器…";
    readonly empty: "此配置文件未配置 MCP 服务器。";
    readonly statusDisabled: "已禁用";
    readonly statusEnabled: "已连接";
    readonly statusPending: "启动中…";
    readonly statusFailed: "启动失败";
    readonly statusOff: "已停止";
    readonly toggleEnable: "启用 {serverName}";
    readonly toggleDisable: "禁用 {serverName}";
    readonly errorRead: "读取 MCP 服务器失败：{message}";
    readonly errorToggle: "更新 {serverName} 失败：{message}";
};
export type McpServersLocaleKey = keyof typeof en;
