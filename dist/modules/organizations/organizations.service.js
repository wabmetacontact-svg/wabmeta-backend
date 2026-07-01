"use strict";
// src/modules/organizations/organizations.service.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.organizationsService = exports.OrganizationsService = void 0;
const database_1 = __importDefault(require("../../config/database"));
const config_1 = require("../../config");
const errorHandler_1 = require("../../middleware/errorHandler");
const password_1 = require("../../utils/password");
const otp_1 = require("../../utils/otp");
const email_1 = require("../../utils/email");
// ============================================
// HELPER FUNCTIONS
// ============================================
const formatOrganization = (org) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    logo: org.logo,
    website: org.website,
    industry: org.industry,
    timezone: org.timezone,
    planType: org.planType,
    featureInboxLocked: org.featureInboxLocked,
    featureCampaignsLocked: org.featureCampaignsLocked,
    featureChatbotLocked: org.featureChatbotLocked,
    featureAutomationLocked: org.featureAutomationLocked,
    featureConnectionLocked: org.featureConnectionLocked,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
});
// ============================================
// ORGANIZATIONS SERVICE CLASS
// ============================================
class OrganizationsService {
    // ==========================================
    // CREATE ORGANIZATION
    // ==========================================
    async create(userId, input) {
        const { name, website, industry, timezone } = input;
        // Create organization with transaction
        const organization = await database_1.default.$transaction(async (tx) => {
            // Create organization
            const org = await tx.organization.create({
                data: {
                    name,
                    slug: (0, otp_1.generateSlug)(name),
                    website,
                    industry,
                    timezone: timezone || 'UTC',
                    ownerId: userId,
                    planType: 'FREE_DEMO',
                },
            });
            // Add user as owner member
            await tx.organizationMember.create({
                data: {
                    organizationId: org.id,
                    userId,
                    role: 'OWNER',
                    joinedAt: new Date(),
                },
            });
            // Get free plan
            const freePlan = await tx.plan.findUnique({
                where: { type: 'FREE_DEMO' },
            });
            // Create subscription
            if (freePlan) {
                await tx.subscription.create({
                    data: {
                        organizationId: org.id,
                        planId: freePlan.id,
                        status: 'ACTIVE',
                        billingCycle: 'monthly',
                        currentPeriodStart: new Date(),
                        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    },
                });
            }
            return org;
        });
        return formatOrganization(organization);
    }
    // ==========================================
    // GET ORGANIZATION BY ID
    // ==========================================
    async getById(organizationId, userId) {
        // Check user has access
        const membership = await database_1.default.organizationMember.findUnique({
            where: {
                organizationId_userId: {
                    organizationId,
                    userId,
                },
            },
        });
        if (!membership) {
            throw new errorHandler_1.AppError('Organization not found or access denied', 404);
        }
        const organization = await database_1.default.organization.findUnique({
            where: { id: organizationId },
            include: {
                owner: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        avatar: true,
                    },
                },
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                firstName: true,
                                lastName: true,
                                avatar: true,
                            },
                        },
                    },
                    orderBy: { joinedAt: 'asc' },
                },
                _count: {
                    select: { members: true },
                },
            },
        });
        if (!organization) {
            throw new errorHandler_1.AppError('Organization not found', 404);
        }
        const members = organization.members.map((m) => ({
            id: m.id,
            userId: m.userId,
            email: m.user.email,
            firstName: m.user.firstName,
            lastName: m.user.lastName,
            avatar: m.user.avatar,
            role: m.role,
            joinedAt: m.joinedAt,
            invitedAt: m.invitedAt,
        }));
        return {
            ...formatOrganization(organization),
            owner: organization.owner,
            members,
            memberCount: organization._count.members,
        };
    }
    // ==========================================
    // GET USER ORGANIZATIONS
    // ==========================================
    async getUserOrganizations(userId) {
        const memberships = await database_1.default.organizationMember.findMany({
            where: { userId },
            include: {
                organization: true,
            },
            orderBy: { joinedAt: 'asc' },
        });
        return memberships.map((m) => formatOrganization(m.organization));
    }
    // ==========================================
    // UPDATE ORGANIZATION
    // ==========================================
    async update(organizationId, userId, input) {
        // Check user is admin or owner
        const membership = await database_1.default.organizationMember.findUnique({
            where: {
                organizationId_userId: {
                    organizationId,
                    userId,
                },
            },
        });
        if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
            throw new errorHandler_1.AppError('Permission denied', 403);
        }
        const organization = await database_1.default.organization.update({
            where: { id: organizationId },
            data: {
                name: input.name,
                logo: input.logo,
                website: input.website,
                industry: input.industry,
                timezone: input.timezone,
            },
        });
        return formatOrganization(organization);
    }
    // ==========================================
    // INVITE MEMBER
    // ==========================================
    async inviteMember(organizationId, userId, email, role) {
        // Check user is admin or owner
        const membership = await database_1.default.organizationMember.findUnique({
            where: {
                organizationId_userId: {
                    organizationId,
                    userId,
                },
            },
        });
        if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
            throw new errorHandler_1.AppError('Permission denied', 403);
        }
        // Cannot invite as OWNER
        if (role === 'OWNER') {
            throw new errorHandler_1.AppError('Cannot invite as owner. Use transfer ownership instead.', 400);
        }
        // Get organization
        const organization = await database_1.default.organization.findUnique({
            where: { id: organizationId },
            include: { subscription: { include: { plan: true } } },
        });
        if (!organization) {
            throw new errorHandler_1.AppError('Organization not found', 404);
        }
        // Check member limit
        const memberCount = await database_1.default.organizationMember.count({
            where: { organizationId },
        });
        if (organization.subscription?.plan && memberCount >= organization.subscription.plan.maxTeamMembers) {
            throw new errorHandler_1.AppError('Team member limit reached. Please upgrade your plan.', 400);
        }
        // Check if user exists
        let invitedUser = await database_1.default.user.findUnique({
            where: { email },
        });
        // Check if already a member
        if (invitedUser) {
            const existingMember = await database_1.default.organizationMember.findUnique({
                where: {
                    organizationId_userId: {
                        organizationId,
                        userId: invitedUser.id,
                    },
                },
            });
            if (existingMember) {
                throw new errorHandler_1.AppError('User is already a member of this organization', 400);
            }
            // Add as member directly
            await database_1.default.organizationMember.create({
                data: {
                    organizationId,
                    userId: invitedUser.id,
                    role,
                    joinedAt: new Date(),
                },
            });
            // Send notification email
            await (0, email_1.sendEmail)({
                to: email,
                subject: `You've been added to ${organization.name} on WabMeta`,
                html: `
          <h2>You've been added to ${organization.name}</h2>
          <p>You are now a member of ${organization.name} with the role of ${role}.</p>
          <a href="${config_1.config.frontendUrl}/dashboard">Go to Dashboard</a>
        `,
            });
            return { message: 'Member added successfully' };
        }
        // TODO: Implement invite flow for non-registered users
        // For now, only registered users can be added
        throw new errorHandler_1.AppError('User not found. They need to register first.', 404);
    }
    // ==========================================
    // UPDATE MEMBER ROLE
    // ==========================================
    async updateMemberRole(organizationId, userId, memberId, role) {
        // Check user is owner
        const organization = await database_1.default.organization.findUnique({
            where: { id: organizationId },
        });
        if (!organization || organization.ownerId !== userId) {
            throw new errorHandler_1.AppError('Only owner can update member roles', 403);
        }
        // Cannot change owner role
        if (role === 'OWNER') {
            throw new errorHandler_1.AppError('Cannot assign OWNER role. Use transfer ownership instead.', 400);
        }
        // Find member
        const member = await database_1.default.organizationMember.findUnique({
            where: { id: memberId },
        });
        if (!member || member.organizationId !== organizationId) {
            throw new errorHandler_1.AppError('Member not found', 404);
        }
        // Cannot change own role
        if (member.userId === userId) {
            throw new errorHandler_1.AppError('Cannot change your own role', 400);
        }
        await database_1.default.organizationMember.update({
            where: { id: memberId },
            data: { role },
        });
        return { message: 'Member role updated successfully' };
    }
    // ==========================================
    // REMOVE MEMBER
    // ==========================================
    async removeMember(organizationId, userId, memberId) {
        // Check user is admin or owner
        const membership = await database_1.default.organizationMember.findUnique({
            where: {
                organizationId_userId: {
                    organizationId,
                    userId,
                },
            },
        });
        if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
            throw new errorHandler_1.AppError('Permission denied', 403);
        }
        // Find member to remove
        const memberToRemove = await database_1.default.organizationMember.findUnique({
            where: { id: memberId },
            include: { user: true },
        });
        if (!memberToRemove || memberToRemove.organizationId !== organizationId) {
            throw new errorHandler_1.AppError('Member not found', 404);
        }
        // Cannot remove self
        if (memberToRemove.userId === userId) {
            throw new errorHandler_1.AppError('Cannot remove yourself. Leave organization instead.', 400);
        }
        // Cannot remove owner
        if (memberToRemove.role === 'OWNER') {
            throw new errorHandler_1.AppError('Cannot remove organization owner', 400);
        }
        // Admin cannot remove other admins
        if (membership.role === 'ADMIN' && memberToRemove.role === 'ADMIN') {
            throw new errorHandler_1.AppError('Admins cannot remove other admins', 403);
        }
        await database_1.default.organizationMember.delete({
            where: { id: memberId },
        });
        return { message: 'Member removed successfully' };
    }
    // ==========================================
    // LEAVE ORGANIZATION
    // ==========================================
    async leaveOrganization(organizationId, userId) {
        const organization = await database_1.default.organization.findUnique({
            where: { id: organizationId },
        });
        if (!organization) {
            throw new errorHandler_1.AppError('Organization not found', 404);
        }
        // Owner cannot leave
        if (organization.ownerId === userId) {
            throw new errorHandler_1.AppError('Owner cannot leave. Transfer ownership first or delete organization.', 400);
        }
        const membership = await database_1.default.organizationMember.findUnique({
            where: {
                organizationId_userId: {
                    organizationId,
                    userId,
                },
            },
        });
        if (!membership) {
            throw new errorHandler_1.AppError('You are not a member of this organization', 400);
        }
        await database_1.default.organizationMember.delete({
            where: { id: membership.id },
        });
        return { message: 'Left organization successfully' };
    }
    // ==========================================
    // TRANSFER OWNERSHIP
    // ==========================================
    async transferOwnership(organizationId, userId, newOwnerId, password) {
        // Verify current owner
        const organization = await database_1.default.organization.findUnique({
            where: { id: organizationId },
        });
        if (!organization || organization.ownerId !== userId) {
            throw new errorHandler_1.AppError('Only owner can transfer ownership', 403);
        }
        // Verify password
        const user = await database_1.default.user.findUnique({
            where: { id: userId },
        });
        if (!user?.password) {
            throw new errorHandler_1.AppError('Cannot verify password', 400);
        }
        const isValid = await (0, password_1.comparePassword)(password, user.password);
        if (!isValid) {
            throw new errorHandler_1.AppError('Invalid password', 400);
        }
        // Check new owner is a member
        const newOwnerMembership = await database_1.default.organizationMember.findUnique({
            where: {
                organizationId_userId: {
                    organizationId,
                    userId: newOwnerId,
                },
            },
        });
        if (!newOwnerMembership) {
            throw new errorHandler_1.AppError('New owner must be a member of the organization', 400);
        }
        // Transfer ownership
        await database_1.default.$transaction([
            // Update organization owner
            database_1.default.organization.update({
                where: { id: organizationId },
                data: { ownerId: newOwnerId },
            }),
            // Update new owner role
            database_1.default.organizationMember.update({
                where: { id: newOwnerMembership.id },
                data: { role: 'OWNER' },
            }),
            // Update old owner role to ADMIN
            database_1.default.organizationMember.updateMany({
                where: {
                    organizationId,
                    userId,
                },
                data: { role: 'ADMIN' },
            }),
        ]);
        return { message: 'Ownership transferred successfully' };
    }
    // ==========================================
    // GET ORGANIZATION STATS
    // ==========================================
    async getStats(organizationId, userId) {
        // Check access
        const membership = await database_1.default.organizationMember.findUnique({
            where: {
                organizationId_userId: {
                    organizationId,
                    userId,
                },
            },
        });
        if (!membership) {
            throw new errorHandler_1.AppError('Access denied', 403);
        }
        const [organization, totalContacts, totalMessages, totalCampaigns, totalTemplates,] = await Promise.all([
            database_1.default.organization.findUnique({
                where: { id: organizationId },
                include: {
                    subscription: {
                        include: { plan: true },
                    },
                },
            }),
            database_1.default.contact.count({ where: { organizationId } }),
            database_1.default.message.count({
                where: { conversation: { organizationId } },
            }),
            database_1.default.campaign.count({ where: { organizationId } }),
            database_1.default.template.count({ where: { organizationId } }),
        ]);
        const plan = organization?.subscription?.plan;
        const subscription = organization?.subscription;
        return {
            totalContacts,
            totalMessages,
            totalCampaigns,
            totalTemplates,
            planUsage: {
                contactsUsed: subscription?.contactsUsed || 0,
                contactsLimit: plan?.maxContacts || 100,
                messagesUsed: subscription?.messagesUsed || 0,
                messagesLimit: plan?.maxMessages || 1000,
            },
        };
    }
    // ==========================================
    // DELETE ORGANIZATION
    // ==========================================
    async delete(organizationId, userId, password) {
        const organization = await database_1.default.organization.findUnique({
            where: { id: organizationId },
        });
        if (!organization || organization.ownerId !== userId) {
            throw new errorHandler_1.AppError('Only owner can delete organization', 403);
        }
        // Verify password
        const user = await database_1.default.user.findUnique({
            where: { id: userId },
        });
        if (user?.password) {
            const isValid = await (0, password_1.comparePassword)(password, user.password);
            if (!isValid) {
                throw new errorHandler_1.AppError('Invalid password', 400);
            }
        }
        // Delete organization (cascades to all related data)
        await database_1.default.organization.delete({
            where: { id: organizationId },
        });
        return { message: 'Organization deleted successfully' };
    }
}
exports.OrganizationsService = OrganizationsService;
// Export singleton instance
exports.organizationsService = new OrganizationsService();
//# sourceMappingURL=organizations.service.js.map