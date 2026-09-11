-- ============================================================
-- Migration: Optimize Performance, Prevent Disk IO Exhaustion,
-- and Enable Fast Atomic Bulk Serial Assignment
-- ============================================================

-- 1. Cover Unindexed Foreign Keys (prevents sequential disk scans)
CREATE INDEX IF NOT EXISTS idx_transactions_to_location_id ON transactions(to_location_id);
CREATE INDEX IF NOT EXISTS idx_transactions_from_location_id ON transactions(from_location_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_location_id ON profiles(location_id);
CREATE INDEX IF NOT EXISTS idx_profiles_branch_id ON profiles(branch_id);
CREATE INDEX IF NOT EXISTS idx_scans_branch_id ON scans(branch_id);
CREATE INDEX IF NOT EXISTS idx_scans_scanned_by ON scans(scanned_by);
CREATE INDEX IF NOT EXISTS idx_verification_documents_txn_id ON verification_documents(transaction_id);

-- 2. Prevent Disk IO Write Amplification on Inventory Units
-- Dropping row-level audit trigger from inventory_units avoids writing 10,000+ duplicate
-- JSON records to audit_log whenever a bulk batch is imported or assigned.
DROP TRIGGER IF EXISTS trg_audit_inventory_units ON inventory_units;

-- 3. Consolidate & Clean Up Duplicate Permissive RLS Policies
DROP POLICY IF EXISTS "Allow authenticated read on inventory_units" ON inventory_units;
DROP POLICY IF EXISTS "Allow authenticated read on locations" ON locations;
DROP POLICY IF EXISTS "Allow authenticated read on products" ON products;
DROP POLICY IF EXISTS "Allow authenticated read on transaction_items" ON transaction_items;
DROP POLICY IF EXISTS "Allow authenticated read on transactions" ON transactions;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Allow profile insert on signup" ON profiles;
DROP POLICY IF EXISTS "Allow profile update own" ON profiles;

-- 4. Add Missing RLS Policies
-- Allow managers to delete units (required for placeholder cleanup and un-dispatched inventory deletion)
DROP POLICY IF EXISTS "inventory_delete_managers" ON inventory_units;
CREATE POLICY "inventory_delete_managers"
  ON inventory_units FOR DELETE
  TO authenticated
  USING (get_user_role() IN ('ADMIN', 'WAREHOUSE_MANAGER'));

-- Allow managers and authenticated users to update and delete transaction items
DROP POLICY IF EXISTS "transaction_items_update_managers" ON transaction_items;
CREATE POLICY "transaction_items_update_managers"
  ON transaction_items FOR UPDATE
  TO authenticated
  USING (get_user_role() IN ('ADMIN', 'WAREHOUSE_MANAGER'));

DROP POLICY IF EXISTS "transaction_items_delete_managers" ON transaction_items;
CREATE POLICY "transaction_items_delete_managers"
  ON transaction_items FOR DELETE
  TO authenticated
  USING (get_user_role() IN ('ADMIN', 'WAREHOUSE_MANAGER'));

-- 5. Optimize Profiles Auth RLS Policies (use (select auth.uid()) to avoid re-evaluating per row)
DROP POLICY IF EXISTS "profiles_insert_self" ON profiles;
CREATE POLICY "profiles_insert_self"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()));

-- 6. Atomic Bulk Serial Assignment RPC
CREATE OR REPLACE FUNCTION assign_bulk_serials(
  p_transaction_id uuid,
  p_real_serials text[],
  p_sku_override text DEFAULT NULL
) RETURNS json AS $$
DECLARE
  v_serial text;
  v_clean_serial text;
  v_assigned_count int := 0;
  v_pending_count int := 0;
  v_placeholder text;
  v_placeholder_sku text;
  v_placeholder_loc uuid;
  v_final_sku text;
  v_override_model_group text;
  v_original_model_group text;
  v_errors jsonb := '[]'::jsonb;
  v_existing_ti_id uuid;
  v_existing_unit_status unit_status;
  v_placeholders text[];
  v_total_pending int;
  i int;
