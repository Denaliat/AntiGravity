import { prisma } from './prisma';
import { User, ParcelDelivery, ProofOfDelivery, TrackingEvent, AuditEvent, Ride, ChangeRequest } from './types';

export * from './types';

// Helper to map Prisma Parcel to App Parcel type
const mapParcel = (p: any): ParcelDelivery => {
    if (!p) return null as any;
    return {
        ...p,
        deliveryId: p.id,
        trackingEvents: p.trackingEvents || [],
        proofOfDelivery: p.proof ? { ...p.proof, proofId: p.proof.id } : undefined,
        auditLog: [] // Prisma schema calls it AuditEvent but relations are tricky, we'll skip for now or fetch separately
    };
};

// Helper to map Prisma Ride to App Ride type
const mapRide = (r: any): Ride => {
    if (!r) return null as any;
    return {
        ...r,
        rideId: r.id
    };
};

export const db = {
    users: {
        findById: async (id: string) => prisma.user.findUnique({ where: { id } }) as Promise<User | null>,
        findByEmail: async (email: string) => prisma.user.findUnique({ where: { email } }) as Promise<User | null>,
        findByReferralCode: async (code: string) => prisma.user.findUnique({ where: { referralCode: code } }) as Promise<User | null>,
        create: async (user: User) => prisma.user.create({ data: { ...user, permissions: user.permissions || [] } }) as Promise<User>,
        update: async (id: string, data: Partial<User>) => prisma.user.update({ where: { id }, data: data as any }) as Promise<User>,
    },
    bookings: {
        create: async (booking: ParcelDelivery) => {
            const { deliveryId, trackingEvents, auditLog, proofOfDelivery, ...rest } = booking;
            // Map App type back to Prisma inputs
            const res = await prisma.parcelDelivery.create({
                data: {
                    ...rest,
                    trackingEvents: { create: [] }
                },
                include: { trackingEvents: true, proof: true }
            });
            return mapParcel(res);
        },
        findById: async (id: string) => {
            const res = await prisma.parcelDelivery.findUnique({
                where: { id },
                include: { trackingEvents: true, proof: true }
            });
            return mapParcel(res);
        },
        findByTrackingId: async (tid: string) => {
            const res = await prisma.parcelDelivery.findUnique({
                where: { trackingId: tid },
                include: { trackingEvents: true, proof: true }
            });
            return mapParcel(res);
        },
        updateStatus: async (id: string, status: any, event: any) => {
            const { eventId, ...eventData } = event; // remove ID to let db gen it or map it
            const res = await prisma.parcelDelivery.update({
                where: { id },
                data: {
                    status,
                    trackingEvents: { create: eventData }
                },
                include: { trackingEvents: true, proof: true }
            });
            return mapParcel(res);
        }
    },
    proofs: {
        create: async (proof: ProofOfDelivery) => {
            const { proofId, ...rest } = proof;
            const res = await prisma.proofOfDelivery.create({ data: rest });
            return { ...res, proofId: res.id };
        },
        findByDeliveryId: async (deliveryId: string) => {
            const res = await prisma.proofOfDelivery.findUnique({ where: { deliveryId } });
            return res ? { ...res, proofId: res.id } : null;
        }
    },
    changeRequests: {
        create: async (req: ChangeRequest) => prisma.changeRequest.create({ data: req }),
        findAll: async () => prisma.changeRequest.findMany(),
        updateStatus: async (id: string, status: any, reviewerId: string) => prisma.changeRequest.update({
            where: { id },
            data: { status, reviewedBy: reviewerId }
        })
    },
    rides: {
        create: async (ride: Ride) => {
            const { rideId, ...rest } = ride;
            const res = await prisma.ride.create({ data: rest });
            return mapRide(res);
        },
        findAll: async (status?: string) => {
            const res = await prisma.ride.findMany({ where: status ? { status: status as any } : undefined });
            return res.map(mapRide);
        },
        findById: async (id: string) => {
            const res = await prisma.ride.findUnique({ where: { id } });
            return mapRide(res);
        },
        updateStatus: async (id: string, status: any, driverId?: string) => {
            const res = await prisma.ride.update({
                where: { id },
                data: { status, driverId }
            });
            return mapRide(res);
        }
    }
};
