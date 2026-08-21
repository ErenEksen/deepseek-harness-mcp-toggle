import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * MCP Servers settings section: one row per live MCP server with an enable
 * switch, a status line, and a refresh control. All data arrives through the
 * injected callbacks; every mutation goes back to the Host Remote.
 */
import { useEffect, useState } from 'react';
import { Button } from '@deepseek-ai/dsh-client-ui-primitives';
import css from './McpServersSection.module.css';
/** Display label for one row's status column. */
function statusLabel(entry, t) {
    if (entry.disabled)
        return t('statusDisabled');
    switch (entry.fiberPhase) {
        case 'active': return t('statusEnabled');
        case 'failed': return t('statusFailed');
        case 'pending':
        case 'loading': return t('statusPending');
        default: return t('statusOff');
    }
}
/** One server row: title/description plus the enable switch. */
function McpServerRow(props) {
    const { entry, busy, t, onToggle } = props;
    const endpoint = entry.url
        ? (entry.transport ? `${entry.transport} · ${entry.url}` : entry.url)
        : entry.command
            ? `stdio · ${entry.command}`
            : entry.transport || '';
    const enabled = !entry.disabled;
    const state = statusLabel(entry, t);
    const stateClass = entry.disabled || entry.fiberPhase === null
        ? undefined
        : entry.fiberPhase === 'failed'
            ? css.statusFailed
            : css.statusOn;
    const switchClass = [css.switch, enabled ? undefined : css.switchOff].filter(Boolean).join(' ');
    const switchLabel = enabled ? t('toggleDisable', { serverName: entry.serverName }) : t('toggleEnable', { serverName: entry.serverName });
    return (_jsxs("div", { className: css.row, children: [_jsxs("div", { className: css.rowText, children: [_jsx("div", { className: css.title, children: entry.serverName }), endpoint ? _jsx("div", { className: css.desc, children: endpoint }) : null] }), _jsx("span", { className: [css.status, stateClass].filter(Boolean).join(' '), children: state }), _jsx("button", { type: "button", role: "switch", "aria-checked": enabled, "aria-label": switchLabel, title: switchLabel, className: switchClass, disabled: busy, onClick: () => { onToggle(entry); }, children: _jsx("span", { className: css.knob }) })] }));
}
/**
 * Render the MCP Servers settings section.
 * @param props - composed slot props.
 * @returns the section element tree.
 */
export function McpServersSection({ list, setEnabled, t }) {
    const [snapshot, setSnapshot] = useState({ entries: [] });
    const [status, setStatus] = useState('loading');
    const [busyId, setBusyId] = useState(null);
    const [error, setError] = useState(null);
    const load = async () => {
        try {
            setError(null);
            const next = await list();
            setSnapshot(next);
            setStatus('idle');
        }
        catch (cause) {
            setStatus('error');
            setError(t('errorRead', { message: cause instanceof Error ? cause.message : String(cause) }));
        }
    };
    useEffect(() => {
        void load();
        // The injected callbacks are stable for the section's lifetime.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const toggle = async (entry) => {
        if (busyId !== null)
            return;
        setBusyId(entry.entryId);
        setError(null);
        try {
            const next = await setEnabled(entry.entryId, entry.disabled);
            setSnapshot(next);
            setStatus('idle');
        }
        catch (cause) {
            setError(t('errorToggle', {
                serverName: entry.serverName,
                message: cause instanceof Error ? cause.message : String(cause),
            }));
        }
        finally {
            setBusyId(null);
        }
    };
    return (_jsxs("div", { className: css.section, children: [_jsxs("div", { className: css.header, children: [_jsx("div", { className: css.intro, children: t('intro') }), _jsx(Button, { className: css.refresh, variant: "outline", disabled: busyId !== null || status === 'loading', onClick: () => { void load(); }, children: t('refresh') })] }), status === 'loading' && snapshot.entries.length === 0
                ? _jsx("div", { className: css.desc, children: t('loading') })
                : snapshot.entries.map(entry => (_jsx(McpServerRow, { entry: entry, busy: busyId === entry.entryId, t: t, onToggle: (target) => { void toggle(target); } }, entry.entryId))), status === 'error' && snapshot.entries.length === 0
                ? _jsx("div", { className: css.error, role: "alert", children: error })
                : null, error !== null && snapshot.entries.length > 0
                ? _jsx("div", { className: css.error, role: "alert", children: error })
                : null, status === 'idle' && snapshot.entries.length === 0
                ? _jsx("div", { className: css.desc, children: t('empty') })
                : null] }));
}
//# sourceMappingURL=McpServersSection.js.map