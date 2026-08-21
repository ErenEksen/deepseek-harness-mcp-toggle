import type { InvocationDescriptor } from '@deepseek-ai/dsh-typert-protocol';
export interface TypertContribution {
    readonly package: string;
    readonly face: 'host' | 'client';
    readonly schemas: readonly {
        readonly name: string;
        readonly schema: unknown;
    }[];
    readonly model: unknown;
    readonly invocations: readonly InvocationDescriptor[];
}
export declare const TYPERT: TypertContribution;
