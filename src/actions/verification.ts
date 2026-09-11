'use server';

// ============================================================
// PSMI System — Verification Server Actions
// ============================================================
// Handles upload of verification documents (waybill, payment
// receipt, payment screenshot) and the verification gate.
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { VerificationDocument } from '@/lib/types/database';

export type DocumentType = 'WAYBILL' | 'PAYMENT_RECEIPT' | 'PAYMENT_SCREENSHOT';

const REQUIRED_DOCS: DocumentType[] = [
  'WAYBILL',
  'PAYMENT_RECEIPT',
  'PAYMENT_SCREENSHOT',
];

export async function uploadVerificationDoc(data: {
  transaction_id: string;
  document_type: DocumentType;
  file: File;
}): Promise<{ data: VerificationDocument | null; error: string | null }> {
  const result = await uploadMultipleVerificationDocs({
    transaction_id: data.transaction_id,
    document_type: data.document_type,
    files: [data.file],
  });

  if (result.errors.length > 0 && result.data.length === 0) {
    return { data: null, error: result.errors[0] };
  }

  return { data: result.data[0] || null, error: null };
}

export async function uploadMultipleVerificationDocs(data: {
  transaction_id: string;
  document_type: DocumentType;
  files: File[];
}): Promise<{ data: VerificationDocument[]; errors: string[] }> {
  const supabase = await createClient();
  const uploadedDocs: VerificationDocument[] = [];
  const errors: string[] = [];

  for (const file of data.files) {
    // Sanitize filename and create unique storage path
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${data.transaction_id}/${data.document_type}-${Date.now()}-${sanitizedName}`;

    const { error: uploadError } = await supabase.storage
      .from('verification-docs')
      .upload(filePath, file);

    if (uploadError) {
      errors.push(`Failed to upload ${file.name}: ${uploadError.message}`);
      continue;
    }

    // Get the public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('verification-docs').getPublicUrl(filePath);

    // Save the document reference in DB
    const { data: doc, error: insertError } = await supabase
      .from('verification_documents')
      .insert({
        transaction_id: data.transaction_id,
        document_type: data.document_type,
        storage_url: publicUrl,
      })
      .select()
      .single();

    if (insertError) {
      errors.push(`Failed to save record for ${file.name}: ${insertError.message}`);
    } else if (doc) {
      uploadedDocs.push(doc);
    }
  }

  return { data: uploadedDocs, errors };
}

export async function deleteVerificationDoc(
  docId: string,
  storageUrl: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  // Try extracting the relative path in the storage bucket
  try {
    const url = new URL(storageUrl);
    const bucketPrefix = '/storage/v1/object/public/verification-docs/';
    const pathIndex = url.pathname.indexOf(bucketPrefix);
    if (pathIndex !== -1) {
      const storagePath = decodeURIComponent(url.pathname.substring(pathIndex + bucketPrefix.length));
      await supabase.storage.from('verification-docs').remove([storagePath]);
    }
  } catch (e) {
    console.error('Failed to parse storage URL for deletion:', e);
  }

  const { error: deleteError } = await supabase
    .from('verification_documents')
    .delete()
    .eq('id', docId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  return { error: null };
}

export async function checkVerificationComplete(
  transactionId: string
): Promise<{
  complete: boolean;
  uploaded: DocumentType[];
  missing: DocumentType[];
}> {
  const supabase = await createClient();

  const { data: docs } = await supabase
    .from('verification_documents')
    .select('document_type')
    .eq('transaction_id', transactionId);

  const uploaded = Array.from(
    new Set((docs || []).map((d) => d.document_type as DocumentType))
  );
  const missing = REQUIRED_DOCS.filter((t) => !uploaded.includes(t));

  return {
    complete: missing.length === 0,
    uploaded,
    missing,
  };
}

export async function getVerificationDocs(
  transactionId: string
): Promise<{ data: VerificationDocument[]; error: string | null }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('verification_documents')
    .select('*')
    .eq('transaction_id', transactionId)
    .order('uploaded_at', { ascending: true });

  if (error) {
    return { data: [], error: error.message };
  }

  return { data: data || [], error: null };
}

export async function markTransactionVerified(data: {
  transaction_id: string;
  user_id: string;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();

  // Check verification completeness
  const { complete, missing } = await checkVerificationComplete(
    data.transaction_id
  );

  if (!complete) {
    return {
      error: `Missing verification documents: ${missing.join(', ')}`,
    };
  }

  // Mark transaction as verified
  const { error: txnError } = await supabase
    .from('transactions')
    .update({ verified: true })
    .eq('id', data.transaction_id);

  if (txnError) {
    return { error: txnError.message };
  }

  // Get all serial numbers from this transaction
  const { data: items } = await supabase
    .from('transaction_items')
    .select('serial_number')
    .eq('transaction_id', data.transaction_id);

  if (items && items.length > 0) {
    const serialNumbers = items.map((i) => i.serial_number);

    // Update all units to SOLD
    const { error: updateError } = await supabase
      .from('inventory_units')
      .update({ status: 'SOLD' })
      .in('serial_number', serialNumbers);

    if (updateError) {
      console.error('Failed to mark units as SOLD:', updateError.message);
    }
  }

  return { error: null };
}
