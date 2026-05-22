export declare const emailTemplates: {
    verifyEmail: (name: string, verifyUrl: string) => {
        subject: string;
        html: string;
    };
    resetPassword: (name: string, resetUrl: string) => {
        subject: string;
        html: string;
    };
    otp: (name: string, otp: string) => {
        subject: string;
        html: string;
    };
    welcome: (name: string) => {
        subject: string;
        html: string;
    };
};
interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
}
export declare const sendEmail: (options: SendEmailOptions) => Promise<boolean>;
export declare const verifyEmailConfig: () => Promise<boolean>;
export {};
//# sourceMappingURL=email.resend.d.ts.map