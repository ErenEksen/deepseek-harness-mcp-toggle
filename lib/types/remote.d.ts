import type { TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
import type { McpServerSnapshot } from './types.ts';
export declare const TYPERT_REMOTE: TypertRemoteContribution;
export default TYPERT_REMOTE;
declare module '@deepseek-ai/dsh-typert-protocol' {
    interface TypertRemoteNamespace$6d637041646d696e {
        list: () => Promise<{
            ok: true;
            value: McpServerSnapshot;
        } | {
            ok: false;
            error: {
                code: string;
                message: string;
                details: object;
            };
        }>;
        toggle: (entryId: string, enabled: boolean) => Promise<{
            ok: true;
            value: McpServerSnapshot;
        } | {
            ok: false;
            error: {
                code: string;
                message: string;
                details: object;
            };
        }>;
    }
    interface TypertRemoteMap {
        'mcpAdmin/list': TypertRemoteNamespace$6d637041646d696e['list'];
        'mcpAdmin/toggle': TypertRemoteNamespace$6d637041646d696e['toggle'];
    }
    interface TypertRemoteNamespaceMap {
        'mcpAdmin': TypertRemoteNamespace$6d637041646d696e;
    }
}
