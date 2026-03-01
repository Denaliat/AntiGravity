export type UserRole = 'ADMIN' | 'DRIVER' | 'RIDER' | 'SENDER' | 'RECIPIENT' | 'PARENT' | 'CHILD' | 'LEAD_ADMIN' | 'SUPPORT' | 'DEVELOPER';

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
