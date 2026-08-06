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
  const supabase = await createClient();

  // Upload file to Supabase Storage
  const filePath = `${data.transaction_id}/${data.document_type}-${Date.now()}-${data.file.name}`;

  const { error: uploadError } = await supabase.storage
    .from('verification-docs')
    .upload(filePath, data.file);

  if (uploadError) {
    return {
      data: null,
      error: `Failed to upload file: ${uploadError.message}`,
    };
  }

  // Get the public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from('verification-docs').getPublicUrl(filePath);

  // Save the document reference
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
    return { data: null, error: insertError.message };
  }

  return { data: doc, error: null };
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

  const uploaded = (docs || []).map(
    (d) => d.document_type as DocumentType
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
