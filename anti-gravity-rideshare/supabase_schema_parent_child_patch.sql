-- ============================================================
-- Parent-Child Safety Patch
-- Apply via: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── 1. Add missing columns to User table ────────────────────
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "rideRestrictionsEnabled" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "allowedPickupLocations" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "parentChildEnabled" BOOLEAN DEFAULT false;

-- ── 2. Add requestedByParentId to Ride table ─────────────────
ALTER TABLE "Ride"
  ADD COLUMN IF NOT EXISTS "requestedByParentId" TEXT
    REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 3. EmergencyContact table ────────────────────────────────
-- Parent must have ≥1 primary + ≥1 secondary before SOS / ride booking is enabled.
CREATE TABLE IF NOT EXISTS "EmergencyContact" (
  "id"           TEXT NOT NULL DEFAULT uuid_generate_v4(),
  "parentId"     TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name"         TEXT NOT NULL,
  "phone"        TEXT NOT NULL,
  "email"        TEXT,
  "relationship" TEXT NOT NULL,
  "isPrimary"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmergencyContact_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "EmergencyContact" ENABLE ROW LEVEL SECURITY;

-- Parent can only read/write their own contacts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'EmergencyContact'
      AND policyname = 'parent_own_contacts'
  ) THEN
    CREATE POLICY "parent_own_contacts" ON "EmergencyContact"
      FOR ALL
      USING  ((SELECT auth.uid())::text = "parentId")
      WITH CHECK ((SELECT auth.uid())::text = "parentId");
  END IF;
END $$;

-- ── 4. EmergencyRecording table ──────────────────────────────
-- incidentId is nullable — recording is created first, then incident is attached.
-- This decouples recordings from incidents for future reuse (e.g. driver misconduct).
CREATE TABLE IF NOT EXISTS "EmergencyRecording" (
  "id"           TEXT NOT NULL DEFAULT uuid_generate_v4(),
  "incidentId"   TEXT NULL REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "childId"      TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "startedBy"    TEXT NOT NULL DEFAULT 'CHILD_SOS',  -- consent/disclosure metadata
  "recordingUrl" TEXT,
  "status"       TEXT NOT NULL DEFAULT 'RECORDING'
                   CHECK ("status" IN ('RECORDING', 'COMPLETE', 'FAILED')),
  "startedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"  TIMESTAMP(3),
  CONSTRAINT "EmergencyRecording_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "EmergencyRecording" ENABLE ROW LEVEL SECURITY;

-- Child reads/writes their own recordings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'EmergencyRecording'
      AND policyname = 'child_own_recordings'
  ) THEN
    CREATE POLICY "child_own_recordings" ON "EmergencyRecording"
      FOR ALL
      USING  ((SELECT auth.uid())::text = "childId")
      WITH CHECK ((SELECT auth.uid())::text = "childId");
  END IF;
END $$;

-- Parent can read recordings for their children
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'EmergencyRecording'
      AND policyname = 'parent_reads_child_recordings'
  ) THEN
    CREATE POLICY "parent_reads_child_recordings" ON "EmergencyRecording"
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM "User" c
          WHERE c.id = "EmergencyRecording"."childId"
            AND c."parentId" = (SELECT auth.uid())::text
        )
      );
  END IF;
END $$;

-- ── 5. RideRequest table ──────────────────────────────────────
-- Child-initiated ride requests. NOT a Ride row. Parent must approve before a Ride is created.
-- Rate-limited to 2 requests per child per 15 minutes (enforced at API layer).
CREATE TABLE IF NOT EXISTS "RideRequest" (
  "id"               TEXT NOT NULL DEFAULT uuid_generate_v4(),
  "childId"          TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "parentId"         TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "requestedPickup"  TEXT NOT NULL,
  "requestedDropoff" TEXT NOT NULL,
  "status"           TEXT NOT NULL DEFAULT 'PENDING'
                       CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED')),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RideRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RideRequest" ENABLE ROW LEVEL SECURITY;

-- Child reads their own requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'RideRequest'
      AND policyname = 'child_own_ride_requests'
  ) THEN
    CREATE POLICY "child_own_ride_requests" ON "RideRequest"
      FOR ALL
      USING  ((SELECT auth.uid())::text = "childId")
      WITH CHECK ((SELECT auth.uid())::text = "childId");
  END IF;
END $$;

-- Parent reads/manages requests for their children
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'RideRequest'
      AND policyname = 'parent_manages_child_requests'
  ) THEN
    CREATE POLICY "parent_manages_child_requests" ON "RideRequest"
      FOR ALL
      USING  ((SELECT auth.uid())::text = "parentId")
      WITH CHECK ((SELECT auth.uid())::text = "parentId");
  END IF;
END $$;

-- ── 6. RideNotification table ─────────────────────────────────
-- In-app notifications for parents. Extended with SMS/push by updating emitRideEvent().
CREATE TABLE IF NOT EXISTS "RideNotification" (
  "id"            TEXT NOT NULL DEFAULT uuid_generate_v4(),
  "parentId"      TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "rideId"        TEXT REFERENCES "Ride"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "rideRequestId" TEXT REFERENCES "RideRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "message"       TEXT NOT NULL,
  "read"          BOOLEAN NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RideNotification_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RideNotification" ENABLE ROW LEVEL SECURITY;

-- Parent reads/updates their own notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'RideNotification'
      AND policyname = 'parent_own_notifications'
  ) THEN
    CREATE POLICY "parent_own_notifications" ON "RideNotification"
      FOR ALL
      USING  ((SELECT auth.uid())::text = "parentId")
      WITH CHECK ((SELECT auth.uid())::text = "parentId");
  END IF;
END $$;

-- ── 7. Parent → child RLS policies on existing tables ─────────

-- Ride: parent can read rides they booked for their child
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'Ride'
      AND policyname = 'parent_reads_child_rides'
  ) THEN
    CREATE POLICY "parent_reads_child_rides" ON "Ride"
      FOR SELECT
      USING (
        (SELECT auth.uid())::text = "riderId"
        OR (SELECT auth.uid())::text = "requestedByParentId"
      );
  END IF;
END $$;

-- Incident: parent can read incidents reported by their children
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'Incident'
      AND policyname = 'parent_reads_child_incidents'
  ) THEN
    CREATE POLICY "parent_reads_child_incidents" ON "Incident"
      FOR SELECT
      USING (
        (SELECT auth.uid())::text = "reporterId"
        OR EXISTS (
          SELECT 1 FROM "User" c
          WHERE c.id = "Incident"."reporterId"
            AND c."parentId" = (SELECT auth.uid())::text
        )
      );
  END IF;
END $$;

-- ── 8. Index for rate limiting query performance ──────────────
CREATE INDEX IF NOT EXISTS "RideRequest_childId_createdAt_idx"
  ON "RideRequest" ("childId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Ride_requestedByParentId_idx"
  ON "Ride" ("requestedByParentId");
