import { supabase } from './supabase';
import { VerificationDocumentType } from './types';

const BUCKET = 'driver-documents';

/**
 * Signed URL TTL — 1 hour. Callers that need longer-lived access should
 * regenerate the URL close to the time of display.
 */
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

/**
 * Uploads a driver verification document to private Supabase Storage.
 * Path pattern: driver-documents/{userId}/{documentType}.{ext}
 *
 * Uses upsert:true so re-uploads overwrite the previous file at the same path.
 *
 * IMPORTANT: The `driver-documents` bucket must be set to PRIVATE in the
 * Supabase dashboard (Storage → Policies → Bucket access = private).
 * This function returns a short-lived signed URL (1 hour TTL), not a public URL.
 *
 * @returns A signed URL for the uploaded file (valid for 1 hour).
 */
export async function uploadDriverDocument(
    userId: string,
    docType: VerificationDocumentType,
    file: File
): Promise<string> {
    // Derive extension from MIME type — not from filename (prevents spoofing)
    const mimeToExt: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'application/pdf': 'pdf',
    };
    const ext = mimeToExt[file.type] ?? 'bin';
    const path = `${userId}/${docType}.${ext}`;

    const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
            upsert: true,
            contentType: file.type,
        });

    if (uploadError) {
        throw new Error(`Storage upload failed for ${docType}: ${uploadError.message}`);
    }

    return generateSignedUrl(path);
}

/**
 * Generates a fresh signed URL for a stored document path.
 * Call this when rendering the document to an admin reviewer or the driver.
 *
 * @param storagePath - The storage path (e.g. `userId/DRIVERS_LICENSE.pdf`)
 * @returns A signed URL valid for 1 hour.
 */
export async function generateSignedUrl(storagePath: string): Promise<string> {
    const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

    if (error || !data?.signedUrl) {
        throw new Error(`Failed to generate signed URL for ${storagePath}: ${error?.message ?? 'unknown error'}`);
    }

    return data.signedUrl;
}
