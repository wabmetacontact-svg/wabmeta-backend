// src/modules/admin/admin.service.ts

import prisma from '../../config/database';
import { config } from '../../config';
import { AppError } from '../../middleware/errorHandler';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { hashPassword } from '../../utils/password';
import { emitForceLogout } from '../../socket';

// ============================================
// TYPES
// ============================================

interface LoginInput {
  email: string;
  password: string;
}

interface GetUsersInput {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface GetOrganizationsInput {
  page: number;
  limit: number;
  search?: string;
  planType?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface GetActivityLogsInput {
  page: number;
  limit: number;
  action?: string;
  userId?: string;
  organizationId?: string;
  startDate?: string;
  endDate?: string;
}

// In-memory system settings (use database in production)
let systemSettings = {
  maintenanceMode: false,
  allowRegistration: true,
  maxOrganizationsPerUser: 5,
  defaultPlanType: 'FREE',
  smtpEnabled: true,
};

// ============================================
// ADMIN SERVICE CLASS
// ============================================

export class AdminService {
  // ==========================================
  // ADMIN AUTH
  // ==========================================

  async login(input: LoginInput) {
    const { email, password } = input;

    const admin = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!admin) {
      throw new AppError('Invalid credentials', 401);
    }

    if (!admin.isActive) {
      throw new AppError('Admin account is inactive', 403);
    }

    const isValidPassword = await bcrypt.compare(password, admin.password);

    if (!isValidPassword) {
      throw new AppError('Invalid credentials', 401);
    }

    // Generate token
    const token = jwt.sign(
      {
        adminId: admin.id,
        email: admin.email,
        role: admin.role,
      },
      config.jwt.secret,
      { expiresIn: '24h' }
    );

    // Update last login
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    };
  }

  async getAdminById(id: string) {
    const admin = await prisma.adminUser.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    return admin;
  }

  // ==========================================
  // DASHBOARD STATS
  // ==========================================

