import { z } from 'zod';
export declare const tokenExchangeSchema: z.ZodObject<{
    body: z.ZodObject<{
        code: z.ZodString;
        organizationId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        organizationId: string;
        code: string;
    }, {
        organizationId: string;
        code: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        organizationId: string;
        code: string;
    };
}, {
    body: {
        organizationId: string;
        code: string;
    };
}>;
export declare const getOAuthUrlSchema: z.ZodObject<{
    query: z.ZodObject<{
        organizationId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        organizationId?: string | undefined;
    }, {
        organizationId?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        organizationId?: string | undefined;
    };
}, {
    query: {
        organizationId?: string | undefined;
    };
}>;
export type TokenExchangeBody = z.infer<typeof tokenExchangeSchema>['body'];
export type GetOAuthUrlQuery = z.infer<typeof getOAuthUrlSchema>['query'];
//# sourceMappingURL=meta.schema.d.ts.map