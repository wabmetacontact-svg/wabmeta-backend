export declare const hashPassword: (password: string) => Promise<string>;
export declare const comparePassword: (password: string, hash: string) => Promise<boolean>;
export declare const needsRehash: (hash: string) => boolean;
//# sourceMappingURL=password.d.ts.map