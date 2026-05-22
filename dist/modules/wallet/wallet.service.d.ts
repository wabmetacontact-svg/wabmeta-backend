export declare function getWalletDetails(organizationId: string): Promise<{
    exists: boolean;
    isActive: boolean;
    balance: number;
    hasPendingRequest: boolean;
    pendingRequest: {
        status: string;
        id: string;
        requestedAt: Date;
    } | null;
} | {
    id: any;
    organizationId: any;
    isActive: any;
    accessGrantedAt: any;
    balance: number;
    reservedBalance: number;
    availableBalance: number;
    creditEnabled: any;
    creditLimit: number;
    creditUsed: number;
    availableCredit: number;
    currency: any;
    lowBalanceThreshold: number;
    maxTopUpAmount: number;
    maxMonthlyTopUp: number;
    currentMonthTopUp: number;
    totalCredited: number;
    totalDebited: number;
    lastTransactionAt: any;
    flagged: any;
    flagReason: any;
    exists: boolean;
    hasPendingRequest: boolean;
    pendingRequest: {
        status: string;
        id: string;
        requestedAt: Date;
    } | null;
}>;
export declare function requestWalletAccess(organizationId: string, userId: string, data: {
    reason: string;
    additionalInfo?: string;
}): Promise<{
    request: {
        userId: string;
        organizationId: string;
        status: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        reason: string;
        additionalInfo: string | null;
        reviewedBy: string | null;
        reviewNote: string | null;
        reviewedAt: Date | null;
        planVerified: boolean;
        requestedAt: Date;
    };
    planEligible: boolean;
    planMessage: string | undefined;
    message: string;
}>;
export declare function getTransactionHistory(organizationId: string, options: {
    page?: number;
    limit?: number;
    type?: string;
    startDate?: Date;
    endDate?: Date;
}): Promise<{
    transactions: {
        id: any;
        transactionId: any;
        type: any;
        amount: number;
        balanceBefore: number;
        balanceAfter: number;
        currency: any;
        description: any;
        status: any;
        metaChargeId: any;
        metaService: any;
        razorpayOrderId: any;
        razorpayPaymentId: any;
        note: any;
        createdAt: any;
    }[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        pages: number;
    };
}>;
export declare function createTopUpOrder(organizationId: string, amountRupees: number): Promise<{
    orderId: any;
    amount: number;
    amountPaise: number;
    currency: string;
    razorpayKeyId: string;
    receipt: any;
}>;
export declare function processTopUp(organizationId: string, data: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    amount: number;
}): Promise<{
    success: boolean;
    newBalance: number;
    amountAdded: number;
    transaction: {
        id: any;
        transactionId: any;
        type: any;
        amount: number;
        balanceBefore: number;
        balanceAfter: number;
        currency: any;
        description: any;
        status: any;
        metaChargeId: any;
        metaService: any;
        razorpayOrderId: any;
        razorpayPaymentId: any;
        note: any;
        createdAt: any;
    };
}>;
export declare function deductBalance(organizationId: string, data: {
    amountRupees: number;
    description: string;
    metaChargeId?: string;
    metaService?: 'message_sending' | 'template_message' | 'api_usage' | 'other';
}): Promise<{
    success: boolean;
    newBalance: number;
    insufficient?: boolean;
    message?: string;
}>;
export declare function getAccessRequests(options: {
    status?: string;
    page?: number;
    limit?: number;
}): Promise<{
    requests: ({
        organization: {
            name: string;
            id: string;
            planType: import(".prisma/client").$Enums.PlanType;
        };
        user: {
            email: string;
            id: string;
            firstName: string;
            lastName: string | null;
        };
        reviewer: {
            name: string;
            email: string;
            id: string;
        } | null;
    } & {
        userId: string;
        organizationId: string;
        status: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        reason: string;
        additionalInfo: string | null;
        reviewedBy: string | null;
        reviewNote: string | null;
        reviewedAt: Date | null;
        planVerified: boolean;
        requestedAt: Date;
    })[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        pages: number;
    };
}>;
export declare function reviewWalletRequest(requestId: string, adminId: string, action: 'approve' | 'reject', note?: string): Promise<{
    success: boolean;
    action: "approve" | "reject";
    message: string;
}>;
export declare function getAllWallets(options: {
    page?: number;
    limit?: number;
    flagged?: boolean;
    isActive?: boolean;
}): Promise<{
    wallets: {
        organization: any;
        user: any;
        transactionCount: any;
        id: any;
        organizationId: any;
        isActive: any;
        accessGrantedAt: any;
        balance: number;
        reservedBalance: number;
        availableBalance: number;
        creditEnabled: any;
        creditLimit: number;
        creditUsed: number;
        availableCredit: number;
        currency: any;
        lowBalanceThreshold: number;
        maxTopUpAmount: number;
        maxMonthlyTopUp: number;
        currentMonthTopUp: number;
        totalCredited: number;
        totalDebited: number;
        lastTransactionAt: any;
        flagged: any;
        flagReason: any;
    }[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        pages: number;
    };
}>;
export declare function adminAdjustBalance(organizationId: string, adminId: string, data: {
    type: 'admin_credit' | 'admin_debit';
    amountRupees: number;
    note: string;
}): Promise<{
    success: boolean;
    newBalance: number;
    transaction: {
        id: any;
        transactionId: any;
        type: any;
        amount: number;
        balanceBefore: number;
        balanceAfter: number;
        currency: any;
        description: any;
        status: any;
        metaChargeId: any;
        metaService: any;
        razorpayOrderId: any;
        razorpayPaymentId: any;
        note: any;
        createdAt: any;
    };
}>;
export declare function setCreditLimit(organizationId: string, creditLimitRupees: number, enable: boolean): Promise<{
    success: boolean;
    creditEnabled: boolean;
    creditLimit: number;
}>;
export declare function flagWallet(organizationId: string, adminId: string, reason: string, unflag?: boolean): Promise<{
    success: boolean;
    message: string;
}>;
export declare function setWalletActive(organizationId: string, adminId: string, activate: boolean, reason?: string): Promise<{
    success: boolean;
    isActive: boolean;
    message: string;
}>;
export declare function getWalletMessageAnalytics(organizationId: string): Promise<{
    allMessages: {
        sent: number;
        delivered: number;
        received: number;
    };
    messagesDelivered: {
        category: string;
        label: string;
        delivered: number;
    }[];
    freeMessagesDelivered: {
        freeCustomerService: number;
        freeEntryPoint: number;
        total: number;
    };
    paidMessagesDelivered: {
        category: string;
        label: string;
        delivered: number;
    }[];
    approximateCharges: {
        total: number;
        byCategory: {
            category: string;
            label: string;
            cost: number;
            rate: number;
            count: number;
        }[];
    };
    rates: Record<string, number>;
}>;
//# sourceMappingURL=wallet.service.d.ts.map