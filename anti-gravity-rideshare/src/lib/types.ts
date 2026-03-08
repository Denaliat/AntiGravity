export type UserRole = 'ADMIN' | 'DRIVER' | 'RIDER' | 'SENDER' | 'RECIPIENT' | 'PARENT' | 'CHILD' | 'LEAD_ADMIN' | 'SUPPORT' | 'DEVELOPER';

export type VerificationStatus = 'UNSUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

export type VerificationDocumentType =
    | 'DRIVERS_LICENSE'
    | 'INSURANCE'
    | 'VULNERABLE_SECTOR_CHECK'
    | 'SELFIE_MATCH'
    | 'VEHICLE_REGISTRATION';

export interface UserVerificationDocument {
    id: string;
    userId: string;
    documentType: VerificationDocumentType;
    fileUrl: string | null;
    uploadedAt: string | null;      // ISO — set at upload time
    expiresAt: string | null;       // ISO — for license, insurance, registration
    status: VerificationStatus;
    reviewedBy: string | null;      // admin userId or 'system'
    reviewedAt: string | null;      // ISO
    rejectionReason: string | null; // required when status === 'REJECTED'
    createdAt: string;
    updatedAt: string;
}

export interface DriverEligibility {
    userId: string;
    isEligible: boolean;
    pendingTypes: VerificationDocumentType[]; // types not yet VERIFIED / expired
    asOf: string; // ISO — timestamp of the query
}

// ── Fraud Signal Overlay ─────────────────────────────────────────────────────

export type SignalSeverity = 'INFO' | 'WARN' | 'BLOCK';

/** Signals describe the submission, never the person. */
export type SignalCode =
    // Document-Intrinsic (safe — tied to review quality)
    | 'DOC_EXPIRY_MISSING'              // expiresAt null for a doc type that needs one
    | 'DOC_EXPIRY_OUT_OF_EXPECTED_RANGE' // expiry is unusually far in the future
    | 'DOC_TYPE_MISMATCH'              // wrong doc type uploaded to this slot (scaffolded)
    | 'DOC_BLURRY'                     // readability issue (scaffolded — needs OCR)
    | 'DOC_INCOMPLETE'                 // appears cut-off / missing pages (scaffolded)
    // Submission-Integrity (safe — about the submission, not the person)
    | 'HASH_REUSE_ACROSS_ACCOUNTS'     // same fileUrl used by a different account
    | 'RAPID_RESUBMISSION'             // multiple uploads for same doc type in short window
    // Account-Security (constrained — security anomalies only)
    | 'RECENT_PASSWORD_RESET';         // password reset shortly before document upload

export interface VerificationSignal {
    id: string;
    documentId: string;
    code: SignalCode;
    severity: SignalSeverity;
    /** Short label shown on the tag chip */
    label: string;
    /** One-sentence plain-English explanation shown beneath the tag */
    explanation: string;
    /** Raw data shown in "What triggered this?" */
    evidence: Record<string, unknown>;
    /** True for BLOCK signals — reviewer must tick a checkbox before acting */
    requiresConfirmation: boolean;
    confirmed: boolean; // client-side state only
    createdAt: string;
}

export interface ReviewAuditEvent {
    id: string;
    documentId: string;
    reviewerId: string;
    action: 'VIEWED' | 'SIGNAL_EXPANDED' | 'APPROVED' | 'REJECTED' | 'ESCALATED';
    signalCode?: string;
    rejectionReason?: string;
    secondaryReviewRequired: boolean;
    createdAt: string;
}

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    permissions?: string[]; // For SUPPORT role config
    // CHILD account fields
    parentId?: string;
    isLocationHidden?: boolean;
    rideRestrictionsEnabled?: boolean;    // Parent can disable rides entirely for this child
    allowedPickupLocations?: string[];    // Optional approved pickup addresses
    parentChildEnabled?: boolean;         // Set by parent during onboarding
    // PARENT account fields
    emergencyContacts?: EmergencyContact[];
    // Common optional fields
    referralCode?: string;
    walletBalance?: number;
    consentVersion?: string;
    consentDate?: string;           // ISO Date of acceptance
    dateOfBirth?: string;           // ISO Date (YYYY-MM-DD)
    parentalConsentDate?: string;   // ISO Date (if under 18)
    // Driver license metadata
    licenseNumber?: string;
    licenseExpiry?: string;         // ISO Date
    insurancePolicyNumber?: string;
    insuranceExpiry?: string;       // ISO Date
}

