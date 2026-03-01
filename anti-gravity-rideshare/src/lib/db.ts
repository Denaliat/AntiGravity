import { supabase } from './supabase';
import { User, ParcelDelivery, ProofOfDelivery, TrackingEvent, AuditEvent, Ride, ChangeRequest, Incident, UserVerificationDocument, VerificationDocumentType, DriverEligibility, VerificationSignal, ReviewAuditEvent } from './types';

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
    },
    incidents: {
        create: async (incident: Incident) => {
            const { id, ...rest } = incident; // Let DB generate ID if not provided, or use it
            const { data, error } = await supabase.from('Incident').insert(rest).select().single();
            if (error) throw error;
            return data as Incident;
        },
        findById: async (id: string) => {
            const { data } = await supabase.from('Incident').select('*').eq('id', id).single();
            return data as Incident | null;
        },
        findByReporter: async (userId: string) => {
            const { data } = await supabase.from('Incident').select('*').eq('reporterId', userId);
            return data as Incident[] || [];
        }
    },
    audit: {
        log: async (event: Omit<AuditEvent, 'auditId' | 'timestamp'>) => {
            const { data, error } = await supabase.from('AuditEvent').insert(event).select().single();
            if (error) console.error('Failed to log audit event:', error);
            return data;
        }
    },
    verificationDocuments: {
        /**
         * Inserts a new document submission row for a driver.
         * Sets status to PENDING and uploadedAt to now().
         * If a PENDING/VERIFIED row already exists (partial unique index),
         * this will throw — the caller should first check eligibility.
         */
        upsertSubmission: async (
            userId: string,
            docType: VerificationDocumentType,
            fileUrl: string,
            expiresAt?: string
        ): Promise<UserVerificationDocument> => {
            const { data, error } = await supabase
                .from('UserVerificationDocument')
                .insert({
                    userId,
                    documentType: docType,
                    fileUrl,
                    uploadedAt: new Date().toISOString(),
                    expiresAt: expiresAt ?? null,
                    status: 'PENDING',
                })
                .select()
                .single();
            if (error) throw error;
            return data as UserVerificationDocument;
        },

        /** Fetch all document rows for a driver, newest first. */
        findByUser: async (userId: string): Promise<UserVerificationDocument[]> => {
            const { data, error } = await supabase
                .from('UserVerificationDocument')
                .select('*')
                .eq('userId', userId)
                .order('uploadedAt', { ascending: false });
            if (error) throw error;
            return (data ?? []) as UserVerificationDocument[];
        },

        /**
         * Admin review action.
         * Enforces: rejectionReason required when status = REJECTED.
         */
        review: async (
            id: string,
            decision: {
                status: 'VERIFIED' | 'REJECTED';
                reviewedBy: string;
                rejectionReason?: string;
            }
        ): Promise<UserVerificationDocument> => {
            if (decision.status === 'REJECTED' && !decision.rejectionReason) {
                throw new Error('rejectionReason is required when rejecting a document.');
            }
            const { data, error } = await supabase
                .from('UserVerificationDocument')
                .update({
                    status: decision.status,
                    reviewedBy: decision.reviewedBy,
                    reviewedAt: new Date().toISOString(),
                    rejectionReason: decision.rejectionReason ?? null,
                })
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return data as UserVerificationDocument;
        },
    },
    drivers: {
        /** Update a driver's personal details and license/insurance metadata. */
        updatePersonalDetails: async (
            userId: string,
            fields: Partial<Pick<User,
                'name' | 'dateOfBirth' | 'licenseNumber' | 'licenseExpiry' |
                'insurancePolicyNumber' | 'insuranceExpiry'
            >>
        ): Promise<User> => {
            const { data, error } = await supabase
                .from('User')
                .update(fields)
                .eq('id', userId)
                .select()
                .single();
            if (error) throw error;
            return data as User;
        },

        /** Query the DriverEligibility VIEW for a single driver. */
        getEligibility: async (userId: string): Promise<DriverEligibility | null> => {
            const { data, error } = await supabase
                .from('DriverEligibility')
                .select('*')
                .eq('userId', userId)
                .single();
            if (error) return null;
            return data as DriverEligibility;
        },
    },
    signals: {
        /** Bulk-insert signal rows generated by the evaluator. No-op if array is empty. */
        persist: async (docId: string, signals: VerificationSignal[]): Promise<void> => {
            if (signals.length === 0) return;
            const rows = signals.map(s => ({
                userVerificationDocumentId: docId,
                signalCode: s.code,
                severity: s.severity,
                evidence: s.evidence,
            }));
            const { error } = await supabase.from('VerificationSignalEvent').insert(rows);
            if (error) console.error('Failed to persist signals:', error);
        },

        /** Fetch all signal rows for a document (for display without re-evaluating). */
        findByDocument: async (docId: string): Promise<VerificationSignal[]> => {
            const { data, error } = await supabase
                .from('VerificationSignalEvent')
                .select('*')
                .eq('userVerificationDocumentId', docId)
                .order('createdAt', { ascending: true });
            if (error) throw error;
            // Map DB rows → VerificationSignal shape (add client-only defaults)
            return (data ?? []).map((row: any) => ({
                id: row.id,
                documentId: row.userVerificationDocumentId,
                code: row.signalCode,
                severity: row.severity,
                label: row.evidence?.label ?? row.signalCode,
                explanation: row.evidence?.explanation ?? '',
                evidence: row.evidence ?? {},
                requiresConfirmation: row.severity === 'BLOCK',
                confirmed: false,
                createdAt: row.createdAt,
            })) as VerificationSignal[];
        },
    },
    reviewAudit: {
        /** Log a reviewer action (VIEWED, SIGNAL_EXPANDED, APPROVED, REJECTED, ESCALATED). */
        log: async (event: Omit<ReviewAuditEvent, 'id' | 'createdAt'>): Promise<void> => {
            const { error } = await supabase.from('ReviewAuditEvent').insert({
                userVerificationDocumentId: event.documentId,
                reviewerId: event.reviewerId,
                action: event.action,
                signalCode: event.signalCode ?? null,
                rejectionReason: event.rejectionReason ?? null,
                secondaryReviewRequired: event.secondaryReviewRequired,
            });
            if (error) console.error('Failed to log review audit event:', error);
        },

        /** Fetch all audit events for a document (for Ombud review). */
        findByDocument: async (docId: string): Promise<ReviewAuditEvent[]> => {
            const { data, error } = await supabase
                .from('ReviewAuditEvent')
                .select('*')
                .eq('userVerificationDocumentId', docId)
                .order('createdAt', { ascending: true });
            if (error) throw error;
            return (data ?? []).map((row: any) => ({
                id: row.id,
                documentId: row.userVerificationDocumentId,
                reviewerId: row.reviewerId,
                action: row.action,
                signalCode: row.signalCode,
                rejectionReason: row.rejectionReason,
                secondaryReviewRequired: row.secondaryReviewRequired,
                createdAt: row.createdAt,
            })) as ReviewAuditEvent[];
        },
    },
};
