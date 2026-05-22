import { UpdateProfileInput, UserProfile, UserWithOrganizations, UserStats, SessionInfo } from './users.types';
export declare class UsersService {
    getProfile(userId: string): Promise<UserProfile>;
    getUserWithOrganizations(userId: string): Promise<UserWithOrganizations>;
    updateProfile(userId: string, input: UpdateProfileInput): Promise<UserProfile>;
    updateAvatar(userId: string, avatarUrl: string): Promise<UserProfile>;
    getUserStats(userId: string): Promise<UserStats>;
    getActiveSessions(userId: string, currentToken?: string): Promise<SessionInfo[]>;
    revokeSession(userId: string, sessionId: string): Promise<{
        message: string;
    }>;
    revokeAllSessions(userId: string, exceptCurrent?: string): Promise<{
        message: string;
    }>;
    deleteAccount(userId: string, password: string, reason?: string): Promise<{
        message: string;
    }>;
    getUserById(userId: string): Promise<UserProfile>;
    addPhoneNumber(userId: string, phone: string): Promise<{
        message: string;
        phone: string;
        whatsappSent: boolean;
    }>;
}
export declare const usersService: UsersService;
//# sourceMappingURL=users.service.d.ts.map