  async getDashboardStats() {
    try {
      // User stats
      const [totalUsers, activeUsers, pendingUsers, suspendedUsers] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { status: 'ACTIVE' } }),
        prisma.user.count({ where: { status: 'PENDING_VERIFICATION' } }),
        prisma.user.count({ where: { status: 'SUSPENDED' } }),
      ]);

      // ✅ FIXED: Calculate revenue from actual payments
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // ✅ Today's new users
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const todayUsers = await prisma.user.count({
        where: {
          createdAt: {
            gte: today,
            lt: tomorrow
          }
        }
      });
      const usersThisMonth = await prisma.user.count({
        where: { createdAt: { gte: startOfMonth } },
      });

      // Organization stats
      const [totalOrgs, orgsThisMonth] = await Promise.all([
        prisma.organization.count(),
        prisma.organization.count({
          where: { createdAt: { gte: startOfMonth } },
        }),
      ]);

      // Organizations by plan
      const orgsByPlan = await prisma.organization.groupBy({
        by: ['planType'],
        _count: { id: true },
      });

      const byPlan: Record<string, number> = {};
      orgsByPlan.forEach((item) => {
        byPlan[item.planType] = item._count.id;
      });

      // Message stats
      const [totalMessages, messagesToday, messagesThisMonth] = await Promise.all([
        prisma.message.count({ where: { direction: 'OUTBOUND' } }),
        prisma.message.count({
          where: {
            direction: 'OUTBOUND',
            createdAt: {
              gte: today,
            },
          },
        }),
        prisma.message.count({
          where: {
            direction: 'OUTBOUND',
            createdAt: { gte: startOfMonth },
          },
        }),
      ]);

      // WhatsApp stats
      const [totalContacts, totalCampaigns] = await Promise.all([
        prisma.contact.count(),
        prisma.campaign.count(),
      ]);

      // ✅ Get ACTUAL revenue from Payment table (Exclude manual/admin assigned)
      const [totalRevenue, monthlyRevenue, todayRevenue] = await Promise.all([
        // Total all-time revenue (Only from Razorpay)
        prisma.payment.aggregate({
          where: {
            status: 'SUCCESS',
            razorpayPaymentId: { not: null } // ✅ Only count actual purchases
          },
          _sum: {
            amount: true
          }
        }),
        
        // This month's revenue (Only from Razorpay)
        prisma.payment.aggregate({
          where: {
            status: 'SUCCESS',
            razorpayPaymentId: { not: null }, // ✅ Only count actual purchases
            createdAt: {
              gte: startOfMonth
            }
          },
          _sum: {
            amount: true
          }
        }),
        
        // Today's revenue (Only from Razorpay)
        prisma.payment.aggregate({
          where: {
            status: 'SUCCESS',
            razorpayPaymentId: { not: null }, // ✅ Only count actual purchases
            createdAt: {
              gte: today,
              lt: tomorrow
            }
          },
          _sum: {
            amount: true
          }
        })
      ]);

      // ✅ Get subscription breakdown (Exclude manual/admin assigned for MRR)
      const subscriptionsByPlan = await prisma.subscription.groupBy({
        by: ['planId'],
        where: {
          status: 'ACTIVE',
          paymentMethod: { not: 'admin_assigned' } // ✅ Only count actual paid subscriptions for MRR
        },
        _count: true
      });

      // Get plan details for MRR calculation
      const plans = await prisma.plan.findMany();
      const planMap = new Map(plans.map(p => [p.id, p]));

      // ✅ Calculate actual MRR from active subscriptions
      let mrr = 0;
      for (const sub of subscriptionsByPlan) {
        if (!sub.planId) continue;
        const plan = planMap.get(sub.planId);
        if (plan) {
          mrr += Number(plan.monthlyPrice) * sub._count;
        }
      }

      // ✅ WhatsApp connection stats with connectionType
      const whatsappStats = await prisma.whatsAppAccount.groupBy({
        by: ['connectionType', 'status'],
        _count: true
      });

      const connectedCloudApi = whatsappStats.find(
        (s: any) => s.connectionType === 'CLOUD_API' && s.status === 'CONNECTED'
      )?._count || 0;

      const connectedBusinessApp = whatsappStats.find(
        (s: any) => s.connectionType === 'WHATSAPP_BUSINESS_APP' && s.status === 'CONNECTED'
      )?._count || 0;

      // ✅ ADD: Wallet Stats
      const [
        totalActiveWallets,
        pendingWalletRequests,
        totalWalletBalance,
      ] = await Promise.all([
        prisma.wallet.count({ where: { isActive: true } }),
        prisma.walletAccessRequest.count({ where: { status: 'pending' } }),
        prisma.wallet.aggregate({
          where: { isActive: true },
          _sum: { balancePaise: true },
        }),
      ]);

      return {
        users: {
          total: totalUsers,
          active: activeUsers,
          pending: pendingUsers,
          suspended: suspendedUsers,
          newThisMonth: usersThisMonth,
          todayUsers, // ✅ Today's new users
        },
        organizations: {
          total: totalOrgs,
          byPlan,
          newThisMonth: orgsThisMonth,
        },
        messages: {
          totalSent: totalMessages,
          todaySent: messagesToday,
          thisMonthSent: messagesThisMonth,
        },
        revenue: {
          // ✅ Actual revenue from payments (in paise, divide by 100 for rupees)
          totalRevenue: totalRevenue._sum.amount || 0,
          monthlyRevenue: monthlyRevenue._sum.amount || 0,
          todayRevenue: todayRevenue._sum.amount || 0,
          mrr, // ✅ Actual MRR from active subscriptions
          arr: mrr * 12,
        },
        whatsapp: {
          connectedAccounts: connectedCloudApi + connectedBusinessApp,
          cloudApiConnected: connectedCloudApi,
          businessAppConnected: connectedBusinessApp,
          totalContacts,
          totalCampaigns,
        },
        wallet: {
          totalActiveWallets,
          pendingRequests: pendingWalletRequests,
          totalBalanceHeld: (totalWalletBalance._sum.balancePaise || 0) / 100,
        },
      };
    } catch (error) {
      console.error('Dashboard stats error:', error);
      // Return safe defaults
      return {
        users: { total: 0, active: 0, pending: 0, suspended: 0, newThisMonth: 0, todayUsers: 0 },
        organizations: { total: 0, byPlan: {}, newThisMonth: 0 },
        messages: { totalSent: 0, todaySent: 0, thisMonthSent: 0 },
        revenue: { totalRevenue: 0, monthlyRevenue: 0, todayRevenue: 0, mrr: 0, arr: 0 },
        whatsapp: { connectedAccounts: 0, cloudApiConnected: 0, businessAppConnected: 0, totalContacts: 0, totalCampaigns: 0 },
        wallet: { totalActiveWallets: 0, pendingRequests: 0, totalBalanceHeld: 0 },
      };
    }
  }

  // ==========================================
  // USER MANAGEMENT
  // ==========================================

  async getUsers(input: GetUsersInput) {
    const { page, limit, search, status, sortBy = 'createdAt', sortOrder = 'desc' } = input;

    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status.toUpperCase();
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          avatar: true,
          status: true,
          emailVerified: true,
          createdAt: true,
          lastLoginAt: true,
          password: true,
          memberships: {
            select: {
              role: true,
              organization: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Transform memberships to organizations
    const transformedUsers = users.map((user) => ({
      ...user,
      organizations: user.memberships?.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        role: m.role,
      })) || [],
      memberships: undefined,
    }));

    return { users: transformedUsers, total };
  }

  async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                planType: true,
              },
            },
          },
        },
        ownedOrganizations: {
          select: {
            id: true,
            name: true,
            slug: true,
            planType: true,
          },
        },
        _count: {
          select: {
            refreshTokens: true,
            activityLogs: true,
            notifications: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return {
      ...user,
      organizations: user.memberships?.map((m) => ({
        ...m.organization,
        role: m.role,
      })),
    };
  }

  async updateUserPassword(id: string, data: any) {
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const hashedPassword = await hashPassword(data.password);
    const shouldLogout = data.logoutDevices !== false; // default: true

    // ✅ Update password + increment tokenVersion (old tokens invalid ho jayenge)
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        // ✅ tokenVersion increment karo → old JWT tokens invalid
        tokenVersion: {
          increment: 1,
        },
      },
      select: {
        id: true,
        email: true,
        tokenVersion: true,
      },
    });

    // ✅ Sabhi refresh tokens delete karo
    if (shouldLogout) {
      await prisma.refreshToken.deleteMany({
        where: { userId: id },
      });

      console.log(`🗑️ All refresh tokens deleted for user: ${id}`);
    }

    // ✅ Socket ke through force logout emit karo
    // User ke sabhi connected devices pe event jayega
    try {
      emitForceLogout(id, 'password_changed');
      console.log(`📡 Force logout emitted for user: ${id}`);
    } catch (socketError: any) {
      // Socket fail hone pe bhi password change successful maana jayega
      // Kyunki tokenVersion increment aur refreshToken delete ho chuka hai
      console.warn(`⚠️ Socket emit failed (non-critical): ${socketError.message}`);
    }

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      message: shouldLogout
        ? 'Password updated and user logged out from all devices'
        : 'Password updated successfully',
    };
  }

  async updateUser(id: string, data: any) {
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        status: data.status,
        emailVerified: data.emailVerified,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
        emailVerified: true,
      },
    });

    return updatedUser;
  }

  async updateUserStatus(id: string, status: string) {
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { status: status as any }, // Cast to UserStatus enum
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
      },
    });

    return updatedUser;
  }

  async suspendUser(id: string) {
    return this.updateUserStatus(id, 'SUSPENDED');
  }

  activateUser(id: string) {
    return this.updateUserStatus(id, 'ACTIVE');
  }

  // ==========================================
  // OWNERSHIP TRANSFER
  // ==========================================

  /**
   * Transfer organization ownership to another user
   */
  async transferOrganizationOwnership(
    organizationId: string,
    newOwnerId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Get current owner first
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { ownerId: true },
      });

      if (!org) {
        throw new AppError('Organization not found', 404);
      }

      const oldOwnerId = org.ownerId;

      // Check if new owner is already a member
      const membership = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId: newOwnerId,
        },
      });

      if (!membership) {
        throw new AppError('New owner must be a member of the organization first', 400);
      }

      // Perform transfer in transaction
      await prisma.$transaction(async (tx) => {
        // Update organization owner
        await tx.organization.update({
          where: { id: organizationId },
          data: { ownerId: newOwnerId },
        });

        // Update old owner's membership role to ADMIN (if not the same person)
        if (oldOwnerId !== newOwnerId) {
          await tx.organizationMember.updateMany({
            where: {
              organizationId,
              userId: oldOwnerId,
            },
            data: { role: 'ADMIN' as any },
          });
        }

        // Update new owner's membership role to OWNER
        await tx.organizationMember.updateMany({
          where: {
            organizationId,
            userId: newOwnerId,
          },
          data: { role: 'OWNER' as any },
        });
      });

      return {
        success: true,
        message: 'Ownership transferred successfully',
      };
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(error.message || 'Failed to transfer ownership', 500);
    }
  }

  async deleteUser(userId: string, options?: { force?: boolean; transferOwnership?: boolean }) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        ownedOrganizations: true,
        memberships: true,
        createdCampaigns: true,
        createdChatbots: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // ✅ Check if user owns any organizations
    if (user.ownedOrganizations && user.ownedOrganizations.length > 0) {
      // ✅ OPTION A: Force delete (delete organizations too)
      if (options?.force) {
        console.log(`⚠️ Force deleting user ${userId} and ${user.ownedOrganizations.length} owned organizations`);

        // Delete all owned organizations (cascade will handle members, subscriptions, etc.)
        await prisma.organization.deleteMany({
          where: { ownerId: userId },
        });
      }
      // ✅ OPTION B: Auto-transfer to first admin member
      else if (options?.transferOwnership) {
        console.log(`🔄 Auto-transferring ownership for ${user.ownedOrganizations.length} organizations`);

        for (const org of user.ownedOrganizations) {
          // Find first admin member to transfer ownership
          const newOwner = await prisma.organizationMember.findFirst({
            where: {
              organizationId: org.id,
              userId: { not: userId },
              role: { in: ['ADMIN', 'OWNER'] as any },
            },
          });

          if (newOwner) {
            await this.transferOrganizationOwnership(org.id, newOwner.userId);
          } else {
            // No suitable member found, delete the organization
            console.log(`⚠️ No suitable member to transfer ownership for org ${org.id}, deleting it`);
            await prisma.organization.delete({ where: { id: org.id } });
          }
        }
      }
      // ✅ OPTION C: Block deletion (current behavior)
      else {
        throw new AppError(
          `Cannot delete user who owns ${user.ownedOrganizations.length} organization(s). Use ?force=true or ?transferOwnership=true`,
          400
        );
      }
    }

    // ✅ Additional safety: Handle campaigns and chatbots
    if (!options?.force) {
      if (user.createdCampaigns && user.createdCampaigns.length > 0) {
        throw new AppError(
          `Cannot delete user who created ${user.createdCampaigns.length} campaign(s). Use ?force=true to delete everything.`,
          400
        );
      }

      if (user.createdChatbots && user.createdChatbots.length > 0) {
        throw new AppError(
          `Cannot delete user who created ${user.createdChatbots.length} chatbot(s). Use ?force=true to delete everything.`,
          400
        );
      }
    }

    // Delete user (cascade will handle refresh tokens, members, etc.)
    // Note: We still use transaction for extra cleanup if needed
    try {
      await prisma.$transaction(async (tx) => {
        // If force is on, delete user-created content that isn't cascaded
        if (options?.force) {
          await tx.campaign.deleteMany({ where: { createdById: userId } });
          await tx.chatbot.deleteMany({ where: { createdById: userId } });
        }

        // Delete other associated data
        await tx.refreshToken.deleteMany({ where: { userId } });
        await tx.notification.deleteMany({ where: { userId } });
        await tx.activityLog.deleteMany({ where: { userId } });

        // Finally, delete the user
        await tx.user.delete({
          where: { id: userId },
        });
      });

      console.log(`✅ User deleted: ${userId}`);
      return { success: true, message: 'User deleted successfully' };
    } catch (error: any) {
      console.error('Error deleting user:', error);
      throw new AppError(error.message || 'Failed to delete user', 500);
    }
  }

  // ==========================================
  // ORGANIZATION MANAGEMENT
  // ==========================================

  async getOrganizations(input: GetOrganizationsInput) {
    const { page, limit, search, planType, sortBy = 'createdAt', sortOrder = 'desc' } = input;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (planType) {
      where.planType = planType.toUpperCase();
    }

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          subscription: {
            include: {
              plan: {
                select: {
                  name: true,
                  type: true,
                },
              },
            },
          },
          _count: {
            select: {
              members: true,
              contacts: true,
              campaigns: true,
              whatsappAccounts: true,
            },
          },
        },
      }),
      prisma.organization.count({ where }),
    ]);

    return { organizations, total };
  }

  async getOrganizationById(id: string) {
    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
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
        },
        subscription: {
          include: {
            plan: true,
          },
        },
        whatsappAccounts: {
          select: {
            id: true,
            phoneNumber: true,
            displayName: true,
            status: true,
          },
        },
        _count: {
          select: {
            contacts: true,
            campaigns: true,
            templates: true,
            chatbots: true,
          },
        },
      },
    });

    if (!org) {
      throw new AppError('Organization not found', 404);
    }

    return org;
  }

  async updateOrganization(id: string, data: any) {
    const org = await prisma.organization.findUnique({ where: { id } });

    if (!org) {
      throw new AppError('Organization not found', 404);
    }

    const updated = await prisma.organization.update({
      where: { id },
      data: {
        name: data.name,
        website: data.website,
        industry: data.industry,
        timezone: data.timezone,
        planType: data.planType,
      },
    });

    return updated;
  }

  async deleteOrganization(id: string) {
    const org = await prisma.organization.findUnique({ where: { id } });

    if (!org) {
      throw new AppError('Organization not found', 404);
    }

    // Delete organization and cascade
    await prisma.organization.delete({ where: { id } });

    return { message: 'Organization deleted successfully' };
  }

  async updateSubscription(id: string, data: any) {
    const org = await prisma.organization.findUnique({
      where: { id },
      include: { subscription: true },
    });

    if (!org) {
      throw new AppError('Organization not found', 404);
    }

    if (data.planId) {
      const plan = await prisma.plan.findUnique({ where: { id: data.planId } });
      if (!plan) {
        throw new AppError('Plan not found', 404);
      }

      // Update organization plan type
      await prisma.organization.update({
        where: { id },
        data: { planType: plan.type },
      });

      // Update or create subscription
      if (org.subscription) {
        await prisma.subscription.update({
          where: { id: org.subscription.id },
          data: {
            planId: data.planId,
            status: data.status || 'ACTIVE',
          },
        });
      } else {
        await prisma.subscription.create({
          data: {
            organizationId: id,
            planId: data.planId,
            status: 'ACTIVE',
            billingCycle: data.billingCycle || 'monthly',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
      }
    }

    return this.getOrganizationById(id);
  }

  // ==========================================
  // PLAN MANAGEMENT
  // ==========================================

  async getPlans() {
    const plans = await prisma.plan.findMany({
      orderBy: { monthlyPrice: 'asc' },
      include: {
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    });

    return plans;
  }

  async createPlan(data: any) {
    const existing = await prisma.plan.findFirst({
      where: {
        OR: [{ type: data.type }, { slug: data.slug }],
      },
    });

    if (existing) {
      throw new AppError('Plan with this type or slug already exists', 400);
    }

    const plan = await prisma.plan.create({
      data: {
        name: data.name,
        type: data.type,
        slug: data.slug,
        description: data.description,
        monthlyPrice: data.monthlyPrice,
        yearlyPrice: data.yearlyPrice,
        maxContacts: data.maxContacts,
        maxMessages: data.maxMessages,
        maxTeamMembers: data.maxTeamMembers,
        maxCampaigns: data.maxCampaigns,
        maxChatbots: data.maxChatbots,
        maxTemplates: data.maxTemplates,
        maxWhatsAppAccounts: data.maxWhatsAppAccounts,
        maxMessagesPerMonth: data.maxMessagesPerMonth,
        maxCampaignsPerMonth: data.maxCampaignsPerMonth,
        maxAutomations: data.maxAutomations,
        maxApiCalls: data.maxApiCalls,
        features: data.features || [],
        isActive: data.isActive ?? true,
      },
    });

    return plan;
  }

  async updatePlan(id: string, data: any) {
    const plan = await prisma.plan.findUnique({ where: { id } });

    if (!plan) {
      throw new AppError('Plan not found', 404);
    }

    const updated = await prisma.plan.update({
      where: { id },
      data,
    });

    return updated;
  }

  async deletePlan(id: string) {
    const plan = await prisma.plan.findUnique({
      where: { id },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
    });

    if (!plan) {
      throw new AppError('Plan not found', 404);
    }

    if (plan._count.subscriptions > 0) {
      throw new AppError('Cannot delete plan with active subscriptions', 400);
    }

    await prisma.plan.delete({ where: { id } });

    return { message: 'Plan deleted successfully' };
  }

  // ==========================================
  // ADMIN MANAGEMENT
  // ==========================================

  async getAdmins() {
    const admins = await prisma.adminUser.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return admins;
  }

  async createAdmin(data: any) {
    const existing = await prisma.adminUser.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existing) {
      throw new AppError('Admin with this email already exists', 400);
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const admin = await prisma.adminUser.create({
      data: {
        email: data.email.toLowerCase(),
        password: hashedPassword,
        name: data.name,
        role: data.role || 'admin',
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return admin;
  }

  async updateAdmin(id: string, data: any) {
    const admin = await prisma.adminUser.findUnique({ where: { id } });

    if (!admin) {
      throw new AppError('Admin not found', 404);
    }

    const updateData: any = {};

    if (data.name) updateData.name = data.name;
    if (data.role) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 12);
    }

    const updated = await prisma.adminUser.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    return updated;
  }

  async deleteAdmin(id: string) {
    const admin = await prisma.adminUser.findUnique({ where: { id } });

    if (!admin) {
      throw new AppError('Admin not found', 404);
    }

    // Count remaining super admins
    const superAdminCount = await prisma.adminUser.count({
      where: { role: 'super_admin', isActive: true },
    });

    if (admin.role === 'super_admin' && superAdminCount <= 1) {
      throw new AppError('Cannot delete the last super admin', 400);
    }

    await prisma.adminUser.delete({ where: { id } });

    return { message: 'Admin deleted successfully' };
  }

  // ==========================================
  // ACTIVITY LOGS
  // ==========================================

  async getActivityLogs(input: GetActivityLogsInput) {
    const { page, limit, action, userId, organizationId, startDate, endDate } = input;

    const where: any = {};

    if (action) {
      where.action = action;
    }

    if (userId) {
      where.userId = userId;
    }

    if (organizationId) {
      where.organizationId = organizationId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.activityLog.count({ where }),
    ]);

    return { logs, total };
  }

  // ==========================================
  // SYSTEM SETTINGS
  // ==========================================

  getSystemSettings() {
    return systemSettings;
  }

  updateSystemSettings(data: any) {
    systemSettings = {
      ...systemSettings,
      ...data,
    };
    return systemSettings;
  }

  // ==========================================
  // WHATSAPP STATS AND OVERRIDES
  // ==========================================

  async getWhatsAppConnectionStats() {
    const stats = await prisma.whatsAppAccount.groupBy({
      by: ['connectionType', 'status'],
      _count: true,
    });

    const formatted = {
      cloudApi: { active: 0, inactive: 0, total: 0 },
      businessApp: { active: 0, inactive: 0, total: 0 },
      onPremise: { active: 0, inactive: 0, total: 0 },
    };

    stats.forEach((stat) => {
      const type = (stat.connectionType || 'CLOUD_API').toUpperCase();
      let key: 'cloudApi' | 'businessApp' | 'onPremise' = 'cloudApi';
      
      if (type === 'WHATSAPP_BUSINESS_APP' || type === 'BUSINESS_APP') {
        key = 'businessApp';
      } else if (type === 'ON_PREMISE') {
        key = 'onPremise';
      }

      formatted[key].total += stat._count;
      if (stat.status === 'CONNECTED' || stat.status === ('active' as any)) {
        formatted[key].active += stat._count;
      } else {
        formatted[key].inactive += stat._count;
      }
    });

    return formatted;
  }

  async updateWhatsAppConnectionType(accountId: string, connectionType: string) {
    const account = await prisma.whatsAppAccount.findUnique({ where: { id: accountId } });
    if (!account) {
      throw new AppError('WhatsApp account not found', 404);
    }

    const updated = await prisma.whatsAppAccount.update({
      where: { id: accountId },
      data: { connectionType },
    });

    return {
      success: true,
      message: 'Connection type updated successfully',
      account: updated,
    };
  }
}

export const adminService = new AdminService();