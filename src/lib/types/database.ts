// ============================================================
// PSMI System — Database TypeScript Types
// ============================================================
// These types mirror the Supabase database schema.
// In production, generate these with `supabase gen types typescript`.
// ============================================================

export type UnitStatus =
  | 'IN_WAREHOUSE'
  | 'RESERVED'
  | 'IN_TRANSIT'
  | 'IN_BRANCH'
  | 'SOLD'
  | 'DAMAGED_REPAIR'
  | 'PENDING_SERIAL';

export type TransactionType = 'INBOUND' | 'OUTBOUND';

export type OutboundRoute = 'TB' | 'B2B' | 'B2C';

export type ProductCategory = 'POWER_STATION' | 'SHS' | 'ACCESSORIES';

export type UserRole = 'ADMIN' | 'WAREHOUSE_MANAGER' | 'BRANCH_STAFF';

export type LocationType = 'WAREHOUSE' | 'BRANCH';

// ============================================================
// Row Types
// ============================================================

export interface Location {
  id: string;
  name: string;
  type: LocationType;
  address: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  location_id: string | null;
  created_at: string;
}

export interface Product {
  sku: string;
  model_name: string;
  description: string | null;
  low_stock_threshold: number;
  is_serialized: boolean;
  category_badge: ProductCategory;
  image_url?: string | null;
  barcode?: string | null;
  created_at: string;
}

export interface InventoryUnit {
  serial_number: string;
  sku: string;
  status: UnitStatus;
  location_id: string;
  upload_date: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  route: OutboundRoute | null;
  from_location_id: string | null;
  to_location_id: string | null;
  tracking_number: string | null;
  user_id: string;
  notes: string | null;
  verified: boolean;
  created_at: string;
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  serial_number: string;
  created_at: string;
}

export interface VerificationDocument {
  id: string;
  transaction_id: string;
  document_type: 'WAYBILL' | 'PAYMENT_RECEIPT' | 'PAYMENT_SCREENSHOT';
  storage_url: string;
  uploaded_at: string;
}

export interface AuditLogEntry {
  id: number;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  user_id: string | null;
  created_at: string;
}

// ============================================================
// Extended / Joined Types (used in UI)
// ============================================================

export interface InventoryUnitWithProduct extends InventoryUnit {
  products: Product;
}

export interface InventoryUnitWithLocation extends InventoryUnit {
  locations: Location;
}

export interface TransactionWithDetails extends Transaction {
  profiles: Profile;
  from_location: Location | null;
  to_location: Location | null;
  transaction_items: (TransactionItem & {
    inventory_units: InventoryUnit;
  })[];
  verification_documents: VerificationDocument[];
}

export interface StockSummary {
  sku: string;
  model_name: string;
  category_badge: ProductCategory;
  total: number;
  in_warehouse: number;
  reserved: number;
  in_transit: number;
  in_branch: number;
  sold: number;
  damaged_repair: number;
  pending_serial: number;
}

export interface LocationStock {
  location_id: string;
  location_name: string;
  location_type: LocationType;
  total_units: number;
  status_breakdown: Record<UnitStatus, number>;
}

export interface LowStockAlert {
  sku: string;
  model_name: string;
  current_count: number;
  threshold: number;
}

export interface FifoUnit extends InventoryUnit {
  age_days: number;
  age_bucket: 'green' | 'amber' | 'red';
}

// ============================================================
// Supabase Database Type Map (for Supabase client generics)
// ============================================================

export interface Database {
  public: {
    Tables: {
      locations: {
        Row: Location;
        Insert: Omit<Location, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Location, 'id'>>;
      };
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at'> & {
          created_at?: string;
        };
        Update: Partial<Omit<Profile, 'id'>>;
      };
      products: {
        Row: Product;
        Insert: Omit<Product, 'created_at'> & {
          created_at?: string;
          low_stock_threshold?: number;
        };
        Update: Partial<Product>;
      };
      inventory_units: {
        Row: InventoryUnit;
        Insert: Omit<InventoryUnit, 'upload_date' | 'updated_at' | 'status'> & {
          upload_date?: string;
          updated_at?: string;
          status?: UnitStatus;
        };
        Update: Partial<Omit<InventoryUnit, 'serial_number'>>;
      };
      transactions: {
        Row: Transaction;
        Insert: {
          type: TransactionType;
          route: OutboundRoute | null;
          from_location_id: string | null;
          to_location_id: string | null;
          user_id: string;
          notes: string | null;
          id?: string;
          created_at?: string;
          tracking_number?: string;
          verified?: boolean;
        };
        Update: Partial<Omit<Transaction, 'id'>>;
      };
      transaction_items: {
        Row: TransactionItem;
        Insert: Omit<TransactionItem, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<TransactionItem, 'id'>>;
      };
      verification_documents: {
        Row: VerificationDocument;
        Insert: Omit<VerificationDocument, 'id' | 'uploaded_at'> & {
          id?: string;
          uploaded_at?: string;
        };
        Update: Partial<Omit<VerificationDocument, 'id'>>;
      };
      audit_log: {
        Row: AuditLogEntry;
        Insert: Omit<AuditLogEntry, 'id' | 'created_at'> & {
          created_at?: string;
        };
        Update: never;
      };
    };
    Enums: {
      unit_status: UnitStatus;
      transaction_type: TransactionType;
      outbound_route: OutboundRoute;
      user_role: UserRole;
      location_type: LocationType;
      product_category: ProductCategory;
    };
  };
}
