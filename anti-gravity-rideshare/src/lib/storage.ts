import { supabase } from './supabase';
import { VerificationDocumentType } from './types';

const BUCKET = 'driver-documents';

/**
 * Uploads a driver verification document to Supabase Storage.
 * Path pattern: driver-documents/{userId}/{documentType}.{ext}
 *
 * Uses upsert:true so re-uploads overwrite the previous file at the same path.
 * uploadedAt is set by the DB layer at insert time, not here.
 *
 * @returns The public URL of the uploaded file.
 */
export async function uploadDriverDocument(
    userId: string,
    docType: VerificationDocumentType,
    file: File
): Promise<string> {
    const ext = file.name.split('.').pop() ?? 'bin';
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

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
}
