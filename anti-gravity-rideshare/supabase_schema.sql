-- Enable RLS (Security)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;

-- 1. Create Enums
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'DRIVER', 'RIDER', 'SENDER', 'RECIPIENT', 'PARENT', 'CHILD', 'LEAD_ADMIN', 'SUPPORT', 'DEVELOPER');
CREATE TYPE "DeliveryStatus" AS ENUM ('BOOKED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION');
CREATE TYPE "RideStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "IncidentType" AS ENUM ('ACCIDENT', 'SAFETY_CONCERN', 'LOST_ITEM', 'HARASSMENT', 'OTHER');
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED');
CREATE TYPE "IncidentPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- 2. Create Tables
-- User Table
CREATE TABLE "User" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "parentId" TEXT,
    "isLocationHidden" BOOLEAN DEFAULT false,
    "referralCode" TEXT,
    "walletBalance" DOUBLE PRECISION DEFAULT 0.0,
    "licenseNumber" TEXT,
    "licenseExpiry" TIMESTAMP(3),
    "insurancePolicyNumber" TEXT,
    "insuranceExpiry" TIMESTAMP(3),
    "dateOfBirth" DATE,
    "consentVersion" TEXT,
    "consentDate" TIMESTAMP(3),
    "parentalConsentDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- ParcelDelivery Table
CREATE TABLE "ParcelDelivery" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "trackingId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "driverId" TEXT,
    "pickupTime" TIMESTAMP(3),
    "deliveryTime" TIMESTAMP(3),
    "status" "DeliveryStatus" NOT NULL DEFAULT 'BOOKED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParcelDelivery_pkey" PRIMARY KEY ("id")
);

-- ProofOfDelivery Table
CREATE TABLE "ProofOfDelivery" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "deliveryId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "signatureImageUrl" TEXT,
    "photoImageUrl" TEXT,
    "recipientName" TEXT NOT NULL,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProofOfDelivery_pkey" PRIMARY KEY ("id")
);

-- TrackingEvent Table
CREATE TABLE "TrackingEvent" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "deliveryId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "status" "DeliveryStatus" NOT NULL,
    "notes" TEXT,

    CONSTRAINT "TrackingEvent_pkey" PRIMARY KEY ("id")
);

-- Ride Table
CREATE TABLE "Ride" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "riderId" TEXT NOT NULL,
    "driverId" TEXT,
    "pickupLocation" TEXT NOT NULL,
    "dropoffLocation" TEXT NOT NULL,
    "status" "RideStatus" NOT NULL DEFAULT 'REQUESTED',
    "fare" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ride_pkey" PRIMARY KEY ("id")
);

-- AuditEvent Table
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" TEXT NOT NULL,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- ChangeRequest Table
CREATE TABLE "ChangeRequest" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "developerId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,

    CONSTRAINT "ChangeRequest_pkey" PRIMARY KEY ("id")
);

-- 3. Create Indexes & Unique Constraints
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");
CREATE UNIQUE INDEX "ParcelDelivery_trackingId_key" ON "ParcelDelivery"("trackingId");
CREATE UNIQUE INDEX "ProofOfDelivery_deliveryId_key" ON "ProofOfDelivery"("deliveryId");

-- 4. Add Foreign Keys
ALTER TABLE "User" ADD CONSTRAINT "User_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ParcelDelivery" ADD CONSTRAINT "ParcelDelivery_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ParcelDelivery" ADD CONSTRAINT "ParcelDelivery_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ParcelDelivery" ADD CONSTRAINT "ParcelDelivery_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProofOfDelivery" ADD CONSTRAINT "ProofOfDelivery_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "ParcelDelivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TrackingEvent" ADD CONSTRAINT "TrackingEvent_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "ParcelDelivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Ride" ADD CONSTRAINT "Ride_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Enable RLS (As requested in Implementation Plan)
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Ride" ENABLE ROW LEVEL SECURITY;
