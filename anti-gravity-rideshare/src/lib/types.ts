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
    parentId?: string; // For CHILD accounts
    isLocationHidden?: boolean; // For CHILD accounts
    referralCode?: string; // For DRIVER accounts
    walletBalance?: number; // For DRIVER accounts
    consentVersion?: string; // e.g., "v1.0"
    consentDate?: string; // ISO Date of acceptance
    dateOfBirth?: string; // ISO Date (YYYY-MM-DD)
    parentalConsentDate?: string; // ISO Date (if under 18)

    // Driver license metadata (stored on User for quick access)
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

export interface Ride {
    rideId: string;
    riderId: string;
    driverId?: string;
    pickupLocation: string; // Simplified for prototype
    dropoffLocation: string;
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
