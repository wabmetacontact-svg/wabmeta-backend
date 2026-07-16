// src/modules/campaigns/campaigns.upload.service.ts - COMPLETE FIXED

import { Readable } from 'stream';
import csv from 'csv-parser';
import { v4 as uuidv4 } from 'uuid';
import { campaignSocketService } from './campaigns.socket';
import prisma from '../../config/database';

interface CsvRow {
    phone?: string;
    name?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    [key: string]: any;
}

interface ValidationResult {
    phone: string;          // ✅ normalized 10-digit
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    isValid: boolean;
    isDuplicate: boolean;
    error?: string;
}

export class CampaignUploadService {
    // ----------------------------
    // Helpers
    // ----------------------------

    private getValueByPossibleHeaders(row: CsvRow, headers: string[]): string {
        // direct match
        for (const h of headers) {
            if (row[h] !== undefined && row[h] !== null) return String(row[h]);
        }

        // fallback: case-insensitive + BOM safe
        const keys = Object.keys(row || {});
        for (const key of keys) {
            const k = key.replace(/^\uFEFF/, '').trim().toLowerCase();
            if (headers.map(h => h.toLowerCase()).includes(k)) {
                return String(row[key]);
            }
        }

        return '';
    }

    private normalizeIndianPhone(value: any): string {
        const raw = String(value ?? '').trim();
        let cleaned = raw.replace(/[\s\-\(\)]/g, '');
        cleaned = cleaned.replace(/[^0-9+]/g, '');

        if (cleaned.startsWith('+91')) cleaned = cleaned.slice(3);
        else if (cleaned.startsWith('91') && cleaned.length === 12) cleaned = cleaned.slice(2);

        if (cleaned.startsWith('0') && cleaned.length === 11) cleaned = cleaned.slice(1);

        return cleaned;
    }

    private isValidIndian10Digit(phone10: string): boolean {
        return /^[6-9]\d{9}$/.test(phone10);
    }

    private normalizeEmail(value: any): string | undefined {
        const s = String(value ?? '').trim();
        if (!s) return undefined;
        // basic email check
        const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
        return ok ? s : undefined;
    }

    // ----------------------------
    // Process CSV
    // ----------------------------
    async processCsvFile(
        fileBuffer: Buffer,
        userId: string,
        organizationId: string
    ): Promise<{
        uploadId: string;
        totalRows: number;
        validRows: number;
        invalidRows: number;
        duplicateRows: number;
        contacts: Array<{ id: string; phone: string; firstName: string }>;
    }> {
        const uploadId = uuidv4();
        const rows: CsvRow[] = [];
        const validationResults: ValidationResult[] = [];

        return new Promise((resolve, reject) => {
            const stream = Readable.from(fileBuffer);

            let totalRows = 0;
            let processedRows = 0;
            let validRows = 0;
            let invalidRows = 0;
            let duplicateRows = 0;

            stream
                .pipe(csv())
                .on('data', (row: CsvRow) => {
                    rows.push(row);
                    totalRows++;
                })
                .on('end', async () => {
                    console.log(`📊 CSV parsed: ${totalRows} rows`);

                    // Emit initial progress
                    campaignSocketService?.emitCsvUploadProgress?.(userId, {
                        uploadId,
                        progress: 0,
                        totalRows,
                        processedRows: 0,
                        validRows: 0,
                        invalidRows: 0,
                        duplicateRows: 0,
                        status: 'processing',
                    });

                    // ✅ Normalize existing phones to 10-digit
                    const existingContacts = await prisma.contact.findMany({
                        where: { organizationId },
                        select: { phone: true, countryCode: true },
                    });

                    const existingPhones10 = new Set<string>(
                        existingContacts
                            .map((c) => this.normalizeIndianPhone(c.phone))
                            .filter((p) => p && p.length === 10)
                    );

                    const seenPhones10 = new Set<string>();

                    for (const row of rows) {
                        const result = this.validateContact(row, existingPhones10, seenPhones10);
                        validationResults.push(result);

                        if (result.isValid && !result.isDuplicate) {
                            validRows++;
                            seenPhones10.add(result.phone);
                        } else if (result.isDuplicate) {
                            duplicateRows++;
                        } else {
                            invalidRows++;
                        }

                        processedRows++;

                        if (processedRows % 10 === 0 || processedRows === totalRows) {
                            const progress = Math.round((processedRows / totalRows) * 100);

                            campaignSocketService?.emitCsvUploadProgress?.(userId, {
                                uploadId,
                                progress,
                                totalRows,
                                processedRows,
                                validRows,
                                invalidRows,
                                duplicateRows,
                                status: processedRows === totalRows ? 'completed' : 'processing',
                            });

                            if (processedRows % 50 === 0 || processedRows === totalRows) {
                                const batch = validationResults.slice(-50);
                                (campaignSocketService as any)?.emitContactValidation?.(userId, {
                                    uploadId,
                                    contacts: batch,
                                });
                            }
                        }
                    }

                    // ✅ Create contacts in DB (only valid & not duplicate)
                    const toCreate = validationResults
                        .filter((r) => r.isValid && !r.isDuplicate)
                        .map((r) => ({
                            organizationId,
                            phone: r.phone,              // ✅ store 10-digit
                            countryCode: '+91',
                            firstName: (r.firstName || r.name || 'Unknown').trim() || 'Unknown',
                            lastName: r.lastName?.trim() || undefined,
                            email: r.email || undefined, // ✅ optional
                            source: 'CSV_UPLOAD' as const,
                            status: 'ACTIVE' as const,
                        }))
                        .map((c) => {
                            // remove undefined keys for createMany safety
                            const clean: any = { ...c };
                            Object.keys(clean).forEach((k) => clean[k] === undefined && delete clean[k]);
                            return clean;
                        });

                    if (toCreate.length > 0) {
                        await prisma.contact.createMany({
                            data: toCreate,
                            skipDuplicates: true,
                        });
                    }

                    // Fetch created contacts
                    const createdContacts = await prisma.contact.findMany({
                        where: {
                            organizationId,
                            phone: { in: toCreate.map((c) => c.phone) },
                        },
                        select: { id: true, phone: true, firstName: true },
                    });

                    resolve({
                        uploadId,
                        totalRows,
                        validRows,
                        invalidRows,
                        duplicateRows,
                        contacts: createdContacts.map((c) => ({
                            id: c.id,
                            phone: c.phone,
                            firstName: c.firstName || 'Unknown',
                        })),
                    });
                })
                .on('error', (error: any) => {
                    console.error('❌ CSV parsing error:', error);

                    campaignSocketService?.emitCsvUploadProgress?.(userId, {
                        uploadId,
                        progress: 0,
                        totalRows: 0,
                        processedRows: 0,
                        validRows: 0,
                        invalidRows: 0,
                        duplicateRows: 0,
                        status: 'failed',
                    });

                    reject(error);
                });
        });
    }

    /**
     * Validate individual contact
     */
    private validateContact(
        row: CsvRow,
        existingPhones10: Set<string>,
        seenPhones10: Set<string>
    ): ValidationResult {
        // ✅ More header support
        const phoneRaw = this.getValueByPossibleHeaders(row, [
            'phone',
            'mobile',
            'number',
            'phone_number',
            'phonenumber',
            'phone number',
            'whatsapp',
            'whatsapp_number',
        ]);

        const nameRaw = this.getValueByPossibleHeaders(row, [
            'name',
            'fullname',
            'full_name',
            'firstName',
            'first_name',
        ]);

        const firstNameRaw = this.getValueByPossibleHeaders(row, ['firstName', 'first_name']);
        const lastNameRaw = this.getValueByPossibleHeaders(row, ['lastName', 'last_name']);
        const emailRaw = this.getValueByPossibleHeaders(row, ['email', 'Email', 'mail']);

        if (!phoneRaw || !String(phoneRaw).trim()) {
            return {
                phone: '',
                name: nameRaw?.trim(),
                isValid: false,
                isDuplicate: false,
                error: 'Phone number is required (header must be phone/mobile/number)',
            };
        }

        const phone10 = this.normalizeIndianPhone(phoneRaw);

        if (!this.isValidIndian10Digit(phone10)) {
            return {
                phone: phone10,
                name: nameRaw?.trim(),
                firstName: firstNameRaw?.trim() || undefined,
                lastName: lastNameRaw?.trim() || undefined,
                email: this.normalizeEmail(emailRaw),
                isValid: false,
                isDuplicate: false,
                error: 'Invalid Indian phone (must be 10 digits starting with 6-9)',
            };
        }

        // Duplicate checks
        if (existingPhones10.has(phone10)) {
            return {
                phone: phone10,
                name: nameRaw?.trim(),
                firstName: firstNameRaw?.trim() || undefined,
                lastName: lastNameRaw?.trim() || undefined,
                email: this.normalizeEmail(emailRaw),
                isValid: true,
                isDuplicate: true,
                error: 'Already exists in contacts',
            };
        }

        if (seenPhones10.has(phone10)) {
            return {
                phone: phone10,
                name: nameRaw?.trim(),
                firstName: firstNameRaw?.trim() || undefined,
                lastName: lastNameRaw?.trim() || undefined,
                email: this.normalizeEmail(emailRaw),
                isValid: true,
                isDuplicate: true,
                error: 'Duplicate in uploaded file',
            };
        }

        return {
            phone: phone10,
            name: nameRaw?.trim(),
            firstName: firstNameRaw?.trim() || undefined,
            lastName: lastNameRaw?.trim() || undefined,
            email: this.normalizeEmail(emailRaw),
            isValid: true,
            isDuplicate: false,
        };
    }

    getTemplateHeaders(): string[] {
        return ['phone', 'firstName', 'lastName', 'email', 'tags'];
    }

    async validateCsvFile(fileBuffer: Buffer): Promise<{
        totalRows: number;
        validRows: number;
        invalidRows: number;
        duplicateRows: number;
    }> {
        const rows: CsvRow[] = [];
        return new Promise((resolve, reject) => {
            const stream = Readable.from(fileBuffer);

            let totalRows = 0;
            let validRows = 0;
            let invalidRows = 0;
            let duplicateRows = 0;

            const existingPhones10 = new Set<string>(); // validation-only
            const seenPhones10 = new Set<string>();

            stream
                .pipe(csv())
                .on('data', (row: CsvRow) => {
                    rows.push(row);
                    totalRows++;
                })
                .on('end', () => {
                    for (const row of rows) {
                        const result = this.validateContact(row, existingPhones10, seenPhones10);

                        if (result.isValid && !result.isDuplicate) {
                            validRows++;
                            seenPhones10.add(result.phone);
                        } else if (result.isDuplicate) {
                            duplicateRows++;
                        } else {
                            invalidRows++;
                        }
                    }

                    resolve({ totalRows, validRows, invalidRows, duplicateRows });
                })
                .on('error', (error: any) => reject(error));
        });
    }
}

export const campaignUploadService = new CampaignUploadService();