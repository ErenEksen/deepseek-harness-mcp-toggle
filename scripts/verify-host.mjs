// Host-side verification for dsh-plugin-mcp-toggle: boots the web profile
// composition (without the launcher's HMR watcher), drives the mcpAdmin
// service directly, and asserts toggle behavior end to end against a local
// streamable-http MCP test server.
// Usage: node scripts/verify-host.mjs <runtimeRoot> <dshHome>
import { createServer } from 'node:http'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const [runtimeRoot, dshHome] = process.argv.slice(2)
if (!runtimeRoot || !dshHome) {
  console.error('usage: node scripts/verify-host.mjs <runtimeRoot> <dshHome>')
  process.exit(2)
}
process.env.DSH_HOME = dshHome

const pkgUrl = (spec) => pathToFileURL(runtimeRoot + '/@deepseek-ai/' + spec + '/lib/index.js').href
const appBoot = await import(pkgUrl('dsh-app-boot'))
const cmdline = await import(pkgUrl('dsh-cmdline'))
const { boot, healProfilesModuleFallback, initProfile, loadProfile } = appBoot

// ── tiny streamable-http MCP server for connectivity assertions ────────────
const requests = []
const mcpServer = createServer((req, res) => {
  let body = ''
  req.on('data', (chunk) => { body += chunk })
  req.on('end', () => {
    let msg
    try { msg = JSON.parse(body || '{}') } catch { msg = {} }
    requests.push(String(msg.method ?? 'GET:' + req.method))
    const reply = (result) => {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Mcp-Session-Id': 'test-session' })
      res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id ?? null, result }))
    }
    if (msg.method === 'initialize') {
      reply({ protocolVersion: msg.params?.protocolVersion ?? '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'test-mcp', version: '1.0.0' } })
    } else if (msg.method === 'tools/list') {
      reply({ tools: [{ name: 'echo', description: 'echoes text', inputSchema: { type: 'object' } }] })
    } else if (msg.method === 'tools/call') {
      reply({ content: [{ type: 'text', text: 'echo-ok' }] })
    } else if (msg.id === undefined) {
      res.writeHead(202); res.end()
    } else {
      reply({})
    }
  })
})
await new Promise((resolve) => mcpServer.listen(0, '127.0.0.1', resolve))
const port = mcpServer.address().port

// ── profile setup ───────────────────────────────────────────────────────────
const anchor = runtimeRoot + '/@deepseek-ai/dsh/package.json'
healProfilesModuleFallback(anchor, dshHome)
const profileDir = dshHome + '/profiles/web'
mkdirSync(profileDir, { recursive: true })
initProfile(profileDir, ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'])

const PATCH = [
  '# sentinel comment that must survive toggles',
  '- insert:',
  '    - id: mcp-admin',
  '      name: dsh-plugin-mcp-toggle',
  '    - id: mcp-test-http',
  "      name: '@deepseek-ai/dsh-mcp-client'",
  '      disabled: true',
  '      config:',
  '        serverName: test-http',
  '        transport: streamable-http',
  '        url: http://127.0.0.1:' + port + '/mcp',
  '',
].join('\n') + '\n'
writeFileSync(profileDir + '/cordis.patch.yml', PATCH)

const profile = loadProfile('dsh', 'web', anchor, dshHome, { userLayer: true })
const rootConfig = profileDir + '/cordis.yml'
writeFileSync(rootConfig, '[]\n')
const patches = [
  ...profile.layers.flatMap((layer) => layer.patches),
  ...profile.patches,
]

// ── boot with the launcher's prepare-equivalent (cmdline args) ──────────────
const ctx = await boot('dsh', rootConfig, patches, (hostCtx) => {
  cmdline.provideCmdline(hostCtx, { args: ['--port', '3091', '--no-open'], exit: () => {} })
})
const mcpAdmin = ctx.get('mcpAdmin')
if (!mcpAdmin) throw new Error('mcpAdmin service not mounted')

const assert = (cond, label) => {
  if (!cond) { console.error('FAIL: ' + label); process.exitCode = 1; throw new Error(label) }
  console.log('ok: ' + label)
}

// ── assertions ──────────────────────────────────────────────────────────────
let snap = mcpAdmin.list()
const row = snap.entries.find((e) => e.entryId === 'mcp-test-http')
assert(row, 'list() reports the test MCP row')
assert(row.disabled === true, 'row starts disabled')
assert(row.serverName === 'test-http', 'serverName projected')
assert(row.transport === 'streamable-http', 'transport projected')
assert(row.url === 'http://127.0.0.1:' + port + '/mcp', 'url projected')

// enable → fiber activates and the MCP client connects
snap = await mcpAdmin.toggle('mcp-test-http', true)
assert(snap.entries.find((e) => e.entryId === 'mcp-test-http').disabled === false, 'toggle(true) disables the disabled flag')
await new Promise((r) => setTimeout(r, 1500))
assert(requests.includes('initialize') && requests.includes('tools/list'), 'MCP client connected and listed tools')
const live = [...ctx.get('loader').entries()].find((e) => e.options.id === 'mcp-test-http')
assert(live && live.fiber !== undefined && live.fiber.state === 2, 'entry fiber is ACTIVE after enable')

// patch file persisted the enabled state
const afterEnable = readFileSync(profileDir + '/cordis.patch.yml', 'utf8')
assert(afterEnable.includes('# sentinel comment that must survive toggles'), 'sentinel comment survives')
assert(afterEnable.includes('  disabled: false'), 'patch file persisted disabled: false')
assert(afterEnable.includes('    - id: mcp-admin'), 'plugin row untouched')

// disable → fiber disposed, connection closed
const before = requests.length
snap = await mcpAdmin.toggle('mcp-test-http', false)
assert(snap.entries.find((e) => e.entryId === 'mcp-test-http').disabled === true, 'toggle(false) re-disables the row')
await new Promise((r) => setTimeout(r, 800))
const dead = [...ctx.get('loader').entries()].find((e) => e.options.id === 'mcp-test-http')
assert(dead && dead.fiber === undefined, 'entry fiber disposed after disable')
assert(requests.length === before, 'no further MCP requests after disable')
const afterDisable = readFileSync(profileDir + '/cordis.patch.yml', 'utf8')
assert(afterDisable.includes('  disabled: true'), 'patch file persisted disabled: true')

// unknown id fails loudly
let threw = false
try { await mcpAdmin.toggle('mcp-does-not-exist', true) } catch { threw = true }
assert(threw, 'toggle of an unknown id throws')

// idempotent toggle of the same state is a no-op
const count = requests.length
await mcpAdmin.toggle('mcp-test-http', false)
await new Promise((r) => setTimeout(r, 500))
assert(requests.length === count, 'same-state toggle is a no-op')

mcpServer.close()
await ctx.fiber.dispose()
console.log('VERIFY-HOST: all assertions passed')