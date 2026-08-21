/**
 * MCP Servers settings section: one row per live MCP server with an enable
 * switch, a status line, and a refresh control. All data arrives through the
 * injected callbacks; every mutation goes back to the Host Remote.
 */

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Button, IconRefreshOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { McpServerEntry, McpServerSnapshot } from '../types.ts'
import type { McpServersLocaleKey } from './locales.ts'
import css from './McpServersSection.module.css'

/** Registration-side business face for the MCP Servers section. */
export interface McpServersSectionInjected {
  /** Read the live MCP rows from the Host. */
  list: () => Promise<McpServerSnapshot>
  /** Enable or disable one server; resolves with the refreshed snapshot. */
  setEnabled: (entryId: string, enabled: boolean) => Promise<McpServerSnapshot>
}

/** Full component props. */
export type McpServersSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'settings.mcpServers'>
  & InjectFace<McpServersSectionInjected>

/** Read state the section renders. */
type SectionStatus = 'loading' | 'idle' | 'error'

/** Display label for one row's status column. */
function statusLabel(entry: McpServerEntry, t: McpServersSectionProps['t']): string {
  if (entry.disabled) return t('statusDisabled')
  switch (entry.fiberPhase) {
    case 'active': return t('statusEnabled')
    case 'failed': return t('statusFailed')
    case 'pending':
    case 'loading': return t('statusPending')
    default: return t('statusOff')
  }
}

/** One server row: title/description plus the enable switch. */
function McpServerRow(props: {
  entry: McpServerEntry
  busy: boolean
  t: McpServersSectionProps['t']
  onToggle: (entry: McpServerEntry) => void
}): ReactNode {
  const { entry, busy, t, onToggle } = props
  const endpoint = entry.url
    ? (entry.transport ? `${entry.transport} · ${entry.url}` : entry.url)
    : entry.command
      ? `stdio · ${entry.command}`
      : entry.transport || ''
  const enabled = !entry.disabled
  const state = statusLabel(entry, t)
  const stateClass = entry.disabled || entry.fiberPhase === null
    ? undefined
    : entry.fiberPhase === 'failed'
      ? css.statusFailed
      : css.statusOn
  const switchClass = [css.switch, enabled ? undefined : css.switchOff].filter(Boolean).join(' ')
  const switchLabel = enabled ? t('toggleDisable', { serverName: entry.serverName }) : t('toggleEnable', { serverName: entry.serverName })
  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{entry.serverName}</div>
        {endpoint ? <div className={css.desc}>{endpoint}</div> : null}
      </div>
      <span className={[css.status, stateClass].filter(Boolean).join(' ')}>{state}</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={switchLabel}
        title={switchLabel}
        className={switchClass}
        disabled={busy}
        onClick={() => { onToggle(entry) }}
      >
        <span className={css.knob} />
      </button>
    </div>
  )
}

/**
 * Render the MCP Servers settings section.
 * @param props - composed slot props.
 * @returns the section element tree.
 */
export function McpServersSection({ list, setEnabled, t }: McpServersSectionProps) {
  const [snapshot, setSnapshot] = useState<McpServerSnapshot>({ entries: [] })
  const [status, setStatus] = useState<SectionStatus>('loading')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async (): Promise<void> => {
    try {
      setError(null)
      const next = await list()
      setSnapshot(next)
      setStatus('idle')
    } catch (cause) {
      setStatus('error')
      setError(t('errorRead', { message: cause instanceof Error ? cause.message : String(cause) }))
    }
  }

  useEffect(() => {
    void load()
    // The injected callbacks are stable for the section's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = async (entry: McpServerEntry): Promise<void> => {
    if (busyId !== null) return
    setBusyId(entry.entryId)
    setError(null)
    try {
      const next = await setEnabled(entry.entryId, entry.disabled)
      setSnapshot(next)
      setStatus('idle')
    } catch (cause) {
      setError(t('errorToggle', {
        serverName: entry.serverName,
        message: cause instanceof Error ? cause.message : String(cause),
      }))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className={css.section}>
      <div className={css.header}>
        <div className={css.intro}>{t('intro')}</div>
        <Button
          className={css.refresh}
          variant="outline"
          disabled={busyId !== null || status === 'loading'}
          onClick={() => { void load() }}
        >
          {t('refresh')}
        </Button>
      </div>
      {status === 'loading' && snapshot.entries.length === 0
        ? <div className={css.desc}>{t('loading')}</div>
        : snapshot.entries.map(entry => (
          <McpServerRow
            key={entry.entryId}
            entry={entry}
            busy={busyId === entry.entryId}
            t={t}
            onToggle={(target) => { void toggle(target) }}
          />
        ))}
      {status === 'error' && snapshot.entries.length === 0
        ? <div className={css.error} role="alert">{error}</div>
        : null}
      {error !== null && snapshot.entries.length > 0
        ? <div className={css.error} role="alert">{error}</div>
        : null}
      {status === 'idle' && snapshot.entries.length === 0
        ? <div className={css.desc}>{t('empty')}</div>
        : null}
    </div>
  )
}