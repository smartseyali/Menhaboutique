-- cart_sync.sql
-- Run this in your Supabase SQL editor to enable cross-device cart sync

-- ── Carts table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carts (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    status      TEXT DEFAULT 'active' CHECK (status IN ('active', 'abandoned', 'converted')),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS carts_user_id_status_idx ON carts(user_id, status);

-- ── Cart items table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cart_items (
    id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cart_id          UUID REFERENCES carts(id) ON DELETE CASCADE NOT NULL,
    product_id       UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    variant_id       UUID REFERENCES product_attributes(id) ON DELETE SET NULL,
    quantity         INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price       DECIMAL(10,2),
    product_snapshot JSONB,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cart_items_cart_id_idx ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS cart_items_product_id_idx ON cart_items(product_id);

-- ── Add alternate_phone to addresses (if not already present) ──
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS alternate_phone TEXT;

-- ── RLS Policies (permissive to match existing site architecture) ──
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "carts_anon_all"      ON carts;
DROP POLICY IF EXISTS "cart_items_anon_all" ON cart_items;

CREATE POLICY "carts_anon_all"
    ON carts FOR ALL
    USING (true) WITH CHECK (true);

CREATE POLICY "cart_items_anon_all"
    ON cart_items FOR ALL
    USING (true) WITH CHECK (true);

-- ── Permissions ───────────────────────────────────────────────
GRANT ALL ON carts      TO anon, authenticated;
GRANT ALL ON cart_items TO anon, authenticated;

-- ── Cleanup helper: remove duplicate active carts per user ────
-- Keeps the most recently updated cart and removes older ones
DO $$
DECLARE
    dup RECORD;
BEGIN
    FOR dup IN
        SELECT user_id
        FROM carts
        WHERE status = 'active' AND user_id IS NOT NULL
        GROUP BY user_id
        HAVING COUNT(*) > 1
    LOOP
        DELETE FROM carts
        WHERE id NOT IN (
            SELECT id FROM carts
            WHERE user_id = dup.user_id AND status = 'active'
            ORDER BY updated_at DESC
            LIMIT 1
        )
        AND user_id = dup.user_id
        AND status = 'active';
    END LOOP;
END $$;
