import { NextRequest, NextResponse } from 'next/server';
import { uploadDriverDocument } from '@/lib/storage';
import { db } from '@/lib/db';
import { VerificationDocumentType } from '@/lib/types';
import { requireAuth } from '@/lib/api-auth';
import { normalizeText } from '@/lib/sanitize';

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

// ── File validation ────────────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
]);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function validateFile(file: File, fieldName: string): string | null {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
        return `${fieldName}: unsupported file type "${file.type}". Allowed: JPEG, PNG, WebP, PDF.`;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
        return `${fieldName}: file exceeds the 10 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB).`;
    }
    return null;
}

export async function POST(req: NextRequest) {
    // ── 1. Verify session — userId comes from the JWT, not the request body ──
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult; // 401

    const { user } = authResult;

    // Only DRIVER-role users may submit onboarding documents
    if (user.role !== 'DRIVER') {
        return NextResponse.json(
            { error: 'Forbidden — only drivers may submit onboarding documents' },
            { status: 403 }
        );
    }

    const userId = user.id; // trusted from session, not request body

    try {
        const formData = await req.formData();

        // ── 2. Update personal details on the User row ─────────────────
        const ALLOWED_PERSONAL_FIELDS = [
            'name', 'dateOfBirth', 'licenseNumber', 'licenseExpiry',
            'insurancePolicyNumber', 'insuranceExpiry',
        ] as const;

        // Fields that contain free-text and need Unicode normalization
        const TEXT_FIELDS_TO_NORMALIZE = new Set(['name', 'licenseNumber', 'insurancePolicyNumber']);

        const personalFields: Partial<Record<typeof ALLOWED_PERSONAL_FIELDS[number], string>> = {};
        for (const field of ALLOWED_PERSONAL_FIELDS) {
            const val = formData.get(field) as string | null;
            if (val) personalFields[field] = TEXT_FIELDS_TO_NORMALIZE.has(field) ? normalizeText(val) : val;
        }
        if (Object.keys(personalFields).length > 0) {
            await db.drivers.updatePersonalDetails(userId, personalFields);
        }

        // ── 3. Validate then upload each document file ─────────────────
        const uploadedTypes: VerificationDocumentType[] = [];
        const errors: string[] = [];

        for (const [fieldName, docType] of Object.entries(EXPIRY_FIELD_MAP)) {
            const file = formData.get(fieldName) as File | null;
            if (!file) continue;

            // Server-side file validation
            const validationError = validateFile(file, fieldName);
            if (validationError) {
                errors.push(validationError);
                continue;
            }

            try {
                const fileUrl = await uploadDriverDocument(userId, docType, file);

                const expiryKey = EXPIRY_DATE_MAP[fieldName];
                const expiresAt = expiryKey
                    ? (formData.get(expiryKey) as string | null) ?? undefined
                    : undefined;

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
            return NextResponse.json({ error: 'All uploads failed', details: errors }, { status: 422 });
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
