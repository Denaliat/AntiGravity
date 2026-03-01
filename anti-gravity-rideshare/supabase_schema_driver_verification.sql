-- ============================================================
-- Driver Verification Schema Migration
-- Charter-aligned, auditable, lifecycle-aware
-- Safe to run multiple times (idempotent)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Enums
-- ────────────────────────────────────────────────────────────

-- Per-document lifecycle state machine:
--   UNSUBMITTED → PENDING → VERIFIED
--                      ↘ REJECTED → PENDING (re-upload)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VerificationStatus') THEN
        CREATE TYPE "VerificationStatus" AS ENUM (
            'UNSUBMITTED',  -- not yet uploaded
            'PENDING',      -- submitted, awaiting admin review
            'VERIFIED',     -- approved
            'REJECTED'      -- rejected; driver may re-upload (→ PENDING)
        );
    END IF;
END$$;

-- The 5 required document categories
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VerificationDocumentType') THEN
        CREATE TYPE "VerificationDocumentType" AS ENUM (
            'DRIVERS_LICENSE',
            'INSURANCE',
            'VULNERABLE_SECTOR_CHECK',
            'SELFIE_MATCH',
            'VEHICLE_REGISTRATION'
        );
    END IF;
END$$;

-- ────────────────────────────────────────────────────────────
-- 2. UserVerificationDocument
-- NOTE: userId is TEXT to match User(id) which is defined as
--   TEXT NOT NULL DEFAULT uuid_generate_v4() in the main schema.
--   Both should be migrated to UUID in a future consolidation.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "UserVerificationDocument" (
    "id"              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- TEXT to match User(id) type in the main schema (supabase_schema.sql)
    "userId"          TEXT        NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,

    "documentType"    "VerificationDocumentType" NOT NULL,

    -- fileUrl / uploadedAt are NULL only while UNSUBMITTED
    -- uploadedAt is set at upload time (not review time) so the
    -- DriverEligibility VIEW ordering (NULLS LAST) is always correct
    "fileUrl"         TEXT,
    "uploadedAt"      TIMESTAMPTZ,

    -- For documents with natural expiry (license, insurance, registration)
    "expiresAt"       TIMESTAMPTZ,

    "status"          "VerificationStatus" NOT NULL DEFAULT 'UNSUBMITTED',

    -- Reviewer accountability — required by charter
    "reviewedBy"      TEXT,        -- admin userId or 'system'
    "reviewedAt"      TIMESTAMPTZ,

    -- Mandatory when REJECTED (enforced by constraint below)
    "rejectionReason" TEXT,

    "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- ── Invariant constraints ───────────────────────────────

    -- Once past UNSUBMITTED, fileUrl and uploadedAt must be present
    CONSTRAINT "chk_fileurl_when_active"
        CHECK (
            "status" = 'UNSUBMITTED'
            OR ("fileUrl" IS NOT NULL AND "uploadedAt" IS NOT NULL)
        ),

    -- Reviewers must supply a reason when rejecting
    CONSTRAINT "chk_rejection_reason"
        CHECK (
            "status" != 'REJECTED'
            OR "rejectionReason" IS NOT NULL
        )
);

-- ────────────────────────────────────────────────────────────
-- 3. Auto-update updatedAt
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_uvd_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW."updatedAt" = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS uvd_updated_at ON "UserVerificationDocument";
CREATE TRIGGER uvd_updated_at
    BEFORE UPDATE ON "UserVerificationDocument"
    FOR EACH ROW EXECUTE FUNCTION update_uvd_updated_at();

-- ────────────────────────────────────────────────────────────
-- 4. Indexes
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "uvd_userId_idx"
    ON "UserVerificationDocument"("userId");

CREATE INDEX IF NOT EXISTS "uvd_userId_type_idx"
    ON "UserVerificationDocument"("userId", "documentType");

CREATE INDEX IF NOT EXISTS "uvd_status_idx"
    ON "UserVerificationDocument"("status");

-- Prevent multiple concurrent active docs per (user, type).
-- REJECTED rows are historical and excluded — allows re-upload after rejection.
CREATE UNIQUE INDEX IF NOT EXISTS "uvd_one_active_per_type"
    ON "UserVerificationDocument"("userId", "documentType")
    WHERE "status" IN ('PENDING', 'VERIFIED');

-- ────────────────────────────────────────────────────────────
-- 5. Row-Level Security  (role boundary)
-- ────────────────────────────────────────────────────────────
ALTER TABLE "UserVerificationDocument" ENABLE ROW LEVEL SECURITY;

-- Drivers may INSERT their own rows only
DROP POLICY IF EXISTS "drivers_insert_own_docs" ON "UserVerificationDocument";
CREATE POLICY "drivers_insert_own_docs"
    ON "UserVerificationDocument"
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid()::text = "userId");

-- Drivers may read their own documents
DROP POLICY IF EXISTS "drivers_read_own_docs" ON "UserVerificationDocument";
CREATE POLICY "drivers_read_own_docs"
    ON "UserVerificationDocument"
    FOR SELECT
    TO authenticated
    USING (auth.uid()::text = "userId");

-- Only admin/safety roles may UPDATE (review decisions).
-- Requires the JWT auth hook below to stamp app_role into the token.
DROP POLICY IF EXISTS "admins_review_docs" ON "UserVerificationDocument";
CREATE POLICY "admins_review_docs"
    ON "UserVerificationDocument"
    FOR UPDATE
    TO authenticated
    USING (
        (auth.jwt() ->> 'app_role') IN ('ADMIN', 'LEAD_ADMIN', 'SUPPORT')
    );

