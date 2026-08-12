-- ============================================================
-- PSMI System — Migration: Add Model Group + Model-Based Inbound
-- ============================================================
-- Adds a model_group column to products for grouping SKU variants
-- of the same physical device (e.g. E-60 with two SKUs).
-- Also creates the inbound_by_model_group RPC function.
-- ============================================================

-- 1. Add model_group column to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS model_group TEXT;

-- 2. Index for fast model group lookups
CREATE INDEX IF NOT EXISTS idx_products_model_group
  ON products(model_group)
  WHERE model_group IS NOT NULL;

-- 3. RPC: Inbound by model group
-- Selects the first-alphabetical SKU as the default for placeholder units.
CREATE OR REPLACE FUNCTION inbound_by_model_group(
  p_model_group text,
  p_location_id uuid,
  p_user_id uuid,
  p_quantity int,
  p_notes text,
  p_timestamp bigint
) RETURNS json AS $$
DECLARE
  v_default_sku text;
  v_transaction_id uuid;
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

  IF p_quantity > 10000 THEN
    RETURN json_build_object('data', null, 'pending_count', 0, 'error', 'Maximum batch size is 10,000 units');
  END IF;

  -- Find the default SKU (first alphabetically in the model group)
  SELECT sku INTO v_default_sku
  FROM products
  WHERE model_group = p_model_group
    AND is_serialized = true
  ORDER BY sku ASC
  LIMIT 1;

  IF v_default_sku IS NULL THEN
    RETURN json_build_object(
      'data', null,
      'pending_count', 0,
      'error', 'No serialized products found in model group "' || p_model_group || '"'
    );
  END IF;

  -- Validate location
  SELECT type INTO v_location_type FROM locations WHERE id = p_location_id;
  IF v_location_type IS NULL THEN
    RETURN json_build_object('data', null, 'pending_count', 0, 'error', 'Location ID does not exist');
  END IF;

  -- Build notes
  IF p_notes IS NOT NULL AND p_notes != '' THEN
    v_notes := '[MODEL GROUP UPLOAD - ' || p_model_group || ' - ' || p_quantity || ' units] ' || p_notes;
  ELSE
    v_notes := '[MODEL GROUP UPLOAD - ' || p_model_group || ' - ' || p_quantity || ' units] SKU to be confirmed during serial assignment.';
  END IF;

  -- Insert transaction record
  INSERT INTO transactions (type, to_location_id, user_id, notes)
  VALUES ('INBOUND', p_location_id, p_user_id, v_notes)
  RETURNING id INTO v_transaction_id;

  -- Generate placeholder serial numbers
  FOR i IN 1..p_quantity LOOP
    v_padded := lpad(i::text, 4, '0');
    v_serial := 'PENDING-' || upper(v_default_sku) || '-' || p_timestamp || '-' || v_padded;
    v_serial_array := array_append(v_serial_array, v_serial);
  END LOOP;

  -- Batch insert inventory units with PENDING_SERIAL status
  INSERT INTO inventory_units (serial_number, sku, status, location_id)
  SELECT sn, v_default_sku, 'PENDING_SERIAL'::unit_status, p_location_id
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
    'pending_count', p_quantity,
    'default_sku', v_default_sku,
    'model_group', p_model_group,
    'error', null
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('data', null, 'pending_count', 0, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
