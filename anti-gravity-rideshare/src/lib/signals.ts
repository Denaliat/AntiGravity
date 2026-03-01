import {
    UserVerificationDocument,
    VerificationSignal,
    SignalCode,
    SignalSeverity,
    VerificationDocumentType,
} from './types';

// Document types that MUST have an expiry date
const REQUIRES_EXPIRY = new Set<VerificationDocumentType>([
    'DRIVERS_LICENSE',
    'INSURANCE',
    'VEHICLE_REGISTRATION',
]);

// How many years out is considered outside expected expiry range
const EXPIRY_RANGE_YEARS_THRESHOLD = 10;

// Rapid resubmission window in hours
const RAPID_WINDOW_HOURS = 24;

// Password reset proximity threshold in minutes
const RESET_PROXIMITY_MINUTES = 30;

// ── Helper ────────────────────────────────────────────────────────────────────

function makeSignal(
    documentId: string,
    code: SignalCode,
    severity: SignalSeverity,
    label: string,
    explanation: string,
    evidence: Record<string, unknown>
): VerificationSignal {
    return {
        id: crypto.randomUUID(),
        documentId,
        code,
        severity,
        label,
        explanation,
        evidence,
        requiresConfirmation: severity === 'BLOCK',
        confirmed: false,
        createdAt: new Date().toISOString(),
    };
}

// ── Rule functions ────────────────────────────────────────────────────────────

function checkExpiryMissing(doc: UserVerificationDocument): VerificationSignal | null {
    if (!REQUIRES_EXPIRY.has(doc.documentType)) return null;
    if (doc.expiresAt) return null;
    return makeSignal(
        doc.id,
        'DOC_EXPIRY_MISSING',
        'WARN',
        'Expiry date not detected',
        'This document type requires a valid expiry date. Please verify the date manually and enter it before approving.',
        { documentType: doc.documentType, uploadedAt: doc.uploadedAt }
    );
}

