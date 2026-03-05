import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

/**
 * GET  /api/parent/emergency-contacts
 * POST /api/parent/emergency-contacts
 *
 * Manages emergency contacts for a PARENT account.
 * A parent must have at least one primary AND one secondary contact before
 * the parent-child feature (ride booking & SOS) can be fully activated.
 */

// ── GET — return the caller's contacts ────────────────────────────────────────
export async function GET(req: NextRequest) {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const { user: parent } = authResult;

    if (parent.role !== 'PARENT') {
        return NextResponse.json(
            { error: 'Forbidden — parent access only' },
            { status: 403 }
        );
    }

    try {
        const contacts = await db.emergencyContacts.findByParent(parent.id);
        const hasPrimary = contacts.some(c => c.isPrimary);
        const hasSecondary = contacts.some(c => !c.isPrimary);

        return NextResponse.json({
            contacts,
            setupComplete: hasPrimary && hasSecondary,
            hasPrimary,
            hasSecondary,
        });
    } catch (error) {
        console.error('[emergency-contacts] GET error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// ── POST — create / replace a contact ────────────────────────────────────────
export async function POST(req: NextRequest) {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const { user: parent } = authResult;

    if (parent.role !== 'PARENT') {
        return NextResponse.json(
            { error: 'Forbidden — parent access only' },
            { status: 403 }
        );
    }

    let body: {
        name?: string;
        phone?: string;
        email?: string;
        relationship?: string;
        isPrimary?: boolean;
    };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { name, phone, email, relationship, isPrimary } = body;

    // Input validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (!phone || typeof phone !== 'string') {
        return NextResponse.json({ error: 'phone is required' }, { status: 400 });
    }
    if (!relationship || typeof relationship !== 'string' || relationship.trim().length === 0) {
        return NextResponse.json({ error: 'relationship is required (e.g. Spouse, Grandparent)' }, { status: 400 });
    }
    if (typeof isPrimary !== 'boolean') {
        return NextResponse.json({ error: 'isPrimary must be a boolean' }, { status: 400 });
    }

    try {
        // E.164 validation lives in db.emergencyContacts.upsert — will throw on bad format
        const contact = await db.emergencyContacts.upsert(parent.id, {
            name: name.trim(),
            phone,
            email: email ?? undefined,
            relationship: relationship.trim(),
            isPrimary,
        });

        // Return updated setup status alongside the new contact
        const contacts = await db.emergencyContacts.findByParent(parent.id);
        const setupComplete = contacts.some(c => c.isPrimary) && contacts.some(c => !c.isPrimary);

        return NextResponse.json({ success: true, contact, setupComplete }, { status: 201 });

    } catch (error: any) {
        if (error?.message?.includes('E.164')) {
            return NextResponse.json({ error: error.message }, { status: 422 });
        }
        console.error('[emergency-contacts] POST error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