-- ────────────────────────────────────────────────────────────
-- 6. JWT Auth Hook
--    Stamps the user's role from the User table into the JWT
--    as `app_role`. Required for the RLS policy above.
--
--    AFTER running this SQL:
--    → Supabase Dashboard → Authentication → Hooks
--    → Enable "Custom Access Token" hook
--    → Point it to: public.custom_access_token_hook
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    claims    JSONB;
    user_role TEXT;
BEGIN
    -- Look up the role for this user in our User table
    SELECT role INTO user_role
    FROM "User"
    WHERE id = (event ->> 'user_id');

    claims := event -> 'claims';

    IF user_role IS NOT NULL THEN
        -- Stamp app_role into the JWT claims
        claims := jsonb_set(claims, '{app_role}', to_jsonb(user_role));
    ELSE
        claims := jsonb_set(claims, '{app_role}', '"RIDER"');
    END IF;

    event := jsonb_set(event, '{claims}', claims);
    RETURN event;
END;
$$;

-- Grant Supabase Auth service permission to call this function
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- ────────────────────────────────────────────────────────────
-- 7. DriverEligibility VIEW
--    Real-time derived eligibility — never stored on User.
--    A driver is ELIGIBLE when all 5 required documents are
--    VERIFIED and not expired.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW "DriverEligibility" AS
WITH latest_docs AS (
    -- Most recent submission per (user, documentType)
    SELECT DISTINCT ON ("userId", "documentType")
        "userId",
        "documentType",
        "status",
        "expiresAt",
        "rejectionReason",
        "uploadedAt"
    FROM "UserVerificationDocument"
    ORDER BY "userId", "documentType", "uploadedAt" DESC NULLS LAST
),
required_types(dt) AS (
    VALUES
        ('DRIVERS_LICENSE'::"VerificationDocumentType"),
        ('INSURANCE'::"VerificationDocumentType"),
        ('VULNERABLE_SECTOR_CHECK'::"VerificationDocumentType"),
        ('SELFIE_MATCH'::"VerificationDocumentType"),
        ('VEHICLE_REGISTRATION'::"VerificationDocumentType")
),
per_user_status AS (
    SELECT
        u."id"                                                      AS "userId",
        rt.dt                                                       AS "documentType",
        COALESCE(ld."status", 'UNSUBMITTED'::"VerificationStatus") AS "status",
        ld."expiresAt",
        ld."rejectionReason",
        (
            COALESCE(ld."status", 'UNSUBMITTED') = 'VERIFIED'
            AND (ld."expiresAt" IS NULL OR ld."expiresAt" > now())
        )                                                           AS "isValid"
    FROM "User" u
    CROSS JOIN required_types rt
    LEFT JOIN latest_docs ld
        ON ld."userId" = u."id"
       AND ld."documentType" = rt.dt
    WHERE u."role" = 'DRIVER'
)
SELECT
    "userId",
    bool_and("isValid")                                            AS "isEligible",
    array_agg("documentType") FILTER (WHERE NOT "isValid")        AS "pendingTypes",
    now()                                                          AS "asOf"
FROM per_user_status
GROUP BY "userId";

-- ────────────────────────────────────────────────────────────
-- 8. VerificationSignalEvent
--    One row per integrity signal generated for a document.
--    Stores raw evidence so signals are explainable, not just
--    labelled. Required for Ombud audit trail.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "VerificationSignalEvent" (
    "id"                         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    "userVerificationDocumentId" UUID        NOT NULL
        REFERENCES "UserVerificationDocument"("id") ON DELETE CASCADE,
    -- Signal identity
    "signalCode"    TEXT        NOT NULL,
    "severity"      TEXT        NOT NULL CHECK ("severity" IN ('INFO', 'WARN', 'BLOCK')),
    -- Raw evidence stored as JSON so reviewers can see exactly what triggered it
    "evidence"      JSONB       NOT NULL DEFAULT '{}',
    "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "vse_docId_idx"
    ON "VerificationSignalEvent"("userVerificationDocumentId");

-- ────────────────────────────────────────────────────────────
-- 9. ReviewAuditEvent
--    Logs every touchpoint a reviewer has with a document:
--    viewed, expanded a signal, approved, rejected, escalated.
--    Enables Ombud oversight and detects reviewer automation bias.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ReviewAuditEvent" (
    "id"                         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    "userVerificationDocumentId" UUID        NOT NULL
        REFERENCES "UserVerificationDocument"("id"),
    "reviewerId"                 TEXT        NOT NULL,
    "action"                     TEXT        NOT NULL CHECK ("action" IN (
                                     'VIEWED', 'SIGNAL_EXPANDED',
                                     'APPROVED', 'REJECTED', 'ESCALATED'
                                 )),
    -- Populated when action = SIGNAL_EXPANDED
    "signalCode"                 TEXT,
    -- Populated when action = REJECTED (mirrors DB constraint on UserVerificationDocument)
    "rejectionReason"            TEXT,
    -- Set to true when a BLOCK signal requires two-person review
    "secondaryReviewRequired"    BOOLEAN     NOT NULL DEFAULT false,
    "createdAt"                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "rae_docId_idx"
    ON "ReviewAuditEvent"("userVerificationDocumentId");

CREATE INDEX IF NOT EXISTS "rae_reviewerId_idx"
    ON "ReviewAuditEvent"("reviewerId");
