import { User, UserRole, EmergencyContact } from './types';
import { db } from './db';

/**
 * AuthService — lightweight helpers used in non-route contexts.
 * API routes should use requireAuth() / requireAdminAuth() from api-auth.ts instead.
 */
export const AuthService = {
    // Role-Based Access Control Check
    hasPermission: (user: User, requiredRole: UserRole | UserRole[]) => {
        if (Array.isArray(requiredRole)) {
            return requiredRole.includes(user.role);
        }
        return user.role === requiredRole;
    },

    /**
     * Single source of truth for all parent-child safety feature access.
     *
     * Called by both canChildRequestRide() and POST /api/child/emergency to
     * ensure the same pre-conditions are enforced everywhere with no drift.
     *
     * Checks (in order):
     * 1. Child exists + role === 'CHILD'
     * 2. child.parentalConsentDate is set
     * 3. child.parentId resolves to a real parent
     * 4. Parent has ≥1 primary AND ≥1 secondary EmergencyContact
     */
    canChildAccessSafetyFeatures: async (
        childId: string
    ): Promise<{
        allowed: boolean;
        reason?: string;
        missingContacts?: boolean;
        child?: User;
        parent?: User;
        contacts?: EmergencyContact[];
    }> => {
        const child = await db.users.findById(childId);

        if (!child) {
            return { allowed: false, reason: 'Child account not found' };
        }
        if (child.role !== 'CHILD') {
            return { allowed: false, reason: 'Specified account is not a child account' };
        }
        if (!child.parentalConsentDate) {
            return {
                allowed: false,
                reason: 'Parental consent has not been recorded for this account',
                child,
            };
        }
        if (!child.parentId) {
            return { allowed: false, reason: 'Child account is not linked to a parent', child };
        }

        const parent = await db.users.findById(child.parentId);
        if (!parent) {
            return { allowed: false, reason: 'Parent account not found', child };
        }

        const contacts = await db.emergencyContacts.findByParent(parent.id);
        const hasPrimary = contacts.some(c => c.isPrimary);
        const hasSecondary = contacts.some(c => !c.isPrimary);

        if (!hasPrimary || !hasSecondary) {
            return {
                allowed: false,
                missingContacts: true,
                reason: 'Parent must configure a primary and secondary emergency contact before this feature can be used',
                child,
                parent,
                contacts,
            };
        }

        return { allowed: true, child, parent, contacts };
    },

    /**
     * Verifies that a parent is allowed to request a ride for a given child.
     *
     * Delegates safety pre-conditions to canChildAccessSafetyFeatures(), then
     * applies ride-specific checks:
     *  - parent owns the child  (child.parentId === parentId)
     *  - ride restrictions are not enabled for this child
     *
     * If emergency contacts are missing the ride is NOT blocked — a soft
     * `contactsWarning: true` is returned so the caller can show a UI banner
     * and require an explicit acknowledgment before proceeding.
     * (The SOS endpoint still hard-blocks on missing contacts.)
     *
     * @returns { allowed: true|false, reason?, contactsWarning? }
     */
    canChildRequestRide: async (
        childId: string,
        parentId: string
    ): Promise<{ allowed: boolean; reason?: string; contactsWarning?: boolean }> => {
        const safety = await AuthService.canChildAccessSafetyFeatures(childId);

        // Hard-fail on blocking safety issues (consent missing, child not found, etc.)
        if (!safety.allowed && !safety.missingContacts) {
            return { allowed: false, reason: safety.reason };
        }

        // Surface missing contacts as a soft warning only
        const contactsWarning = safety.missingContacts === true;

        // Use the child we already fetched if available, else re-fetch
        const child = safety.child ?? await db.users.findById(childId);
        if (!child) return { allowed: false, reason: 'Child account not found' };

        // Ownership check — parent can only act for their own children
        if (child.parentId !== parentId) {
            return { allowed: false, reason: 'This child does not belong to your account' };
        }

        // Ride restriction check (parent can disable rides entirely for a child)
        if (child.rideRestrictionsEnabled === true) {
            return { allowed: false, reason: 'Ride booking has been disabled for this child account' };
        }

        return { allowed: true, contactsWarning };
    },
};
