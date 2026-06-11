export interface TokenPayload {
    userId: string;
    email: string;
    organizationId?: string;
    tokenVersion?: number;
    type?: 'access' | 'refresh';
}
export declare const generateAccessToken: (payload: Omit<TokenPayload, "type">) => string;
export declare const generateRefreshToken: (payload: Omit<TokenPayload, "type">) => string;
export declare const verifyAccessToken: (token: string) => TokenPayload;
export declare const verifyRefreshToken: (token: string) => TokenPayload;
export declare const generateTokens: (payload: Omit<TokenPayload, "type">) => {
    accessToken: string;
    refreshToken: string;
};
export declare const decodeToken: (token: string) => TokenPayload | null;
export declare const parseExpiryTime: (expiryString: string) => number;
export declare const getTokenExpiry: (expiryString: string) => Date;
export declare const isTokenExpired: (token: string) => boolean;
export declare const getTokenRemainingTime: (token: string) => number;
declare const _default: {
    generateAccessToken: (payload: Omit<TokenPayload, "type">) => string;
    generateRefreshToken: (payload: Omit<TokenPayload, "type">) => string;
    verifyAccessToken: (token: string) => TokenPayload;
    verifyRefreshToken: (token: string) => TokenPayload;
    generateTokens: (payload: Omit<TokenPayload, "type">) => {
        accessToken: string;
        refreshToken: string;
    };
    decodeToken: (token: string) => TokenPayload | null;
    parseExpiryTime: (expiryString: string) => number;
    getTokenExpiry: (expiryString: string) => Date;
    isTokenExpired: (token: string) => boolean;
    getTokenRemainingTime: (token: string) => number;
};
export default _default;
//# sourceMappingURL=jwt.d.ts.map