/** Dictionaries for the MCP Servers settings section. */

export const en = {
  nav: 'MCP Servers',
  intro: 'Enable or disable MCP servers. Changes apply immediately and survive a restart.',
  refresh: 'Refresh',
  loading: 'Loading servers…',
  empty: 'No MCP servers are configured in this profile.',
  statusDisabled: 'Disabled',
  statusEnabled: 'Connected',
  statusPending: 'Starting…',
  statusFailed: 'Failed to start',
  statusOff: 'Stopped',
  toggleEnable: 'Enable {serverName}',
  toggleDisable: 'Disable {serverName}',
  errorRead: 'Failed to read MCP servers: {message}',
  errorToggle: 'Failed to update {serverName}: {message}',
} as const

export const zh = {
  nav: 'MCP 服务器',
  intro: '启用或禁用 MCP 服务器。修改立即生效，并会在重启后保留。',
  refresh: '刷新',
  loading: '正在加载服务器…',
  empty: '此配置文件未配置 MCP 服务器。',
  statusDisabled: '已禁用',
  statusEnabled: '已连接',
  statusPending: '启动中…',
  statusFailed: '启动失败',
  statusOff: '已停止',
  toggleEnable: '启用 {serverName}',
  toggleDisable: '禁用 {serverName}',
  errorRead: '读取 MCP 服务器失败：{message}',
  errorToggle: '更新 {serverName} 失败：{message}',
} as const

export type McpServersLocaleKey = keyof typeof en