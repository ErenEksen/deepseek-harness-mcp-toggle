/**
 * Standalone build for the dual-face package:
 * - the Node half (`lib/index.js`), loaded by the dsh Loader into the host
 *   process. Every @deepseek-ai specifier and `yaml` stays an import — the
 *   profile resolves them through dsh's own module fallback, so both halves
 *   share the running process's single Cordis instance.
 * - the browser half (`lib/client.js`), a CJS closure factory registered on
 *   window.__ModuleLoader__; externals are exactly the Web shell's seeded
 *   module table (React, Cordis, ui-slots, ui-primitives, runtime) — everything
 *   else inlines.
 */
import { readFile } from 'node:fs/promises'
import { basename, dirname, resolve as resolvePath } from 'node:path'
import { transform } from 'lightningcss'

const ID = 'dsh-plugin-mcp-toggle'

/** The Web shell's seeded module-table specifiers (packages/client/web/src/platform.ts). */
const PLATFORM_MODULES = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
]
const PRELOADED_CLIENT_EXTERNALS = ['@deepseek-ai/dsh-client-runtime/client']
const clientExternals = new Set([...PLATFORM_MODULES, ...PRELOADED_CLIENT_EXTERNALS])

/** Node half: production deps and dsh peers stay imports; nothing else is imported. */
const isNodeExternal = (specifier: string): boolean =>
  specifier === 'yaml' || specifier.startsWith('@deepseek-ai/')

const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const GLOBAL_CSS_VIRTUAL_PREFIX = '\0dsh-global-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

function styleInjectionModule(
  id: string,
  fileId: string,
  css: string,
  classMap?: Readonly<Record<string, string>>,
): string {
  const source = [
    'const css = ' + JSON.stringify(css) + ';',
    'const tagId = ' + JSON.stringify(id + '/' + basename(fileId)) + ';',
    "if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {",
    "  const tag = document.createElement('style');",
    '  tag.dataset.plugin = ' + JSON.stringify(id) + ';',
    '  tag.dataset.pluginCss = tagId;',
    '  tag.textContent = css;',
    "  document.head.appendChild(tag);",
    '}',
  ]
  source.push(classMap === undefined ? 'export {};' : 'export default ' + JSON.stringify(classMap) + ';')
  return source.join('\n')
}

function sourceAssetPath(source: string, importer: string): string {
  return resolvePath(dirname(importer), source)
}

export default [
  {
    name: ID,
    entry: { index: 'lib/types/index.js' },
    outDir: 'lib',
    format: ['esm'],
    fixedExtension: false,
    platform: 'node',
    target: 'es2024',
    dts: false,
    clean: false,
    deps: {
      neverBundle: isNodeExternal,
      alwaysBundle: (specifier: string) => !isNodeExternal(specifier),
    },
  },
  {
    name: ID + '/client',
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    dts: false,
    sourcemap: true,
    clean: false,
    deps: {
      neverBundle: (specifier: string) => clientExternals.has(specifier),
      alwaysBundle: (specifier: string) => !clientExternals.has(specifier),
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
    },
    plugins: [
      {
        name: 'dsh-css-modules-inline',
        resolveId(source: string, importer: string | undefined) {
          if (!source.endsWith('.module.css')) return null
          const abs = importer !== undefined ? sourceAssetPath(source, importer) : source
          return CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
        },
        async load(virtualId: string) {
          if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
          const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
          const source = await readFile(fileId)
          const { code, exports: cssExports } = transform({
            filename: fileId,
            code: source,
            cssModules: { pattern: '[hash]_[local]' },
            minify: true,
          })
          const classMap: Record<string, string> = {}
          const exportEntries = Object.entries(cssExports ?? {})
            .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
          for (const [local, exp] of exportEntries) classMap[local] = exp.name
          return styleInjectionModule(ID, fileId, code.toString(), classMap)
        },
      },
      {
        name: 'dsh-css-global-inline',
        resolveId(source: string, importer: string | undefined) {
          if (!source.endsWith('.css') || source.endsWith('.module.css')) return null
          const abs = importer !== undefined ? sourceAssetPath(source, importer) : source
          return GLOBAL_CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
        },
        async load(virtualId: string) {
          if (!virtualId.startsWith(GLOBAL_CSS_VIRTUAL_PREFIX)) return null
          const fileId = virtualId.slice(GLOBAL_CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
          const source = await readFile(fileId)
          const { code } = transform({ filename: fileId, code: source, minify: true })
          return styleInjectionModule(ID, fileId, code.toString())
        },
      },
    ],
    outputOptions: {
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: ' + JSON.stringify(ID) + ', factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
  {
    name: ID + '/typert',
    entry: { 'typert.host': 'lib/types/typert.host.js' },
    outDir: 'lib',
    format: ['esm'],
    fixedExtension: false,
    platform: 'node',
    target: 'es2024',
    dts: false,
    clean: false,
    deps: {
      neverBundle: isNodeExternal,
      alwaysBundle: (specifier: string) => !isNodeExternal(specifier),
    },
  },
]