BEGIN
  -- 1. Get all pending placeholders for this transaction in order
  SELECT array_agg(serial_number ORDER BY serial_number ASC)
  INTO v_placeholders
  FROM transaction_items
  WHERE transaction_id = p_transaction_id
    AND serial_number LIKE 'PENDING-%';

  v_total_pending := COALESCE(array_length(v_placeholders, 1), 0);

  IF v_total_pending = 0 THEN
    RETURN json_build_object(
      'assigned', 0,
      'pending_remaining', 0,
      'errors', jsonb_build_array(jsonb_build_object('serial', 'BATCH', 'error', 'No pending slots remain for this receipt.'))
    );
  END IF;

  IF array_length(p_real_serials, 1) > v_total_pending THEN
    RETURN json_build_object(
      'assigned', 0,
      'pending_remaining', v_total_pending,
      'errors', jsonb_build_array(jsonb_build_object('serial', 'BATCH', 'error', 'You provided ' || array_length(p_real_serials, 1) || ' serial(s), but only ' || v_total_pending || ' pending slot(s) remain.'))
    );
  END IF;

  -- 2. Process each serial number
  FOR i IN 1..array_length(p_real_serials, 1) LOOP
    v_clean_serial := trim(p_real_serials[i]);
    v_placeholder := v_placeholders[v_assigned_count + 1];

    IF v_clean_serial IS NULL OR v_clean_serial = '' THEN
      v_errors := v_errors || jsonb_build_object('serial', COALESCE(p_real_serials[i], ''), 'error', 'Serial number cannot be empty.');
      CONTINUE;
    END IF;

    -- Check if serial is already in a transaction_item
    SELECT id INTO v_existing_ti_id
    FROM transaction_items
    WHERE serial_number = v_clean_serial
    LIMIT 1;

    IF v_existing_ti_id IS NOT NULL THEN
      v_errors := v_errors || jsonb_build_object('serial', v_clean_serial, 'error', 'Serial number is already assigned in transaction records.');
      CONTINUE;
    END IF;

    -- Get placeholder details
    SELECT sku, location_id INTO v_placeholder_sku, v_placeholder_loc
    FROM inventory_units
    WHERE serial_number = v_placeholder;

    IF v_placeholder_sku IS NULL THEN
      v_errors := v_errors || jsonb_build_object('serial', v_clean_serial, 'error', 'Pending slot placeholder not found in inventory.');
      CONTINUE;
    END IF;

    -- Determine SKU
    v_final_sku := v_placeholder_sku;
    IF p_sku_override IS NOT NULL AND p_sku_override <> '' AND p_sku_override <> v_placeholder_sku THEN
      SELECT model_group INTO v_override_model_group FROM products WHERE sku = p_sku_override;
      SELECT model_group INTO v_original_model_group FROM products WHERE sku = v_placeholder_sku;
      IF v_override_model_group IS NOT NULL AND v_original_model_group IS NOT NULL AND v_override_model_group = v_original_model_group THEN
        v_final_sku := p_sku_override;
      END IF;
    END IF;

    -- Check if unit exists in inventory_units (e.g. previously orphaned)
    SELECT status INTO v_existing_unit_status
    FROM inventory_units
    WHERE serial_number = v_clean_serial;

    IF v_existing_unit_status IS NOT NULL THEN
      -- Adopt orphaned unit
      UPDATE inventory_units
      SET sku = v_final_sku, location_id = v_placeholder_loc, status = 'IN_WAREHOUSE'
      WHERE serial_number = v_clean_serial;
    ELSE
      -- Insert the real unit
      INSERT INTO inventory_units (serial_number, sku, location_id, status)
      VALUES (v_clean_serial, v_final_sku, v_placeholder_loc, 'IN_WAREHOUSE');
    END IF;

    -- Update transaction_item from placeholder to real serial
    UPDATE transaction_items
    SET serial_number = v_clean_serial
    WHERE transaction_id = p_transaction_id
      AND serial_number = v_placeholder;

    -- Delete the placeholder unit
    DELETE FROM inventory_units
    WHERE serial_number = v_placeholder;

    v_assigned_count := v_assigned_count + 1;
  END LOOP;

  -- Calculate remaining pending
  SELECT count(*) INTO v_pending_count
  FROM transaction_items
  WHERE transaction_id = p_transaction_id
    AND serial_number LIKE 'PENDING-%';

  RETURN json_build_object(
    'assigned', v_assigned_count,
    'pending_remaining', v_pending_count,
    'errors', v_errors
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'assigned', v_assigned_count,
    'pending_remaining', v_total_pending - v_assigned_count,
    'errors', jsonb_build_array(jsonb_build_object('serial', 'BATCH', 'error', SQLERRM))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Atomic Single Serial Assignment RPC
CREATE OR REPLACE FUNCTION assign_single_serial(
  p_transaction_id uuid,
  p_placeholder_serial text,
  p_real_serial text,
  p_sku_override text DEFAULT NULL
) RETURNS json AS $$
DECLARE
  v_clean_serial text := trim(p_real_serial);
  v_placeholder_sku text;
  v_placeholder_loc uuid;
  v_final_sku text;
  v_override_model_group text;
  v_original_model_group text;
  v_existing_ti_id uuid;
  v_existing_unit_status unit_status;
  v_pending_count int;
BEGIN
  IF v_clean_serial IS NULL OR v_clean_serial = '' THEN
    RETURN json_build_object('error', 'Serial number cannot be empty.');
  END IF;

  -- Check if already assigned to a transaction
  SELECT id INTO v_existing_ti_id
  FROM transaction_items
  WHERE serial_number = v_clean_serial
  LIMIT 1;

  IF v_existing_ti_id IS NOT NULL THEN
    RETURN json_build_object('error', 'Serial number "' || v_clean_serial || '" is already assigned in transaction records.');
  END IF;

  -- Fetch placeholder
  SELECT sku, location_id INTO v_placeholder_sku, v_placeholder_loc
  FROM inventory_units
  WHERE serial_number = p_placeholder_serial;

  IF v_placeholder_sku IS NULL THEN
    RETURN json_build_object('error', 'Pending slot placeholder unit not found.');
  END IF;

  v_final_sku := v_placeholder_sku;
  IF p_sku_override IS NOT NULL AND p_sku_override <> '' AND p_sku_override <> v_placeholder_sku THEN
    SELECT model_group INTO v_override_model_group FROM products WHERE sku = p_sku_override;
    SELECT model_group INTO v_original_model_group FROM products WHERE sku = v_placeholder_sku;
    IF v_override_model_group IS NOT NULL AND v_original_model_group IS NOT NULL AND v_override_model_group = v_original_model_group THEN
      v_final_sku := p_sku_override;
    END IF;
  END IF;

  -- Check if unit exists in inventory_units (orphaned check)
  SELECT status INTO v_existing_unit_status
  FROM inventory_units
  WHERE serial_number = v_clean_serial;

  IF v_existing_unit_status IS NOT NULL THEN
    UPDATE inventory_units
    SET sku = v_final_sku, location_id = v_placeholder_loc, status = 'IN_WAREHOUSE'
    WHERE serial_number = v_clean_serial;
  ELSE
    INSERT INTO inventory_units (serial_number, sku, location_id, status)
    VALUES (v_clean_serial, v_final_sku, v_placeholder_loc, 'IN_WAREHOUSE');
  END IF;

  -- Update transaction_item
  UPDATE transaction_items
  SET serial_number = v_clean_serial
  WHERE transaction_id = p_transaction_id
    AND serial_number = p_placeholder_serial;

  -- Delete placeholder
  DELETE FROM inventory_units
  WHERE serial_number = p_placeholder_serial;

  SELECT count(*) INTO v_pending_count
  FROM transaction_items
  WHERE transaction_id = p_transaction_id
    AND serial_number LIKE 'PENDING-%';

  RETURN json_build_object('error', null, 'pending_remaining', v_pending_count);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
