-- ============================================================
-- Security Patch: RLS on VerificationSignalEvent, ReviewAuditEvent,
-- and DriverEligibility VIEW access restriction.
--
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- Safe to run multiple times (idempotent).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. VerificationSignalEvent — Row Level Security
--    Admins can read/write all rows.
--    Drivers can read signals on their own documents only.
-- ────────────────────────────────────────────────────────────
ALTER TABLE "VerificationSignalEvent" ENABLE ROW LEVEL SECURITY;

-- Admins: full read access
DROP POLICY IF EXISTS "admins_read_signals" ON "VerificationSignalEvent";
CREATE POLICY "admins_read_signals"
    ON "VerificationSignalEvent"
    FOR SELECT
    TO authenticated
    USING (
        (auth.jwt() ->> 'app_role') IN ('ADMIN', 'LEAD_ADMIN', 'SUPPORT')
    );

-- Admins: insert signals (from signal evaluator server-side calls)
DROP POLICY IF EXISTS "admins_insert_signals" ON "VerificationSignalEvent";
CREATE POLICY "admins_insert_signals"
    ON "VerificationSignalEvent"
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (auth.jwt() ->> 'app_role') IN ('ADMIN', 'LEAD_ADMIN', 'SUPPORT')
    );

-- Drivers: read signals on their own documents only
DROP POLICY IF EXISTS "drivers_read_own_signals" ON "VerificationSignalEvent";
CREATE POLICY "drivers_read_own_signals"
    ON "VerificationSignalEvent"
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM "UserVerificationDocument" uvd
            WHERE uvd."id" = "VerificationSignalEvent"."userVerificationDocumentId"
              AND uvd."userId" = auth.uid()::text
        )
    );

-- ────────────────────────────────────────────────────────────
-- 2. ReviewAuditEvent — Row Level Security
--    Admins only — audit records must not be readable by drivers.
-- ────────────────────────────────────────────────────────────
ALTER TABLE "ReviewAuditEvent" ENABLE ROW LEVEL SECURITY;

-- Admins: read all audit events
DROP POLICY IF EXISTS "admins_read_audit" ON "ReviewAuditEvent";
CREATE POLICY "admins_read_audit"
    ON "ReviewAuditEvent"
    FOR SELECT
    TO authenticated
    USING (
        (auth.jwt() ->> 'app_role') IN ('ADMIN', 'LEAD_ADMIN', 'SUPPORT')
    );

-- Admins: insert audit events (reviewers logging their actions)
DROP POLICY IF EXISTS "admins_insert_audit" ON "ReviewAuditEvent";
CREATE POLICY "admins_insert_audit"
    ON "ReviewAuditEvent"
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (auth.jwt() ->> 'app_role') IN ('ADMIN', 'LEAD_ADMIN', 'SUPPORT')
    );

-- ────────────────────────────────────────────────────────────
-- 3. DriverEligibility VIEW — restricted access via SECURITY DEFINER function
--
--    Views in Supabase do not inherit RLS from their base tables.
--    We wrap access in a SECURITY DEFINER function that enforces:
--      - A driver can only fetch their own eligibility
--      - Admins can fetch any driver's eligibility
--
--    Usage from the app:
--      SELECT * FROM get_driver_eligibility('<userId>');
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_driver_eligibility(target_user_id TEXT)
RETURNS TABLE (
    "userId"       TEXT,
    "isEligible"  BOOLEAN,
    "pendingTypes" TEXT[],
    "asOf"         TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    caller_uid  TEXT := auth.uid()::text;
    caller_role TEXT := auth.jwt() ->> 'app_role';
BEGIN
    -- Allow: admins can query any driver's eligibility
    -- Allow: a driver can query their own eligibility
    IF caller_role NOT IN ('ADMIN', 'LEAD_ADMIN', 'SUPPORT')
       AND caller_uid IS DISTINCT FROM target_user_id THEN
        RAISE EXCEPTION 'Access denied — you may only view your own eligibility';
    END IF;

    RETURN QUERY
    SELECT
        de."userId",
        de."isEligible",
        -- Cast VerificationDocumentType[] to TEXT[] for portability
        de."pendingTypes"::TEXT[],
        de."asOf"
    FROM "DriverEligibility" de
    WHERE de."userId" = target_user_id;
END;
$$;

-- Revoke public execute, grant only to authenticated users
REVOKE EXECUTE ON FUNCTION get_driver_eligibility(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_driver_eligibility(TEXT) TO authenticated;
