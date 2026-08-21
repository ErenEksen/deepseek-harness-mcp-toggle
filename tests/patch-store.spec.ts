/** Unit tests for the surgical patch-file editing. */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { editEntryDisabled, readPatchFile, restorePatchFile, writeEntryDisabled } from '../src/patch-store.ts'

const FIXTURE = String.raw`# --- MCP servers ---

- id: mcp-blender-mcp
  name: '@deepseek-ai/dsh-mcp-client'
  disabled: true
  config:
    serverName: blender-mcp
    env: !!js process.env.BLENDER_HOST ?? 'localhost'

- id: mcp-exa
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    serverName: exa
    transport: streamable-http
    url: https://mcp.exa.ai/mcp

- id: mcp-notes  # keep this comment
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    serverName: notes
    transport: stdio
    command: npx
`.trim() + '\n'

test('flips an existing disabled key and preserves everything else', () => {
  const edited = editEntryDisabled(FIXTURE, 'mcp-blender-mcp', false)
  assert.ok(edited.includes('  disabled: false'))
  assert.ok(!edited.includes('  disabled: true'))
  // Every other line survives byte-for-byte.
  for (const line of FIXTURE.split('\n')) {
    if (line === '  disabled: true') continue
    const needle = line + '\n'
    assert.ok(edited.includes(needle) || edited.endsWith(line) || edited.startsWith(line), 'lost line: ' + line)
  }
})

test('inserts a disabled key under the id line when absent', () => {
  const edited = editEntryDisabled(FIXTURE, 'mcp-exa', true)
  const idx = edited.indexOf('- id: mcp-exa')
  assert.ok(idx !== -1)
  const tail = edited.slice(idx, edited.indexOf('- id: mcp-notes'))
  assert.ok(tail.includes('  disabled: true'))
  assert.ok(tail.indexOf('  disabled: true') < tail.indexOf("  name: '@deepseek-ai/dsh-mcp-client'"))
})

test('appends a new id-targeted row when the id is absent', () => {
  const edited = editEntryDisabled(FIXTURE, 'mcp-other', true)
  assert.ok(edited.endsWith('- id: mcp-other\n  disabled: true\n'))
  // Existing content untouched.
  assert.ok(edited.startsWith(FIXTURE))
})

test('replaces a !!js config value only when it is the target key', () => {
  const edited = editEntryDisabled(FIXTURE, 'mcp-notes', false)
  assert.ok(edited.includes('  disabled: false'))
  // The nested !!js expression inside blender's config survives.
  assert.ok(edited.includes("    env: !!js process.env.BLENDER_HOST ?? 'localhost'"))
  // The trailing comment on the id line survives.
  assert.ok(edited.includes('- id: mcp-notes  # keep this comment'))
})

test('returns identical text when the target value is already persisted', () => {
  assert.equal(editEntryDisabled(FIXTURE, 'mcp-blender-mcp', true), FIXTURE)
})

const INSERT_FIXTURE = String.raw`# MCP servers below live in one insert block.
- id: mcp-admin
  name: dsh-plugin-mcp-toggle
- insert:
    - id: mcp-blender-mcp
      name: '@deepseek-ai/dsh-mcp-client'
      disabled: true
      config:
        serverName: blender-mcp
        transport: stdio
    # keep this comment inside the insert block
    - id: mcp-exa
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: exa
        transport: streamable-http
        url: https://mcp.exa.ai/mcp
`.trim() + '\n'

test('flips a disabled key on an entry nested inside an insert block', () => {
  const edited = editEntryDisabled(INSERT_FIXTURE, 'mcp-blender-mcp', false)
  assert.ok(edited.includes('      disabled: false'))
  assert.ok(!edited.includes('      disabled: true'))
  // Sibling nested entry and its comment survive.
  assert.ok(edited.includes('    # keep this comment inside the insert block'))
  assert.ok(edited.includes('    - id: mcp-exa'))
  assert.ok(edited.includes('  name: dsh-plugin-mcp-toggle'))
})

test('inserts a disabled key under a nested id line when absent', () => {
  const edited = editEntryDisabled(INSERT_FIXTURE, 'mcp-exa', true)
  const idx = edited.indexOf('    - id: mcp-exa')
  assert.ok(idx !== -1)
  const tail = edited.slice(idx, edited.indexOf('    - id: mcp-exa') + edited.slice(edited.indexOf('    - id: mcp-exa')).indexOf('  name:'))
  assert.ok(tail.includes('      disabled: true'))
  // The disabled key sits at the nested key indentation (6 spaces).
  const inserted = edited.slice(idx, idx + 80)
  assert.ok(inserted.includes('    - id: mcp-exa\n      disabled: true\n'))
})

test('appends an override row even when an insert block exists', () => {
  const edited = editEntryDisabled(INSERT_FIXTURE, 'mcp-bundle-row', true)
  assert.ok(edited.endsWith('\n- id: mcp-bundle-row\n  disabled: true\n'))
  assert.ok(edited.startsWith(INSERT_FIXTURE))
})


test('writes and rolls back through the atomic file helpers', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mcp-toggle-'))
  const path = join(dir, 'cordis.patch.yml')
  writeFileSync(path, FIXTURE)
  const previous = writeEntryDisabled(path, 'mcp-exa', true)
  assert.equal(previous, FIXTURE)
  assert.ok(readFileSync(path, 'utf8').includes('  disabled: true'))
  restorePatchFile(path, previous)
  assert.equal(readFileSync(path, 'utf8'), FIXTURE)
  // A missing file is created on write and removed on restore.
  const missing = join(dir, 'missing.yml')
  const none = writeEntryDisabled(missing, 'mcp-x', true)
  assert.equal(none, undefined)
  assert.ok(readPatchFile(missing) !== undefined)
  restorePatchFile(missing, undefined)
  assert.equal(readPatchFile(missing), undefined)
  rmSync(dir, { recursive: true, force: true })
})