function checkExpiryFutureSuspicious(doc: UserVerificationDocument): VerificationSignal | null {
    if (!doc.expiresAt) return null;
    const yearsOut = (new Date(doc.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 365);
    if (yearsOut <= EXPIRY_RANGE_YEARS_THRESHOLD) return null;
    return makeSignal(
        doc.id,
        'DOC_EXPIRY_OUT_OF_EXPECTED_RANGE',
        'INFO',
        `Expiry date is ${Math.round(yearsOut)} years from now`,
        'The stated expiry date falls outside the typical range for this document type. Please confirm the date is accurate before approving.',
        { expiresAt: doc.expiresAt, yearsFromNow: Math.round(yearsOut) }
    );
}

function checkRapidResubmission(
    doc: UserVerificationDocument,
    allDocs: UserVerificationDocument[]
): VerificationSignal | null {
    if (!doc.uploadedAt) return null;
    const uploadTime = new Date(doc.uploadedAt).getTime();
    const windowMs = RAPID_WINDOW_HOURS * 60 * 60 * 1000;

    const priorInWindow = allDocs.filter(d =>
        d.id !== doc.id &&
        d.userId === doc.userId &&
        d.documentType === doc.documentType &&
        d.uploadedAt !== null &&
        Math.abs(new Date(d.uploadedAt).getTime() - uploadTime) < windowMs
    );

    if (priorInWindow.length === 0) return null;
    return makeSignal(
        doc.id,
        'RAPID_RESUBMISSION',
        'WARN',
        `${priorInWindow.length + 1} uploads for this document within ${RAPID_WINDOW_HOURS}h`,
        'Multiple submissions were made for the same document type in a short window. This may indicate confusion or automation — please verify the correct version before approving.',
        {
            priorSubmissionCount: priorInWindow.length,
            windowHours: RAPID_WINDOW_HOURS,
            priorUploadedAts: priorInWindow.map(d => d.uploadedAt),
        }
    );
}

function checkHashReuseAcrossAccounts(
    doc: UserVerificationDocument,
    allDocs: UserVerificationDocument[]
): VerificationSignal | null {
    if (!doc.fileUrl) return null;
    const matches = allDocs.filter(d =>
        d.id !== doc.id &&
        d.userId !== doc.userId &&
        d.fileUrl === doc.fileUrl
    );
    if (matches.length === 0) return null;

    // Anonymise: show only a masked userId for privacy
    const masked = matches.map(d => d.userId.slice(0, 8) + '…');
    return makeSignal(
        doc.id,
        'HASH_REUSE_ACROSS_ACCOUNTS',
        'BLOCK',
        'This file was previously submitted by a different account',
        'The exact file URL matches a submission from another driver account. This may indicate document sharing or account compromise. A second reviewer is required before any action.',
        {
            matchedAccountPrefixes: masked,
            matchCount: matches.length,
            fileUrl: doc.fileUrl,
        }
    );
}

function checkRecentPasswordReset(
    doc: UserVerificationDocument,
    resetAt: string | null
): VerificationSignal | null {
    if (!resetAt || !doc.uploadedAt) return null;
    const diffMs = new Date(doc.uploadedAt).getTime() - new Date(resetAt).getTime();
    const diffMinutes = diffMs / 60000;
    if (diffMinutes < 0 || diffMinutes > RESET_PROXIMITY_MINUTES) return null;
    return makeSignal(
        doc.id,
        'RECENT_PASSWORD_RESET',
        'WARN',
        `Password reset ${Math.round(diffMinutes)} min before upload`,
        'A password reset occurred shortly before this document was uploaded. This may indicate an account takeover. Verify the account holder directly before approving.',
        { resetAt, uploadedAt: doc.uploadedAt, diffMinutes: Math.round(diffMinutes) }
    );
}

// Scaffolded rules — require OCR/image analysis integration
function scaffoldBlurry(doc: UserVerificationDocument): VerificationSignal | null {
    // TODO: integrate OCR confidence score. Until then, flag for manual check on image docs.
    if (!doc.fileUrl) return null;
    const isImage = /\.(jpg|jpeg|png|webp|heic)$/i.test(doc.fileUrl);
    if (!isImage) return null;
    return makeSignal(
        doc.id,
        'DOC_BLURRY',
        'INFO',
        'Image readability not yet verified',
        'Automatic text clarity checks are not yet enabled. Please visually confirm the document is fully legible before approving.',
        { reason: 'OCR_NOT_INTEGRATED', fileUrl: doc.fileUrl }
    );
}

// ── Main evaluator ────────────────────────────────────────────────────────────

export interface EvaluateDocumentOptions {
    /** All documents submitted by any user — needed for hash-reuse check */
    allDocumentsGlobal: UserVerificationDocument[];
    /** ISO timestamp of last password reset for this user (optional) */
    lastPasswordResetAt?: string | null;
}

/**
 * Runs all applicable bias-safe signal rules for a given document.
 * Returns an array of VerificationSignal — may be empty (clean submission).
 *
 * WHAT THESE SIGNALS ARE:
 *   Document quality + submission integrity + account security anomalies.
 *
 * WHAT THESE SIGNALS ARE NOT:
 *   Location, name/language, device type, time-of-day, or any demographic proxy.
 */
export function evaluateDocument(
    doc: UserVerificationDocument,
    opts: EvaluateDocumentOptions
): VerificationSignal[] {
    const signals: VerificationSignal[] = [];

    const add = (s: VerificationSignal | null) => { if (s) signals.push(s); };

    // Document-Intrinsic
    add(checkExpiryMissing(doc));
    add(checkExpiryFutureSuspicious(doc));
    add(scaffoldBlurry(doc));

    // Submission-Integrity
    add(checkRapidResubmission(doc, opts.allDocumentsGlobal));
    add(checkHashReuseAcrossAccounts(doc, opts.allDocumentsGlobal));

    // Account-Security
    add(checkRecentPasswordReset(doc, opts.lastPasswordResetAt ?? null));

    return signals;
}
