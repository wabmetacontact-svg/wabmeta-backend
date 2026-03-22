import { PrismaClient, PlanType } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: databaseUrl,
        },
    },
});
async function main() {
    console.log('🌱 Seeding new billing plans...');

    const plans = [
        {
            name: 'Free Demo',
            type: PlanType.FREE_DEMO,
            slug: 'free-demo',
            description: '2-day trial with basic features to test the platform',
            monthlyPrice: 0,
            yearlyPrice: 0,
            validityDays: 2,
            maxContacts: 1000,
            maxMessages: 100,
            maxMessagesPerMonth: 100,
            maxTeamMembers: 1,
            maxCampaigns: 1,
            maxCampaignsPerMonth: 1,
            maxChatbots: 0,
            maxTemplates: 2,
            maxWhatsAppAccounts: 1,
            maxAutomations: 0,
            maxApiCalls: 0,
            isActive: true,
            isRecommended: false,
            discount: 0,
            hasAdvancedAutomation: false,
            hasCampaignRetry: false,
            hasMobileApiAccess: false,
            supportLevel: 'basic',
            features: [
                '100 messages',
                '1 campaign',
                '1,000 contacts',
                'Basic support',
                '2-day trial period'
            ],
        },
        {
            name: 'Monthly Plan',
            type: PlanType.MONTHLY,
            slug: 'monthly',
            description: 'Perfect for small businesses getting started',
            monthlyPrice: 899,
            yearlyPrice: 899,
            validityDays: 30,
            maxContacts: 999999,
            maxMessages: 999999,
            maxMessagesPerMonth: 999999,
            maxTeamMembers: 3,
            maxCampaigns: 999999,
            maxCampaignsPerMonth: 999999,
            maxChatbots: 2,
            maxTemplates: 999999,
            maxWhatsAppAccounts: 1,
            maxAutomations: 0,
            maxApiCalls: 5000,
            isActive: true,
            isRecommended: false,
            discount: 0,
            hasAdvancedAutomation: false,
            hasCampaignRetry: false,
            hasMobileApiAccess: false,
            supportLevel: 'standard',
            features: [
                'Unlimited* messages',
                'Unlimited campaigns',
                'Unlimited contacts',
                'Webhooks',
                'Flow Builder',
                'Standard support',
                '1 WhatsApp account'
            ],
        },
        {
            name: '3-Month Plan',
            type: PlanType.QUARTERLY,
            slug: '3-month',
            description: 'Save ₹197 with quarterly billing',
            monthlyPrice: 2500,
            yearlyPrice: 2500,
            validityDays: 90,
            maxContacts: 999999,
            maxMessages: 999999,
            maxMessagesPerMonth: 999999,
            maxTeamMembers: 5,
            maxCampaigns: 999999,
            maxCampaignsPerMonth: 999999,
            maxChatbots: 5,
            maxTemplates: 999999,
            maxWhatsAppAccounts: 1,
            maxAutomations: 10,
            maxApiCalls: 10000,
            isActive: true,
            isRecommended: false,
            discount: 7,
            hasAdvancedAutomation: true,
            hasCampaignRetry: false,
            hasMobileApiAccess: false,
            supportLevel: 'standard',
            features: [
                'Unlimited* messages',
                'Unlimited campaigns',
                'Unlimited contacts',
                'Basic automation',
                'Webhooks',
                'Flow Builder',
                'Standard support',
                'Save 7% vs monthly'
            ],
        },
        {
            name: '6-Month Plan ⭐',
            type: PlanType.BIANNUAL,
            slug: '6-month',
            description: 'Most popular - Best value with premium features',
            monthlyPrice: 5000,
            yearlyPrice: 5000,
            validityDays: 180,
            maxContacts: 999999,
            maxMessages: 999999,
            maxMessagesPerMonth: 999999,
            maxTeamMembers: 10,
            maxCampaigns: 999999,
            maxCampaignsPerMonth: 999999,
            maxChatbots: 10,
            maxTemplates: 999999,
            maxWhatsAppAccounts: 1,
            maxAutomations: 50,
            maxApiCalls: 25000,
            isActive: true,
            isRecommended: true, // ⭐ RECOMMENDED
            discount: 15,
            hasAdvancedAutomation: true,
            hasCampaignRetry: true,
            hasMobileApiAccess: true,
            supportLevel: 'priority',
            features: [
                'Unlimited* messages',
                'Unlimited campaigns',
                'Unlimited contacts',
                'Advanced automation',
                'Campaign retry ✅',
                'Webhooks',
                'Flow Builder',
                'Mobile + API same number ✅',
                'High number safety',
                'Priority support',
                'Save 15% vs monthly'
            ],
        },
        {
            name: '1-Year Plan ⭐',
            type: PlanType.ANNUAL,
            slug: '1-year',
            description: 'Best value - Maximum savings with all features',
            monthlyPrice: 8999,
            yearlyPrice: 8999,
            validityDays: 365,
            maxContacts: 999999,
            maxMessages: 999999,
            maxMessagesPerMonth: 999999,
            maxTeamMembers: 999999,
            maxCampaigns: 999999,
            maxCampaignsPerMonth: 999999,
            maxChatbots: 999999,
            maxTemplates: 999999,
            maxWhatsAppAccounts: 2,
            maxAutomations: 999999,
            maxApiCalls: 100000,
            isActive: true,
            isRecommended: true, // ⭐ RECOMMENDED
            discount: 25,
            hasAdvancedAutomation: true,
            hasCampaignRetry: true,
            hasMobileApiAccess: true,
            supportLevel: 'priority',
            features: [
                'Unlimited* messages',
                'Unlimited campaigns',
                'Unlimited contacts',
                'Full automation',
                'Campaign retry ✅',
                'Webhooks',
                'Flow Builder',
                'Mobile + API same number ✅',
                'Maximum number safety',
                'Priority support',
                '2 WhatsApp accounts',
                'Save 25% vs monthly'
            ],
        },
    ];

    for (const plan of plans) {
        // Strip out fields that don't exist in the current Prisma schema
        const { 
            discount, 
            hasAdvancedAutomation, 
            hasCampaignRetry, 
            hasMobileApiAccess, 
            supportLevel, 
            ...validPlanData 
        } = plan as any;

        await prisma.plan.upsert({
            where: { type: plan.type },
            update: validPlanData,
            create: validPlanData,
        });
        console.log(`✅ ${plan.name} created/updated`);
    }

    console.log('\n🎉 Plans seeded successfully!');
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });