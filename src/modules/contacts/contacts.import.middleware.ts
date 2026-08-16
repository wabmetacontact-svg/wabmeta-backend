// src/modules/contacts/contacts.import.middleware.ts - FIXED
// ✅ INTERNATIONAL PHONE SUPPORT

import { NextFunction, Request, Response } from 'express';
import { Readable } from 'stream';
import csv from 'csv-parser';
import { toCanonicalPhone } from '../../utils/phone';

// ============================================
// ✅ INTERNATIONAL NORMALIZE - phone.ts use karo
// ============================================
const normalizePhone = (value: unknown): string => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';

    // ✅ phone.ts ka toCanonicalPhone use karo
    const canonical = toCanonicalPhone(raw);
    return canonical || ''; // Empty string = invalid
};

const normalizeEmail = (value: unknown): string | undefined => {
    const s = String(value ?? '').trim();
    return s || undefined;
};

// ✅ BOM-safe, case-insensitive key picker
const pick = (row: any, keys: string[]): string => {
    const lowerKeys = keys.map((k) => k.toLowerCase());

    for (const rk of Object.keys(row || {})) {
        const norm = rk
            .replace(/^\uFEFF/, '') // Remove BOM
            .trim()
            .toLowerCase();

        if (lowerKeys.includes(norm)) {
            const val = row[rk];
            if (val !== undefined && val !== null && String(val).trim() !== '') {
                return String(val).trim();
            }
        }
    }
    return '';
};

/**
 * ✅ FIXED Middleware - handles:
 * 1) JSON { contacts: [...] }
 * 2) JSON array [...] → wrapped
 * 3) multipart CSV file → parsed
 * 4) International phone numbers ✅
 */
export const contactsImportMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const body = (req as any).body;

        // ── CASE 1: Body is array ──────────────────────────────
        if (Array.isArray(body)) {
            (req as any).body = {
                contacts: body.map((c: any) => ({
                    ...c,
                    phone: normalizePhone(c.phone),
                    email: normalizeEmail(c.email),
                })),
            };
            return next();
        }

        // ── CASE 2: Body has contacts array ───────────────────
        if (Array.isArray(body?.contacts)) {
            (req as any).body = {
                ...body,
                contacts: body.contacts.map((c: any) => ({
                    ...c,
                    // ✅ Phone normalize karo - already canonical ho
                    //    toh wahi rahega, otherwise fix hoga
                    phone: normalizePhone(c.phone || c.Phone || c.mobile || ''),
                    email: normalizeEmail(c.email),
                })),
            };
            return next();
        }

        // ── CASE 3: CSV File ───────────────────────────────────
        const file = (req as any).file as any | undefined;
        if (!file?.buffer) {
            return next(); // No file - controller validate karega
        }

        const rows: any[] = [];

        await new Promise<void>((resolve, reject) => {
            Readable.from(file.buffer)
                .pipe(
                    csv({
                        // ✅ BOM handle karo
                        mapHeaders: ({ header }) =>
                            header.replace(/^\uFEFF/, '').trim().toLowerCase(),
                    })
                )
                .on('data', (row) => rows.push(row))
                .on('end', () => resolve())
                .on('error', (err) => reject(err));
        });

        const contacts = rows
            .map((row) => {
                const phoneRaw = pick(row, [
                    'phone', 'mobile', 'number', 'phone_number',
                    'phonenumber', 'phone number', 'contact',
                    'whatsapp', 'mob', 'cell',
                ]);

                const firstName = pick(row, [
                    'firstname', 'first_name', 'first name',
                    'name', 'full_name', 'fullname',
                    'contact name', 'contactname',
                ]);

                const lastName = pick(row, [
                    'lastname', 'last_name', 'last name', 'surname',
                ]);

                const email = pick(row, [
                    'email', 'mail', 'email_address', 'emailaddress',
                ]);

                const tagsRaw = pick(row, ['tags', 'tag', 'labels', 'label']);
                const tags = tagsRaw
                    ? tagsRaw
                        .split(/[,;|]/)
                        .map((t: string) => t.trim())
                        .filter(Boolean)
                    : undefined;

                return {
                    // ✅ Canonical format
                    phone: normalizePhone(phoneRaw),
                    firstName: firstName || undefined,
                    lastName: lastName || undefined,
                    email: normalizeEmail(email),
                    tags,
                };
            })
            // ✅ Sirf valid phones rakho
            .filter((c) => c.phone && c.phone.startsWith('+'));

        (req as any).body = {
            ...body,
            contacts,
            skipDuplicates: body?.skipDuplicates ?? true,
            groupId: body?.groupId,
            tags: body?.tags,
        };

        return next();
    } catch (err) {
        return next(err);
    }
};