export declare const config: {
    readonly app: {
        readonly name: "WabMeta";
        readonly env: "development" | "production" | "test";
        readonly port: number;
        readonly isDevelopment: boolean;
        readonly isProduction: boolean;
    };
    readonly port: number;
    readonly nodeEnv: "development" | "production" | "test";
    readonly database: {
        readonly url: string;
    };
    readonly databaseUrl: string;
    readonly frontendUrl: string;
    readonly frontend: {
        readonly url: string;
        readonly corsOrigins: readonly ["https://wabmeta.com", "https://www.wabmeta.com", "http://localhost:3000", "http://localhost:5173"];
    };
    readonly jwt: {
        readonly secret: string;
        readonly accessSecret: string;
        readonly refreshSecret: string;
        readonly accessExpiresIn: string;
        readonly refreshExpiresIn: string;
        readonly expiresIn: string;
    };
    readonly jwtSecret: string;
    readonly encryption: {
        readonly key: string;
    };
    readonly encryptionKey: string;
    readonly meta: {
        readonly appId: string;
        readonly appSecret: string;
        readonly webhookVerifyToken: string;
        readonly configId: string;
        readonly redirectUri: string;
        readonly graphApiVersion: string;
    };
    readonly google: {
        readonly clientId: string;
        readonly clientSecret: string;
        readonly redirectUri: string;
    };
    readonly email: {
        readonly enabled: boolean;
        readonly resendApiKey: string;
        readonly from: string;
        readonly fromName: string;
        readonly smtp: {
            readonly host: string;
            readonly port: number;
            readonly auth: {
                readonly user: string;
                readonly pass: string;
            };
        };
    };
    readonly razorpay: {
        readonly keyId: string;
        readonly keySecret: string;
    };
    readonly redis: {
        readonly url: string;
    };
    readonly cloudinary: {
        readonly cloudName: string;
        readonly apiKey: string;
        readonly apiSecret: string;
        readonly folder: string;
    };
};
export default config;
//# sourceMappingURL=index.d.ts.map