export type DeliveryStatus = 'BOOKED' | 'PICKED_UP' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'EXCEPTION';

export interface ParcelDelivery {
    deliveryId: string;
    parcelId: string;
    senderId: string;
    recipientId: string;
    driverId?: string;
    pickupTime?: string; // ISO Date
    deliveryTime?: string; // ISO Date
    status: DeliveryStatus;
    trackingEvents: TrackingEvent[];
    proofOfDelivery?: ProofOfDelivery;
    auditLog: AuditEvent[];
}

export interface ProofOfDelivery {
    proofId: string;
    deliveryId: string;
    timestamp: string;
    location: {
        latitude: number;
        longitude: number;
    };
    signatureImageUrl?: string; // Encrypted Base64 or URL
    photoImageUrl?: string; // Encrypted Base64 or URL
    recipientName: string;
    isEncrypted: boolean;
}

export interface TrackingEvent {
    eventId: string;
    deliveryId: string;
    timestamp: string;
    location: {
        latitude: number;
        longitude: number;
    };
    status: DeliveryStatus;
    notes?: string;
}

export interface AuditEvent {
    auditId: string;
    entityType: 'ParcelDelivery' | 'ProofOfDelivery' | 'TrackingEvent' | 'User';
    entityId: string;
    action: 'CREATED' | 'UPDATED' | 'ACCESSED' | 'DELETED';
    userId: string;
    timestamp: string;
    details: string;
}

// ── Emergency Contact ────────────────────────────────────────────────────────

/** Parent's emergency contact. Parent must have ≥1 primary + ≥1 secondary before
 *  the parent-child feature can be used for ride booking or SOS. */
export interface EmergencyContact {
    id: string;
    parentId: string;
    name: string;
    phone: string;        // E.164 format e.g. +14165550100
    email?: string;
    relationship: string; // e.g. 'Spouse', 'Grandparent'
    isPrimary: boolean;
    createdAt: string;    // ISO
}

// ── Emergency Recording ──────────────────────────────────────────────────────

/** Created when a child presses SOS. incidentId is null initially and attached
 *  once the Incident row is created, allowing flexible future reuse. */
export interface EmergencyRecording {
    id: string;
    incidentId: string | null;    // nullable — linked after Incident created
    childId: string;
    startedBy: 'CHILD_SOS';       // explicit consent/disclosure metadata
    recordingUrl: string | null;  // Supabase Storage path (null until upload complete)
    status: 'RECORDING' | 'COMPLETE' | 'FAILED';
    startedAt: string;            // ISO
    completedAt: string | null;
}

// ── Ride Request (child-initiated, NOT a Ride row) ────────────────────────────

/** Created when a child requests a ride from their parent. The parent must
 *  approve before a Ride is actually created. Rate-limited to 2/child/15 min. */
export interface RideRequest {
    id: string;
    childId: string;
    parentId: string;
    requestedPickup: string;
    requestedDropoff: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
    createdAt: string; // ISO
}

// ── Ride Notification ─────────────────────────────────────────────────────────

/** In-app notification written to the parent when a ride event occurs or a
 *  child submits a ride request. Designed to be extended with SMS/push later
 *  by adding a channel field and updating emitRideEvent(). */
export interface RideNotification {
    id: string;
    parentId: string;
    rideId?: string;
    rideRequestId?: string;
    message: string;
    read: boolean;
    createdAt: string; // ISO
}

export interface Ride {
    rideId: string;
    riderId: string;                   // The passenger (child's id when booked by parent)
    requestedByParentId?: string;      // Set when a parent books on behalf of a child
    driverId?: string;
    pickupLocation: string;
    pickupCoords?: { lat: number; lng: number };
    dropoffLocation: string;
    dropoffCoords?: { lat: number; lng: number };
    distanceMeters?: number;
    durationSeconds?: number;
    estimatedFare?: number;
    status: 'REQUESTED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    fare: number;
    timestamp: string;
}

export interface ChangeRequest {
    id: string;
    developerId: string;
    description: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    timestamp: string;
    reviewedBy?: string;
}

export type IncidentType = 'ACCIDENT' | 'SAFETY_CONCERN' | 'LOST_ITEM' | 'HARASSMENT' | 'OTHER';
export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';
export type IncidentPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface Incident {
    id: string;
    reporterId: string;
    rideId?: string;
    deliveryId?: string;
    type: IncidentType;
    status: IncidentStatus;
    priority: IncidentPriority;
    description: string;
    resolutionNotes?: string;
    timestamp: string;
    updatedAt: string;
}
