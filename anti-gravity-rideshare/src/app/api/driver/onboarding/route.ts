import { NextRequest, NextResponse } from 'next/server';
import { uploadDriverDocument } from '@/lib/storage';
import { db } from '@/lib/db';
import { VerificationDocumentType } from '@/lib/types';

// Document types that carry an expiry date
const EXPIRY_FIELD_MAP: Record<string, VerificationDocumentType> = {
    licenseFile: 'DRIVERS_LICENSE',
    insuranceFile: 'INSURANCE',
    registrationFile: 'VEHICLE_REGISTRATION',
    backgroundFile: 'VULNERABLE_SECTOR_CHECK',
    selfieFile: 'SELFIE_MATCH',
};

const EXPIRY_DATE_MAP: Record<string, string> = {
    licenseFile: 'licenseExpiry',
    insuranceFile: 'insuranceExpiry',
    registrationFile: 'registrationExpiry',
};

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();

        // ── 1. Identify the driver ─────────────────────────────────────
        const userId = formData.get('userId') as string | null;
        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        // ── 2. Update personal details on the User row ─────────────────
        const personalFields: Record<string, string> = {};
        for (const field of ['name', 'dateOfBirth', 'licenseNumber', 'licenseExpiry',
            'insurancePolicyNumber', 'insuranceExpiry'] as const) {
            const val = formData.get(field) as string | null;
            if (val) personalFields[field] = val;
        }
        if (Object.keys(personalFields).length > 0) {
            await db.drivers.updatePersonalDetails(userId, personalFields as any);
        }

        // ── 3. Upload each document file and record in DB ──────────────
        const uploadedTypes: VerificationDocumentType[] = [];
        const errors: string[] = [];

        for (const [fieldName, docType] of Object.entries(EXPIRY_FIELD_MAP)) {
            const file = formData.get(fieldName) as File | null;
            if (!file) continue;

            try {
                // Upload to Supabase Storage
                const fileUrl = await uploadDriverDocument(userId, docType, file);

                // Determine expiresAt for documents with natural expiry
                const expiryKey = EXPIRY_DATE_MAP[fieldName];
                const expiresAt = expiryKey
                    ? (formData.get(expiryKey) as string | null) ?? undefined
                    : undefined;

                // Record in UserVerificationDocument table
                await db.verificationDocuments.upsertSubmission(
                    userId,
                    docType,
                    fileUrl,
                    expiresAt
                );

                uploadedTypes.push(docType);
            } catch (err: any) {
                errors.push(`${docType}: ${err.message}`);
            }
        }

        if (errors.length > 0 && uploadedTypes.length === 0) {
            return NextResponse.json({ error: 'All uploads failed', details: errors }, { status: 500 });
        }

        // ── 4. Return result ───────────────────────────────────────────
        return NextResponse.json({
            success: true,
            uploadedTypes,
            ...(errors.length > 0 && { warnings: errors }),
        });

    } catch (err: any) {
        console.error('[driver/onboarding] POST error:', err);
        return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 });
    }
}
