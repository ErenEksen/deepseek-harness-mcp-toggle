import { z } from 'zod';
const fiberPhaseSchema = z.enum(['pending', 'loading', 'active', 'failed', 'unloading']).nullable();
const entrySchema = z.object({
    entryId: z.string(),
    serverName: z.string(),
    transport: z.string(),
    disabled: z.boolean(),
    fiberPhase: fiberPhaseSchema,
    command: z.string().optional(),
    url: z.string().optional(),
});
const snapshotSchema = z.object({
    entries: z.array(entrySchema),
});
export const TYPERT = {
    package: 'dsh-plugin-mcp-toggle',
    face: 'host',
    schemas: [
        { name: 'McpServerEntry', schema: entrySchema },
        { name: 'McpServerSnapshot', schema: snapshotSchema },
    ],
    model: { services: [], events: [], objects: [] },
    invocations: [
        {
            id: 'dsh-plugin-mcp-toggle#mcpAdmin/list',
            service: 'mcpAdmin',
            namespace: 'mcpAdmin',
            method: 'list',
            invocation: { kind: 'direct' },
            parameters: [],
            result: {
                mode: 'strict',
                typeSymbol: 'dsh-plugin-mcp-toggle/types#McpServerSnapshot',
                schema: snapshotSchema,
            },
            sourceLocation: { file: 'src/index.ts', line: 60, column: 3 },
        },
        {
            id: 'dsh-plugin-mcp-toggle#mcpAdmin/toggle',
            service: 'mcpAdmin',
            namespace: 'mcpAdmin',
            method: 'toggle',
            invocation: { kind: 'direct' },
            parameters: [
                {
                    name: 'entryId',
                    wire: 'entryId',
                    source: 'json',
                    codec: { mode: 'strict', typeSymbol: 'dsh-plugin-mcp-toggle/types#EntryId', schema: z.string() },
                },
                {
                    name: 'enabled',
                    wire: 'enabled',
                    source: 'json',
                    codec: { mode: 'strict', typeSymbol: 'dsh-plugin-mcp-toggle/types#Enabled', schema: z.boolean() },
                },
            ],
            result: {
                mode: 'strict',
                typeSymbol: 'dsh-plugin-mcp-toggle/types#McpServerSnapshot',
                schema: snapshotSchema,
            },
            sourceLocation: { file: 'src/index.ts', line: 87, column: 3 },
        },
    ],
};
//# sourceMappingURL=typert.host.js.map