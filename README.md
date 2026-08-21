# deepseek-harness-mcp-toggle (`dsh-plugin-mcp-toggle`)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DSH-v0.1.0--rc.8-purple)](https://github.com/deepseek-ai/deepseek-harness)

A dual-face plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) that adds an **MCP Servers** management section to the Web settings UI, allowing you to enable or disable MCP servers on the fly without manual configuration edits or restarting the server.

---

## Features

- **Live Toggling**: Enable or disable MCP servers instantly from the UI without restarting `dsh web`. Active client fibers are connected/disconnected in place.
- **Persistent State**: Toggles are surgically saved directly to your profile's `cordis.patch.yml` (under `disabled: true|false`), surviving process restarts while preserving all comments, ordering, and `!!js` expressions.
- **Clean UI**: Integrated directly into DSH Settings (`Settings → MCP Servers`) with server name tags, transport badges, endpoint details, live connection status indicators, and a manual refresh trigger.
- **Multi-Transport Support**: Works seamlessly with `stdio` (e.g. `uvx`, `npx`, Python virtualenvs) and `streamable-http` / SSE endpoints.

---

## Installation

### Method 1: Local Linking (Recommended for local dev)

1. Clone the repository and build:
   ```bash
   git clone https://github.com/ErenEksen/deepseek-harness-mcp-toggle.git
   cd deepseek-harness-mcp-toggle
   pnpm install
   pnpm run build
   ```

2. Link into your DSH profile (`web` profile by default):
   ```bash
   mkdir -p ~/.dsh/profiles/web/node_modules
   ln -sfT "$PWD" ~/.dsh/profiles/web/node_modules/dsh-plugin-mcp-toggle
   ```

3. Register the plugin entry and format your MCP server rows in `~/.dsh/profiles/web/cordis.patch.yml` inside an `- insert:` block:
   ```yaml
   - insert:
       - id: mcp-admin
         name: dsh-plugin-mcp-toggle

       # Example MCP servers:
       - id: mcp-exa
         name: '@deepseek-ai/dsh-mcp-client'
         config:
           serverName: exa
           transport: streamable-http
           url: https://mcp.exa.ai/mcp

       - id: mcp-blender
         name: '@deepseek-ai/dsh-mcp-client'
         disabled: true
         config:
           serverName: blender-mcp
           transport: stdio
           command: uvx
           args: ['blender-mcp']
   ```

4. *(Optional)* Run the automated migration helper to format existing rows:
   ```bash
   ./scripts/migrate-patch.py ~/.dsh/profiles/web/cordis.patch.yml
   ```

5. Restart DSH Web:
   ```bash
   bunx @deepseek-ai/dsh web
   ```

---

## How It Works

`dsh-plugin-mcp-toggle` uses DSH's dual-face plugin architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser Web UI                         │
│  - Contributes to 'settings.section' slot (order: 30)       │
│  - React UI with toggle switches & live fiber status        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                      Typert RPC Bridge
                    (/api/mcpAdmin/list, toggle)
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    Host Node Service                        │
│  - MCPAdminGateway (TypertRemoteService)                    │
│  - Direct live lifecycle: loader.update(id, { disabled })   │
│  - Atomic YAML persistence: updates cordis.patch.yml        │
└─────────────────────────────────────────────────────────────┘
```

1. **Host Side (`src/index.ts`, `src/typert.host.ts`)**:
   - Exposes a Typert Remote Service under the `mcpAdmin` namespace.
   - Reads live MCP client entries (`@deepseek-ai/dsh-mcp-client`) from Cordis `loader.entries()`.
   - On toggle, updates the Cordis Loader fiber in-memory and atomically rewrites the target `disabled` key in the YAML patch file.

2. **Browser Side (`src/client/`)**:
   - Contributes a settings section to DSH Settings via `ctx.slots.inject('settings.section', ...)`.
   - Mounts the typed `mcpAdmin` Typert Remote to communicate with the host.

---

## Development

```bash
pnpm install
pnpm run build     # Build Node ESM, Browser CJS, and Typert manifests
pnpm test          # Run YAML patch-store unit tests
pnpm run watch     # Auto-rebuild on source changes
```

---

## License

[MIT](LICENSE) © 2025 [Eren Eksen](https://github.com/ErenEksen)
