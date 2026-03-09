-- ============================================================
-- Core RLS Security Patch: Multi-Tenant Data Isolation
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- Safe to run multiple times (idempotent).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Helper Functions
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.jwt() ->> 'app_role') IN ('ADMIN', 'LEAD_ADMIN', 'SUPPORT');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ────────────────────────────────────────────────────────────
-- 2. User Table Policies
-- ────────────────────────────────────────────────────────────
-- RLS already enabled in supabase_schema.sql

DROP POLICY IF EXISTS "user_read_own" ON "User";
CREATE POLICY "user_read_own" ON "User"
  FOR SELECT TO authenticated
  USING (auth.uid()::text = id OR is_admin());

DROP POLICY IF EXISTS "user_update_own" ON "User";
CREATE POLICY "user_update_own" ON "User"
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = id)
  WITH CHECK (auth.uid()::text = id);

DROP POLICY IF EXISTS "admin_all_users" ON "User";
CREATE POLICY "admin_all_users" ON "User"
  FOR ALL TO authenticated
  USING (is_admin());

-- ────────────────────────────────────────────────────────────
-- 3. Ride Table Policies
-- ────────────────────────────────────────────────────────────
-- RLS already enabled in supabase_schema.sql
-- parent_reads_child_rides policy already exists in parent_child_patch.sql

DROP POLICY IF EXISTS "rider_read_own_rides" ON "Ride";
CREATE POLICY "rider_read_own_rides" ON "Ride"
  FOR SELECT TO authenticated
  USING (auth.uid()::text = "riderId");

DROP POLICY IF EXISTS "driver_read_assigned_rides" ON "Ride";
CREATE POLICY "driver_read_assigned_rides" ON "Ride"
  FOR SELECT TO authenticated
  USING (auth.uid()::text = "driverId");

DROP POLICY IF EXISTS "admin_all_rides" ON "Ride";
CREATE POLICY "admin_all_rides" ON "Ride"
  FOR ALL TO authenticated
  USING (is_admin());

-- ────────────────────────────────────────────────────────────
-- 4. ParcelDelivery Table Policies
-- ────────────────────────────────────────────────────────────
ALTER TABLE "ParcelDelivery" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sender_read_own_deliveries" ON "ParcelDelivery";
CREATE POLICY "sender_read_own_deliveries" ON "ParcelDelivery"
  FOR SELECT TO authenticated
  USING (auth.uid()::text = "senderId");

DROP POLICY IF EXISTS "recipient_read_own_deliveries" ON "ParcelDelivery";
CREATE POLICY "recipient_read_own_deliveries" ON "ParcelDelivery"
  FOR SELECT TO authenticated
  USING (auth.uid()::text = "recipientId");

DROP POLICY IF EXISTS "driver_read_assigned_deliveries" ON "ParcelDelivery";
CREATE POLICY "driver_read_assigned_deliveries" ON "ParcelDelivery"
  FOR SELECT TO authenticated
  USING (auth.uid()::text = "driverId");

DROP POLICY IF EXISTS "admin_all_deliveries" ON "ParcelDelivery";
CREATE POLICY "admin_all_deliveries" ON "ParcelDelivery"
  FOR ALL TO authenticated
  USING (is_admin());

-- ────────────────────────────────────────────────────────────
-- 5. ProofOfDelivery & TrackingEvent Policies
-- ────────────────────────────────────────────────────────────
ALTER TABLE "ProofOfDelivery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrackingEvent" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pod_access_via_delivery" ON "ProofOfDelivery";
CREATE POLICY "pod_access_via_delivery" ON "ProofOfDelivery"
  FOR SELECT TO authenticated
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM "ParcelDelivery" pd
      WHERE pd.id = "ProofOfDelivery"."deliveryId"
        AND (auth.uid()::text IN (pd."senderId", pd."recipientId", pd."driverId"))
    )
  );

DROP POLICY IF EXISTS "tracking_access_via_delivery" ON "TrackingEvent";
CREATE POLICY "tracking_access_via_delivery" ON "TrackingEvent"
  FOR SELECT TO authenticated
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM "ParcelDelivery" pd
      WHERE pd.id = "TrackingEvent"."deliveryId"
        AND (auth.uid()::text IN (pd."senderId", pd."recipientId", pd."driverId"))
    )
  );

-- ────────────────────────────────────────────────────────────
-- 6. AuditEvent Policies
-- ────────────────────────────────────────────────────────────
ALTER TABLE "AuditEvent" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_audit_events" ON "AuditEvent";
CREATE POLICY "admin_read_audit_events" ON "AuditEvent"
  FOR SELECT TO authenticated
  USING (is_admin());

-- ────────────────────────────────────────────────────────────
-- 7. ChangeRequest Policies
-- ────────────────────────────────────────────────────────────
ALTER TABLE "ChangeRequest" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dev_read_own_requests" ON "ChangeRequest";
CREATE POLICY "dev_read_own_requests" ON "ChangeRequest"
  FOR SELECT TO authenticated
  USING (auth.uid()::text = "developerId" OR is_admin());

DROP POLICY IF EXISTS "dev_insert_requests" ON "ChangeRequest";
CREATE POLICY "dev_insert_requests" ON "ChangeRequest"
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = "developerId");

DROP POLICY IF EXISTS "admin_all_requests" ON "ChangeRequest";
CREATE POLICY "admin_all_requests" ON "ChangeRequest"
  FOR ALL TO authenticated
  USING (is_admin());

-- ────────────────────────────────────────────────────────────
-- 8. Incident Policies
-- ────────────────────────────────────────────────────────────
ALTER TABLE "Incident" ENABLE ROW LEVEL SECURITY;
-- parent_reads_child_incidents already exists

DROP POLICY IF EXISTS "reporter_read_own_incidents" ON "Incident";
CREATE POLICY "reporter_read_own_incidents" ON "Incident"
  FOR SELECT TO authenticated
  USING (auth.uid()::text = "reporterId" OR is_admin());

DROP POLICY IF EXISTS "admin_all_incidents" ON "Incident";
CREATE POLICY "admin_all_incidents" ON "Incident"
  FOR ALL TO authenticated
  USING (is_admin());
