-- ============================================================
-- Menha Boutique — One-time cleanup for duplicate variants
-- Run in Supabase Dashboard → SQL Editor → New query → Run
-- Safe to run multiple times (idempotent: leaves only one row per group)
-- ============================================================

-- ─── 1. Preview: which order_items will be repointed ─────────
-- (Optional — shows what step 2 is about to change.)
SELECT
    oi.id          AS order_item_id,
    oi.attribute_id AS old_attribute_id,
    d.keep_id      AS new_attribute_id
FROM public.order_items oi
JOIN (
    SELECT
        a.id AS dup_id,
        (
            SELECT MIN(b.id)
            FROM public.product_attributes b
            WHERE b.product_id      = a.product_id
              AND b.attribute_type  = a.attribute_type
              AND b.attribute_value = a.attribute_value
        ) AS keep_id
    FROM public.product_attributes a
    WHERE EXISTS (
        SELECT 1
        FROM public.product_attributes b
        WHERE b.product_id      = a.product_id
          AND b.attribute_type  = a.attribute_type
          AND b.attribute_value = a.attribute_value
          AND b.id < a.id
    )
) d ON oi.attribute_id = d.dup_id;

-- ─── 2. Repoint order_items from duplicates to the surviving variant ──
WITH dupes AS (
    SELECT
        a.id AS dup_id,
        (
            SELECT MIN(b.id)
            FROM public.product_attributes b
            WHERE b.product_id      = a.product_id
              AND b.attribute_type  = a.attribute_type
              AND b.attribute_value = a.attribute_value
        ) AS keep_id
    FROM public.product_attributes a
    WHERE EXISTS (
        SELECT 1
        FROM public.product_attributes b
        WHERE b.product_id      = a.product_id
          AND b.attribute_type  = a.attribute_type
          AND b.attribute_value = a.attribute_value
          AND b.id < a.id
    )
)
UPDATE public.order_items oi
SET attribute_id = d.keep_id
FROM dupes d
WHERE oi.attribute_id = d.dup_id;

-- ─── 3. Delete duplicate variants (keep lowest id per group) ─
DELETE FROM public.product_attributes a
USING public.product_attributes b
WHERE a.product_id      = b.product_id
  AND a.attribute_type  = b.attribute_type
  AND a.attribute_value = b.attribute_value
  AND a.id > b.id;

-- ─── 4. Delete duplicate product_images (keep lowest id per group) ─
DELETE FROM public.product_images a
USING public.product_images b
WHERE a.product_id = b.product_id
  AND a.image_url  = b.image_url
  AND a.id > b.id;

-- ─── 5. Verify — should return 0 rows if cleanup succeeded ───
SELECT product_id, attribute_value, COUNT(*) AS dup_count
FROM public.product_attributes
GROUP BY product_id, attribute_value
HAVING COUNT(*) > 1;
