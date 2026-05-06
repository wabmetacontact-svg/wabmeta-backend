"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const prisma = new client_1.PrismaClient();
async function run() {
    console.log('Using database URL for manual SQL...');
    try {
        // 1. Add isActive to WhatsAppAccount
        console.log('Adding WhatsAppAccount.isActive...');
        await prisma.$executeRawUnsafe(`ALTER TABLE "WhatsAppAccount" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true`);
        // 2. Update Message model fields
        console.log('Updating Message fields...');
        await prisma.$executeRawUnsafe(`ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "mediaId" TEXT`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "fileName" TEXT`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "whatsappMessageId" TEXT`);
        // 3. Add unique index for whatsappMessageId
        console.log('Adding unique index...');
        try {
            await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Message_whatsappMessageId_key" ON "Message"("whatsappMessageId")`);
        }
        catch (e) {
            console.log('Index note:', e.message);
        }
        console.log('✅ DATABASE SCHEMA UPDATED SUCCESSFULLY');
    }
    catch (err) {
        console.error('❌ DATABASE UPDATE FAILED:', err.message);
    }
    finally {
        await prisma.$disconnect();
    }
}
run();
//# sourceMappingURL=fix-db.js.map