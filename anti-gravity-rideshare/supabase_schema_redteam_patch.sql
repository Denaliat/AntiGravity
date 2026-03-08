-- ============================================================
-- Red-Team Fixes Patch
-- Apply via: Supabase Dashboard → SQL Editor → New Query
-- Run AFTER supabase_schema_parent_child_patch.sql
-- ============================================================

-- ── 1. Prevent User.role modification (§6.1) ─────────────────
-- Postgres trigger that blocks any UPDATE that changes the role column.
-- The API layer also strips role via denylist, but this is defence-in-depth
-- at the database level — works even against direct Supabase client access.

CREATE OR REPLACE FUNCTION prevent_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."role" IS DISTINCT FROM OLD."role" THEN
    RAISE EXCEPTION 'Security violation: User.role cannot be modified after creation';
  END IF;
  IF NEW."parentId" IS DISTINCT FROM OLD."parentId" THEN
    RAISE EXCEPTION 'Security violation: User.parentId cannot be modified after creation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate to make this idempotent
DROP TRIGGER IF EXISTS "trg_prevent_role_change" ON "User";

CREATE TRIGGER "trg_prevent_role_change"
  BEFORE UPDATE ON "User"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_role_change();


-- ── 2. ParentChildAuditEvent table (§7.1) ────────────────────
-- Lightweight audit trail for security-relevant parent-child events.
-- INSERT-only — no UPDATE or DELETE allowed via RLS.

CREATE TABLE IF NOT EXISTS "ParentChildAuditEvent" (
  "id"        TEXT NOT NULL DEFAULT uuid_generate_v4(),
  "action"    TEXT NOT NULL,              -- e.g. SOS_ACTIVATED, RIDE_CREATED, CONTACTS_CHANGED
  "actorId"   TEXT NOT NULL,              -- Who performed the action
  "childId"   TEXT,
  "parentId"  TEXT,
  "targetId"  TEXT,                       -- rideId, recordingId, contactId, etc.
  "metadata"  JSONB,                      -- Additional context (flexible)
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParentChildAuditEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ParentChildAuditEvent" ENABLE ROW LEVEL SECURITY;

-- Service role can insert (via API server). No one can UPDATE or DELETE.
-- Authenticated users can read their own events only.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'ParentChildAuditEvent'
      AND policyname = 'audit_insert_only'
  ) THEN
    CREATE POLICY "audit_insert_only" ON "ParentChildAuditEvent"
      FOR INSERT
      WITH CHECK (true);  -- API server inserts via service role
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'ParentChildAuditEvent'
      AND policyname = 'audit_read_own'
  ) THEN
    CREATE POLICY "audit_read_own" ON "ParentChildAuditEvent"
      FOR SELECT
      USING (
        (SELECT auth.uid())::text = "actorId"
        OR (SELECT auth.uid())::text = "parentId"
      );
  END IF;
END $$;


-- ── 3. Stuck recording cleanup (§3.3b) ────────────────────────
-- Mark recordings as FAILED if they've been in RECORDING status for >30 minutes.
-- Run this periodically via a Supabase Edge Function or cron job.
-- This is also safe to run manually at any time.

UPDATE "EmergencyRecording"
SET "status" = 'FAILED',
    "completedAt" = CURRENT_TIMESTAMP
WHERE "status" = 'RECORDING'
  AND "startedAt" < CURRENT_TIMESTAMP - INTERVAL '30 minutes';


-- ── 4. Index for SOS dedup/rate-limit queries ─────────────────
CREATE INDEX IF NOT EXISTS "EmergencyRecording_childId_status_idx"
  ON "EmergencyRecording" ("childId", "status");

CREATE INDEX IF NOT EXISTS "EmergencyRecording_childId_startedAt_idx"
  ON "EmergencyRecording" ("childId", "startedAt" DESC);


-- ── 5. Index for audit queries ────────────────────────────────
CREATE INDEX IF NOT EXISTS "ParentChildAuditEvent_actorId_idx"
  ON "ParentChildAuditEvent" ("actorId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "ParentChildAuditEvent_parentId_idx"
  ON "ParentChildAuditEvent" ("parentId", "createdAt" DESC);
