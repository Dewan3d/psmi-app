// ============================================================
// PSMI System — Delivery Note Utility
// ============================================================
// Assembles the data object for a printable/downloadable
// delivery note PDF.
// ============================================================

import { TransactionWithDetails, OutboundRoute } from '@/lib/types/database';
import { formatTrackingNumber } from './tracking-number';

export interface DeliveryNoteData {
  tracking_number: string;
  formatted_tracking_number: string;
  date: string;
  route: OutboundRoute;
  route_label: string;
  from_location: string;
  to_location: string;
  line_items: DeliveryNoteLineItem[];
  total_quantity: number;
  prepared_by: string;
  notes: string | null;
}

export interface DeliveryNoteLineItem {
  serial_number: string;
  sku: string;
  model_name: string;
}

const ROUTE_LABELS: Record<OutboundRoute, string> = {
  TB: 'Transfer to Branch',
  B2B: 'Business to Business',
  B2C: 'Business to Customer',
};

/**
 * Assemble a delivery note data object from a transaction with its details.
 */
export function assembleDeliveryNote(
  transaction: TransactionWithDetails
): DeliveryNoteData {
  if (!transaction.tracking_number) {
    throw new Error('Transaction does not have a tracking number');
  }

  if (!transaction.route) {
    throw new Error('Transaction does not have a route (not an outbound)');
  }

  const lineItems: DeliveryNoteLineItem[] = transaction.transaction_items.map(
    (item) => ({
      serial_number: item.serial_number,
      sku: item.inventory_units?.sku || 'N/A',
      model_name: 'N/A', // Will be populated by the caller with product data
    })
  );

  return {
    tracking_number: transaction.tracking_number,
    formatted_tracking_number: formatTrackingNumber(
      transaction.tracking_number
    ),
    date: new Date(transaction.created_at).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    route: transaction.route,
    route_label: ROUTE_LABELS[transaction.route],
    from_location: transaction.from_location?.name || 'N/A',
    to_location: transaction.to_location?.name || 'N/A',
    line_items: lineItems,
    total_quantity: lineItems.length,
    prepared_by: transaction.profiles?.full_name || 'Unknown',
    notes: transaction.notes,
  };
}
