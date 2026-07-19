export declare const webpushService: {
    /**
     * Save a new push subscription for a user
     */
    saveSubscription(userId: string, subscription: any): Promise<{
        userId: string;
        id: string;
        auth: string;
        createdAt: Date;
        endpoint: string;
        p256dh: string;
    }>;
    /**
     * Remove a push subscription
     */
    removeSubscription(endpoint: string): Promise<void>;
    /**
     * Send a push notification to all stored subscriptions of a user
     */
    sendNotificationToUser(userId: string, payload: {
        title: string;
        body: string;
        icon?: string;
        url?: string;
    }): Promise<void>;
};
//# sourceMappingURL=webpush.service.d.ts.map