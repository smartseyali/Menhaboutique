-- ============================================================
-- Menha Boutique — Seed test orders + order_items
-- Run in Supabase Dashboard → SQL Editor (use service_role if RLS blocks it)
-- Inserts 8 orders spanning the last 7 days with varied
-- statuses, payment methods, and a couple with tracking info.
-- ============================================================

DO $$
DECLARE
    v_user_id     uuid;
    v_address_id  uuid;
    v_product_id  uuid;
    v_unit_price  numeric;
    v_attr_id     uuid;
    v_attr_price  numeric;
    v_order_id    uuid;
    v_qty         int;
    v_total       numeric;
    v_status      text;
    v_pay_status  text;
    v_pay_method  text;
    v_track_id    text;
    v_track_url   text;
    v_created_at  timestamptz;
    v_run_tag     text := to_char(now(), 'YYYYMMDDHH24MISS');
    i             int;
BEGIN
    -- ── Auto-discover ids from existing data ──────────────────
    SELECT id INTO v_user_id  FROM public.users     ORDER BY created_at LIMIT 1;
    SELECT id INTO v_address_id FROM public.addresses WHERE user_id = v_user_id LIMIT 1;
    SELECT id, new_price INTO v_product_id, v_unit_price
        FROM public.products WHERE stock_quantity > 0 ORDER BY created_at LIMIT 1;

    IF v_product_id IS NULL THEN
        RAISE EXCEPTION 'No products with stock found — seed at least one product first.';
    END IF;

    -- Optional variant
    SELECT id, price INTO v_attr_id, v_attr_price
        FROM public.product_attributes WHERE product_id = v_product_id LIMIT 1;

    IF v_attr_price IS NOT NULL THEN
        v_unit_price := v_attr_price;
    END IF;

    -- ── Insert 8 orders ───────────────────────────────────────
    FOR i IN 1..8 LOOP
        v_qty        := (i % 3) + 1;                                            -- 1..3
        v_total      := (v_unit_price * v_qty) + 50;                            -- + delivery
        v_status     := (ARRAY['pending','processing','shipped','delivered','cancelled','shipped','delivered','pending'])[i];
        v_pay_status := CASE WHEN v_status IN ('delivered','shipped','processing') THEN 'paid' ELSE 'unpaid' END;
        v_pay_method := (ARRAY['cod','Razorpay','cod','Razorpay','cod','Razorpay','cod','cod'])[i];
        v_track_id   := CASE WHEN v_status IN ('shipped','delivered') THEN 'AWB' || v_run_tag || lpad(i::text, 2, '0') ELSE NULL END;
        v_track_url  := CASE WHEN v_track_id IS NOT NULL THEN 'https://www.stcourier.com/track/shipment?awb=' || v_track_id ELSE NULL END;
        v_created_at := now() - ((i - 1) || ' days')::interval - ((i * 37) || ' minutes')::interval;

        INSERT INTO public.orders (
            user_id, order_number, email, total_price, status,
            payment_status, payment_method, delivery_charge,
            address_id, comments, courier_name,
            tracking_id, tracking_url,
            created_at, updated_at
        ) VALUES (
            v_user_id,
            'SEED-' || v_run_tag || '-' || lpad(i::text, 2, '0'),
            'seed' || i || '@example.com',
            v_total,
            v_status,
            v_pay_status,
            v_pay_method,
            50,
            v_address_id,
            'Seeded test order #' || i,
            'Standard',
            v_track_id,
            v_track_url,
            v_created_at,
            v_created_at
        )
        RETURNING id INTO v_order_id;

        INSERT INTO public.order_items (
            order_id, product_id, quantity, unit_price, total_price, attribute_id
        ) VALUES (
            v_order_id,
            v_product_id,
            v_qty,
            v_unit_price,
            v_unit_price * v_qty,
            v_attr_id
        );
    END LOOP;

    RAISE NOTICE 'Seed complete — 8 orders inserted with tag %', v_run_tag;
END $$;

-- ── Verify ────────────────────────────────────────────────────
SELECT order_number, status, payment_status, payment_method,
       tracking_id, total_price, created_at
FROM public.orders
WHERE order_number LIKE 'SEED-%'
ORDER BY created_at DESC;
