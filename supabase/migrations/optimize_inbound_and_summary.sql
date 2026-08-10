-- ============================================================
-- PSMI System — Migration: Optimize Inbound & Aggregations
-- ============================================================

-- 1. Create View for Stock Summary by SKU
CREATE OR REPLACE VIEW inventory_stock_summary AS
SELECT sku, status, count(*)::int as count
FROM inventory_units
GROUP BY sku, status;

-- 2. Create View for Stock Summary by Location
CREATE OR REPLACE VIEW location_stock_summary AS
SELECT location_id, status, count(*)::int as count
FROM inventory_units
GROUP BY location_id, status;

-- 3. Create RPC function for optimized bulk inbound operations
CREATE OR REPLACE FUNCTION inbound_by_quantity(
  p_sku text,
  p_location_id uuid,
  p_user_id uuid,
  p_quantity int,
  p_notes text,
  p_timestamp bigint
) RETURNS json AS $$
DECLARE
  v_transaction_id uuid;
  v_is_serialized boolean;
  v_initial_status unit_status;
  v_location_type text;
  v_notes text;
  v_serial text;
  v_serial_array text[] := '{}';
  v_transaction json;
  v_padded text;
BEGIN
  -- Validate quantity
  IF p_quantity <= 0 THEN
    RETURN json_build_object('data', null, 'pending_count', 0, 'error', 'Quantity must be greater than zero');
  END IF;

  -- Get serialization flag
  SELECT is_serialized INTO v_is_serialized FROM products WHERE sku = p_sku;
  IF v_is_serialized IS NULL THEN
    RETURN json_build_object('data', null, 'pending_count', 0, 'error', 'SKU "' || p_sku || '" does not exist');
  END IF;

  -- Get location type
  SELECT type INTO v_location_type FROM locations WHERE id = p_location_id;
  IF v_location_type IS NULL THEN
    RETURN json_build_object('data', null, 'pending_count', 0, 'error', 'Location ID does not exist');
  END IF;

  -- Determine initial status
  IF v_is_serialized THEN
    v_initial_status := 'PENDING_SERIAL';
  ELSIF v_location_type = 'BRANCH' THEN
    v_initial_status := 'IN_BRANCH';
  ELSE
    v_initial_status := 'IN_WAREHOUSE';
  END IF;

  -- Formulate notes
  IF p_notes IS NOT NULL AND p_notes != '' THEN
    v_notes := '[' || CASE WHEN v_is_serialized THEN 'QUANTITY' ELSE 'NON-SERIALIZED' END || ' UPLOAD - ' || p_quantity || ' units] ' || p_notes;
  ELSIF v_is_serialized THEN
    v_notes := '[QUANTITY UPLOAD - ' || p_quantity || ' units] Serial numbers to be assigned.';
  ELSE
    v_notes := '[NON-SERIALIZED UPLOAD - ' || p_quantity || ' units] Non-serialized accessories inventory.';
  END IF;

  -- Insert transaction record
  INSERT INTO transactions (type, to_location_id, user_id, notes)
  VALUES ('INBOUND', p_location_id, p_user_id, v_notes)
  RETURNING id INTO v_transaction_id;

  -- Loop to generate unique pseudo-serials
  FOR i IN 1..p_quantity LOOP
    v_padded := lpad(i::text, 4, '0');
    IF v_is_serialized THEN
      v_serial := 'PENDING-' || upper(p_sku) || '-' || p_timestamp || '-' || v_padded;
    ELSE
      v_serial := 'NS-' || upper(p_sku) || '-' || p_timestamp || '-' || v_padded;
    END IF;
    v_serial_array := array_append(v_serial_array, v_serial);
  END LOOP;

  -- Batch insert inventory units
  INSERT INTO inventory_units (serial_number, sku, status, location_id)
  SELECT sn, p_sku, v_initial_status, p_location_id
  FROM unnest(v_serial_array) AS sn;

  -- Batch insert transaction items
  INSERT INTO transaction_items (transaction_id, serial_number)
  SELECT v_transaction_id, sn
  FROM unnest(v_serial_array) AS sn;

  -- Fetch the created transaction as JSON
  SELECT row_to_json(t) INTO v_transaction
  FROM transactions t
  WHERE id = v_transaction_id;

  RETURN json_build_object(
    'data', v_transaction,
    'pending_count', CASE WHEN v_is_serialized THEN p_quantity ELSE 0 END,
    'error', null
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('data', null, 'pending_count', 0, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
