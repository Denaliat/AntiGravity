export type UserRole = 'ADMIN' | 'DRIVER' | 'SENDER' | 'RECIPIENT' | 'PARENT' | 'CHILD';

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    parentId?: string; // For CHILD accounts
    isLocationHidden?: boolean; // For CHILD accounts
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
