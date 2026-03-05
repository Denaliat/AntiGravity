import { db } from './db';
import type { Ride } from './types';

/**
 * ride-events.ts — event-based ride notification emitter.
 *
 * Routes call emitRideEvent() after mutating ride status. All notification
 * logic lives here, keeping route handlers free of notification concerns.
 *
 * Current implementation: in-app RideNotification rows written to DB.
 * Future extension point: add SMS/push by adding a `channel` field or
 * integrating Twilio / FCM here without touching any route handler.
 */

type RideEvent = 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

const EVENT_MESSAGES: Record<RideEvent, (childName?: string) => string> = {
    ACCEPTED: (name) => `A driver has accepted ${name ? `${name}'s` : 'your child\'s'} ride.`,
    IN_PROGRESS: (name) => `${name ? `${name}'s` : 'Your child\'s'} ride is now in progress.`,
    COMPLETED: (name) => `${name ? `${name}'s` : 'Your child\'s'} ride has been completed.`,
    CANCELLED: (name) => `${name ? `${name}'s` : 'Your child\'s'} ride was cancelled.`,
};

/**
 * Emits a ride notification to the parent when a ride transitions state.
 * Only fires when `ride.requestedByParentId` is set (i.e. parent-booked ride).
 *
 * Safe to call unconditionally after every ride status update — it is a no-op
 * for rides that were not parent-initiated.
 */
export async function emitRideEvent(event: RideEvent, ride: Ride): Promise<void> {
    // Only notify for parent-initiated child rides
    if (!ride.requestedByParentId) return;

    try {
        // Optionally enrich with the child's name for a friendlier message
        const child = await db.users.findById(ride.riderId);
        const messageFn = EVENT_MESSAGES[event];
        const message = messageFn(child?.name);

        await db.rideNotifications.create({
            parentId: ride.requestedByParentId,
            rideId: ride.rideId,
            message,
        });
    } catch (err) {
        // Notification failure must never break the ride update itself
        console.error('[ride-events] Failed to emit ride event:', err);
    }
}
