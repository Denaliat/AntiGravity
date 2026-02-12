import { supabase } from './supabase';
import { User, ParcelDelivery, ProofOfDelivery, TrackingEvent, AuditEvent, Ride, ChangeRequest } from './types';

export * from './types';

// Helper to map Supabase Parcel to App Parcel type
const mapParcel = (p: any): ParcelDelivery => {
    if (!p) return null as any;
    // Map PostgREST relation responses (usually capitalized table names) to App props
    // Note: If schema uses explicit relation names, PostgREST might use those. Assuming Table Names for now.
    const events = p.TrackingEvent || p.events || [];
    const proof = p.ProofOfDelivery || p.proof || (Object.keys(p).includes('ProofOfDelivery') ? p.ProofOfDelivery : undefined);

    return {
        ...p,
        deliveryId: p.id,
        trackingEvents: events,
        proofOfDelivery: proof ? { ...proof, proofId: proof.id } : undefined,
        auditLog: [] // Implement AuditEvent fetching if needed
    };
};

// Helper to map Supabase Ride to App Ride type
const mapRide = (r: any): Ride => {
    if (!r) return null as any;
    return {
        ...r,
        rideId: r.id
    };
};

export const db = {
    users: {
        findById: async (id: string) => {
            const { data } = await supabase.from('User').select('*').eq('id', id).single();
            return data as User | null;
        },
        findByEmail: async (email: string) => {
            const { data } = await supabase.from('User').select('*').eq('email', email).single();
            return data as User | null;
        },
        findByReferralCode: async (code: string) => {
            const { data } = await supabase.from('User').select('*').eq('referralCode', code).single();
            return data as User | null;
        },
        create: async (user: User) => {
            const { data, error } = await supabase.from('User').insert({
                ...user,
                permissions: user.permissions || []
            }).select().single();
            if (error) throw error;
            return data as User;
        },
        update: async (id: string, updates: Partial<User>) => {
            const { data, error } = await supabase.from('User').update(updates).eq('id', id).select().single();
            if (error) throw error;
            return data as User;
        },
    },
    bookings: {
        create: async (booking: ParcelDelivery) => {
            const { deliveryId, trackingEvents, auditLog, proofOfDelivery, ...rest } = booking;
            // Supabase insert
            const { data, error } = await supabase.from('ParcelDelivery').insert({
                ...rest,
                // Status defaults to BOOKED if not provided
            }).select('*, TrackingEvent(*), ProofOfDelivery(*)').single();

            if (error) throw error;
            return mapParcel(data);
        },
        findById: async (id: string) => {
            const { data } = await supabase.from('ParcelDelivery')
                .select('*, TrackingEvent(*), ProofOfDelivery(*)')
                .eq('id', id)
                .single();
            return mapParcel(data);
        },
        findByTrackingId: async (tid: string) => {
            const { data } = await supabase.from('ParcelDelivery')
                .select('*, TrackingEvent(*), ProofOfDelivery(*)')
                .eq('trackingId', tid)
                .single();
            return mapParcel(data);
        },
        updateStatus: async (id: string, status: any, event: any) => {
            // Update status
            const { error: updateError } = await supabase.from('ParcelDelivery').update({ status }).eq('id', id);
            if (updateError) throw updateError;

            // Create tracking event
            const { eventId, ...eventData } = event;
            const { error: eventError } = await supabase.from('TrackingEvent').insert({
                ...eventData,
                deliveryId: id
            });
            if (eventError) throw eventError;

            // Return updated parcel
            const { data } = await supabase.from('ParcelDelivery')
                .select('*, TrackingEvent(*), ProofOfDelivery(*)')
                .eq('id', id)
                .single();
            return mapParcel(data);
        }
    },
    proofs: {
        create: async (proof: ProofOfDelivery) => {
            const { proofId, ...rest } = proof;
            const { data, error } = await supabase.from('ProofOfDelivery').insert(rest).select().single();
            if (error) throw error;
            return { ...data, proofId: data.id };
        },
        findByDeliveryId: async (deliveryId: string) => {
            const { data } = await supabase.from('ProofOfDelivery').select('*').eq('deliveryId', deliveryId).single();
            return data ? { ...data, proofId: data.id } : null;
        }
    },
    changeRequests: {
        create: async (req: ChangeRequest) => {
            const { data, error } = await supabase.from('ChangeRequest').insert(req).select().single();
            if (error) throw error;
            return data;
        },
        findAll: async () => {
            const { data } = await supabase.from('ChangeRequest').select('*');
            return data || [];
        },
        updateStatus: async (id: string, status: any, reviewerId: string) => {
            const { data, error } = await supabase.from('ChangeRequest')
                .update({ status, reviewedBy: reviewerId })
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return data;
        }
    },
    rides: {
        create: async (ride: Ride) => {
            const { rideId, ...rest } = ride;
            const { data, error } = await supabase.from('Ride').insert(rest).select().single();
            if (error) throw error;
            return mapRide(data);
        },
        findAll: async (status?: string) => {
            let query = supabase.from('Ride').select('*');
            if (status) {
                query = query.eq('status', status);
            }
            const { data } = await query;
            return (data || []).map(mapRide);
        },
        findById: async (id: string) => {
            const { data } = await supabase.from('Ride').select('*').eq('id', id).single();
            return mapRide(data);
        },
        updateStatus: async (id: string, status: any, driverId?: string) => {
            const updates: any = { status };
            if (driverId !== undefined) updates.driverId = driverId;

            const { data, error } = await supabase.from('Ride').update(updates).eq('id', id).select().single();
            if (error) throw error;
            return mapRide(data);
        }
    }
};
