import { supabase } from './supabase';
import { User, ParcelDelivery, ProofOfDelivery, TrackingEvent, AuditEvent, Ride, ChangeRequest, Incident, UserVerificationDocument, VerificationDocumentType, DriverEligibility, VerificationSignal, ReviewAuditEvent, EmergencyContact, EmergencyRecording, RideRequest, RideNotification } from './types';

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
            // Guard: these fields must never be updated via the generic update path
            const DENIED_FIELDS: (keyof User)[] = ['id', 'role', 'parentId'];
            const safeUpdates = { ...updates };
            for (const field of DENIED_FIELDS) {
                delete safeUpdates[field];
            }
            const { data, error } = await supabase.from('User').update(safeUpdates).eq('id', id).select().single();
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
            // Explicit allowlist — only write the 6 permitted fields
            const ALLOWED: (keyof typeof fields)[] = [
                'name', 'dateOfBirth', 'licenseNumber', 'licenseExpiry',
                'insurancePolicyNumber', 'insuranceExpiry',
            ];
            const safeFields = ALLOWED.reduce((acc, key) => {
                if (fields[key] !== undefined) acc[key] = fields[key] as string;
                return acc;
            }, {} as Record<string, string>);

            if (Object.keys(safeFields).length === 0) {
                // Nothing to update — return current row
                const { data } = await supabase.from('User').select('*').eq('id', userId).single();
                return data as User;
            }

            const { data, error } = await supabase
                .from('User')
                .update(safeFields)
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

    // ── Emergency Contacts ─────────────────────────────────────────────────────────
    emergencyContacts: {
        /** Fetch all emergency contacts for a parent. */
        findByParent: async (parentId: string): Promise<EmergencyContact[]> => {
            const { data, error } = await supabase
                .from('EmergencyContact')
                .select('*')
                .eq('parentId', parentId)
                .order('isPrimary', { ascending: false });
            if (error) throw error;
            return (data ?? []) as EmergencyContact[];
        },

        /** Returns true if parent has at least 1 primary AND 1 secondary contact. */
        hasRequiredContacts: async (parentId: string): Promise<boolean> => {
            const contacts = await db.emergencyContacts.findByParent(parentId);
            return contacts.some(c => c.isPrimary) && contacts.some(c => !c.isPrimary);
        },

        /** Create or replace an emergency contact for a parent.
         *  Enforces max 1 primary and max 1 secondary per parent. */
        upsert: async (
            parentId: string,
            contact: Omit<EmergencyContact, 'id' | 'parentId' | 'createdAt'>
        ): Promise<EmergencyContact> => {
            // Validate E.164 phone format
            const e164Regex = /^\+[1-9]\d{1,14}$/;
            if (!e164Regex.test(contact.phone)) {
                throw new Error('Phone must be in E.164 format (e.g. +14165550100)');
            }
            // Delete existing contact of same type (primary or secondary) for this parent
            await supabase
                .from('EmergencyContact')
                .delete()
                .eq('parentId', parentId)
                .eq('isPrimary', contact.isPrimary);

            const { data, error } = await supabase
                .from('EmergencyContact')
                .insert({ ...contact, parentId })
                .select()
                .single();
            if (error) throw error;
            return data as EmergencyContact;
        },
    },

    // ── Emergency Recordings ─────────────────────────────────────────────────────
    emergencyRecordings: {
        /** Find an active (status=RECORDING) recording for a child — for deduplication. */
        findActiveByChild: async (childId: string): Promise<EmergencyRecording | null> => {
            const { data, error } = await supabase
                .from('EmergencyRecording')
                .select('*')
                .eq('childId', childId)
                .eq('status', 'RECORDING')
                .order('startedAt', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (error) return null;
            return data as EmergencyRecording | null;
        },

        /** Count SOS activations for a child in a rolling time window (for rate limiting). */
        countRecentByChild: async (childId: string, windowMinutes: number): Promise<number> => {
            const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
            const { count, error } = await supabase
                .from('EmergencyRecording')
                .select('id', { count: 'exact', head: true })
                .eq('childId', childId)
                .gte('startedAt', since);
            if (error) return 0;
            return count ?? 0;
        },

        /** Create a new recording row (incidentId is null initially). */
        create: async (childId: string): Promise<EmergencyRecording> => {
            const { data, error } = await supabase
                .from('EmergencyRecording')
                .insert({
                    childId,
                    startedBy: 'CHILD_SOS',
                    incidentId: null,
                    status: 'RECORDING',
                })
                .select()
                .single();
            if (error) throw error;
            return data as EmergencyRecording;
        },

        /** Link the recording to an Incident once created (optimistic attach). */
        attachIncident: async (recordingId: string, incidentId: string): Promise<void> => {
            const { error } = await supabase
                .from('EmergencyRecording')
                .update({ incidentId })
                .eq('id', recordingId);
            if (error) console.error('Failed to attach incidentId to recording:', error);
        },

        /** Mark recording as complete and store the uploaded URL. */
        markComplete: async (recordingId: string, recordingUrl: string, childId: string): Promise<EmergencyRecording> => {
            const { data, error } = await supabase
                .from('EmergencyRecording')
                .update({
                    status: 'COMPLETE',
                    recordingUrl,
                    completedAt: new Date().toISOString(),
                })
                .eq('id', recordingId)
                .eq('childId', childId) // ownership guard
                .select()
                .single();
            if (error) throw error;
            return data as EmergencyRecording;
        },

        /** Mark recording as failed (e.g. MediaRecorder error). */
        markFailed: async (recordingId: string, childId: string): Promise<void> => {
            const { error } = await supabase
                .from('EmergencyRecording')
                .update({ status: 'FAILED', completedAt: new Date().toISOString() })
                .eq('id', recordingId)
                .eq('childId', childId);
            if (error) console.error('Failed to mark recording as FAILED:', error);
        },

        /** Fetch all recordings for an incident (for parent/admin view). */
        findByIncident: async (incidentId: string): Promise<EmergencyRecording[]> => {
            const { data, error } = await supabase
                .from('EmergencyRecording')
                .select('*')
                .eq('incidentId', incidentId);
            if (error) throw error;
            return (data ?? []) as EmergencyRecording[];
        },
    },

    // ── Ride Requests (child-initiated, not a Ride row) ────────────────────────────
    rideRequests: {
        create: async (req: Omit<RideRequest, 'id' | 'createdAt' | 'status'>): Promise<RideRequest> => {
            const { data, error } = await supabase
                .from('RideRequest')
                .insert({ ...req, status: 'PENDING' })
                .select()
                .single();
            if (error) throw error;
            return data as RideRequest;
        },

        findByParent: async (parentId: string): Promise<RideRequest[]> => {
            const { data, error } = await supabase
                .from('RideRequest')
                .select('*')
                .eq('parentId', parentId)
                .order('createdAt', { ascending: false });
            if (error) throw error;
            return (data ?? []) as RideRequest[];
        },

        /** Count ride requests for a child within a rolling time window (for rate limiting). */
        countRecent: async (childId: string, windowMinutes: number): Promise<number> => {
            const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
            const { count, error } = await supabase
                .from('RideRequest')
                .select('id', { count: 'exact', head: true })
                .eq('childId', childId)
                .gte('createdAt', since);
            if (error) return 0;
            return count ?? 0;
        },

        updateStatus: async (id: string, status: RideRequest['status']): Promise<RideRequest> => {
            const { data, error } = await supabase
                .from('RideRequest')
                .update({ status })
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return data as RideRequest;
        },
    },

    // ── Ride Notifications ──────────────────────────────────────────────────────────
    rideNotifications: {
        create: async (n: Omit<RideNotification, 'id' | 'createdAt' | 'read'>): Promise<RideNotification> => {
            const { data, error } = await supabase
                .from('RideNotification')
                .insert({ ...n, read: false })
                .select()
                .single();
            if (error) throw error;
            return data as RideNotification;
        },

        findByParent: async (parentId: string, unreadOnly = false): Promise<RideNotification[]> => {
            let query = supabase
                .from('RideNotification')
                .select('*')
                .eq('parentId', parentId)
                .order('createdAt', { ascending: false });
            if (unreadOnly) query = query.eq('read', false);
            const { data, error } = await query;
            if (error) throw error;
            return (data ?? []) as RideNotification[];
        },

        markRead: async (id: string, parentId: string): Promise<void> => {
            const { error } = await supabase
                .from('RideNotification')
                .update({ read: true })
                .eq('id', id)
                .eq('parentId', parentId); // ownership guard
            if (error) console.error('Failed to mark notification as read:', error);
        },
    },

    // ── Audit Logging ───────────────────────────────────────────────────────────────
    /** Lightweight audit trail for security-relevant parent-child events. */
    parentChildAudit: {
        log: async (event: {
            action: string;      // e.g. 'SOS_ACTIVATED', 'RIDE_CREATED', 'CONTACTS_CHANGED'
            actorId: string;     // Who performed the action
            childId?: string;
            parentId?: string;
            targetId?: string;   // e.g. rideId, recordingId, contactId
            metadata?: Record<string, unknown>;
        }): Promise<void> => {
            try {
                await supabase.from('ParentChildAuditEvent').insert({
                    action: event.action,
                    actorId: event.actorId,
                    childId: event.childId ?? null,
                    parentId: event.parentId ?? null,
                    targetId: event.targetId ?? null,
                    metadata: event.metadata ?? null,
                });
            } catch (err) {
                // Audit failure must never break the primary flow
                console.error('[parentChildAudit] Failed to log event:', err);
            }
        },
    },
};

