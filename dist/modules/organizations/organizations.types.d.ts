import { PlanType, UserRole } from '@prisma/client';
export interface CreateOrganizationInput {
    name: string;
    website?: string;
    industry?: string;
    timezone?: string;
}
export interface UpdateOrganizationInput {
    name?: string;
    logo?: string;
    website?: string;
    industry?: string;
    timezone?: string;
}
export interface InviteMemberInput {
    email: string;
    role: UserRole;
}
export interface UpdateMemberRoleInput {
    role: UserRole;
}
export interface TransferOwnershipInput {
    newOwnerId: string;
    password: string;
}
export interface OrganizationResponse {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
    website: string | null;
    industry: string | null;
    timezone: string;
    planType: PlanType;
    featureInboxLocked?: boolean;
    featureCampaignsLocked?: boolean;
    featureChatbotLocked?: boolean;
    featureAutomationLocked?: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface OrganizationWithMembers extends OrganizationResponse {
    owner: {
        id: string;
        email: string;
        firstName: string;
        lastName: string | null;
        avatar: string | null;
    };
    members: OrganizationMemberResponse[];
    memberCount: number;
}
export interface OrganizationMemberResponse {
    id: string;
    userId: string;
    email: string;
    firstName: string;
    lastName: string | null;
    avatar: string | null;
    role: UserRole;
    joinedAt: Date | null;
    invitedAt: Date;
}
export interface OrganizationStats {
    totalContacts: number;
    totalMessages: number;
    totalCampaigns: number;
    totalTemplates: number;
    planUsage: {
        contactsUsed: number;
        contactsLimit: number;
        messagesUsed: number;
        messagesLimit: number;
    };
}
export interface OrganizationInvite {
    id: string;
    email: string;
    role: UserRole;
    invitedAt: Date;
    status: 'pending' | 'accepted' | 'expired';
}
//# sourceMappingURL=organizations.types.d.ts.map