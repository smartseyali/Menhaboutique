-- ============================================================
-- migration_full.sql
-- Paste this entire script into the Supabase SQL Editor and run.
-- All statements are idempotent — safe to run multiple times.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- SECTION 1 · CART TABLES  (cross-device cart sync)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS carts (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID        REFERENCES users(id) ON DELETE CASCADE,
    status      TEXT        DEFAULT 'active' CHECK (status IN ('active', 'abandoned', 'converted')),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS carts_user_id_status_idx ON carts(user_id, status);

CREATE TABLE IF NOT EXISTS cart_items (
    id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    cart_id          UUID        REFERENCES carts(id) ON DELETE CASCADE NOT NULL,
    product_id       UUID        REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    variant_id       UUID        REFERENCES product_attributes(id) ON DELETE SET NULL,
    quantity         INTEGER     NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price       DECIMAL(10,2),
    product_snapshot JSONB,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cart_items_cart_id_idx    ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS cart_items_product_id_idx ON cart_items(product_id);

-- Add alternate phone to addresses
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS alternate_phone TEXT;

-- RLS
ALTER TABLE carts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "carts_anon_all"      ON carts;
DROP POLICY IF EXISTS "cart_items_anon_all" ON cart_items;

CREATE POLICY "carts_anon_all"
    ON carts FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "cart_items_anon_all"
    ON cart_items FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON carts      TO anon, authenticated, service_role;
GRANT ALL ON cart_items TO anon, authenticated, service_role;

-- Remove duplicate active carts (keeps most recently updated)
DO $$
DECLARE dup RECORD;
BEGIN
    FOR dup IN
        SELECT user_id FROM carts
        WHERE status = 'active' AND user_id IS NOT NULL
        GROUP BY user_id HAVING COUNT(*) > 1
    LOOP
        DELETE FROM carts
        WHERE id NOT IN (
            SELECT id FROM carts
            WHERE user_id = dup.user_id AND status = 'active'
            ORDER BY updated_at DESC LIMIT 1
        )
        AND user_id = dup.user_id AND status = 'active';
    END LOOP;
END $$;


-- ────────────────────────────────────────────────────────────
-- SECTION 2 · LOCATION TABLES  (countries / states / cities)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS countries (
    id   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    CONSTRAINT countries_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS states (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    country_id UUID REFERENCES countries(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    code       TEXT NOT NULL,
    zone       TEXT NOT NULL DEFAULT 'REST',
    CONSTRAINT states_code_country_key UNIQUE (code, country_id)
);

CREATE INDEX IF NOT EXISTS states_country_id_idx ON states(country_id);

CREATE TABLE IF NOT EXISTS cities (
    id       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    state_id UUID REFERENCES states(id) ON DELETE CASCADE,
    name     TEXT NOT NULL,
    CONSTRAINT cities_name_state_key UNIQUE (name, state_id)
);

CREATE INDEX IF NOT EXISTS cities_state_id_idx ON cities(state_id);

-- RLS (read-only for anon/authenticated; full access for service_role)
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE states    ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "countries_anon_read" ON countries;
DROP POLICY IF EXISTS "states_anon_read"    ON states;
DROP POLICY IF EXISTS "cities_anon_read"    ON cities;

CREATE POLICY "countries_anon_read" ON countries FOR SELECT USING (true);
CREATE POLICY "states_anon_read"    ON states    FOR SELECT USING (true);
CREATE POLICY "cities_anon_read"    ON cities    FOR SELECT USING (true);

GRANT SELECT ON countries TO anon, authenticated;
GRANT SELECT ON states    TO anon, authenticated;
GRANT SELECT ON cities    TO anon, authenticated;
GRANT ALL    ON countries TO service_role;
GRANT ALL    ON states    TO service_role;
GRANT ALL    ON cities    TO service_role;


-- ────────────────────────────────────────────────────────────
-- SECTION 3 · SEED: INDIA
-- ────────────────────────────────────────────────────────────

INSERT INTO countries (name, code)
VALUES ('India', 'IN')
ON CONFLICT (code) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- SECTION 4 · SEED: STATES & UNION TERRITORIES
-- zone values used by calculateDeliveryCharge():
--   SOUTH | NORTH | EAST | WEST | CENTRAL | REST
-- ────────────────────────────────────────────────────────────

INSERT INTO states (country_id, name, code, zone)
SELECT c.id, v.name, v.code, v.zone
FROM countries c,
(VALUES
    -- 28 States
    ('Andhra Pradesh',                              'AP', 'SOUTH'),
    ('Arunachal Pradesh',                           'AR', 'EAST'),
    ('Assam',                                       'AS', 'EAST'),
    ('Bihar',                                       'BR', 'EAST'),
    ('Chhattisgarh',                                'CG', 'CENTRAL'),
    ('Goa',                                         'GA', 'WEST'),
    ('Gujarat',                                     'GJ', 'WEST'),
    ('Haryana',                                     'HR', 'NORTH'),
    ('Himachal Pradesh',                            'HP', 'NORTH'),
    ('Jharkhand',                                   'JH', 'EAST'),
    ('Karnataka',                                   'KA', 'SOUTH'),
    ('Kerala',                                      'KL', 'SOUTH'),
    ('Madhya Pradesh',                              'MP', 'CENTRAL'),
    ('Maharashtra',                                 'MH', 'WEST'),
    ('Manipur',                                     'MN', 'EAST'),
    ('Meghalaya',                                   'ML', 'EAST'),
    ('Mizoram',                                     'MZ', 'EAST'),
    ('Nagaland',                                    'NL', 'EAST'),
    ('Odisha',                                      'OD', 'EAST'),
    ('Punjab',                                      'PB', 'NORTH'),
    ('Rajasthan',                                   'RJ', 'NORTH'),
    ('Sikkim',                                      'SK', 'EAST'),
    ('Tamil Nadu',                                  'TN', 'SOUTH'),
    ('Telangana',                                   'TS', 'SOUTH'),
    ('Tripura',                                     'TR', 'EAST'),
    ('Uttar Pradesh',                               'UP', 'NORTH'),
    ('Uttarakhand',                                 'UK', 'NORTH'),
    ('West Bengal',                                 'WB', 'EAST'),
    -- 8 Union Territories
    ('Andaman and Nicobar Islands',                 'AN', 'REST'),
    ('Chandigarh',                                  'CH', 'NORTH'),
    ('Dadra and Nagar Haveli and Daman and Diu',    'DN', 'WEST'),
    ('Delhi',                                       'DL', 'NORTH'),
    ('Jammu and Kashmir',                           'JK', 'NORTH'),
    ('Ladakh',                                      'LA', 'NORTH'),
    ('Lakshadweep',                                 'LD', 'REST'),
    ('Puducherry',                                  'PY', 'SOUTH')
) AS v(name, code, zone)
WHERE c.code = 'IN'
ON CONFLICT (code, country_id) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- SECTION 5 · SEED: CITIES
-- ────────────────────────────────────────────────────────────

INSERT INTO cities (state_id, name)
SELECT s.id, v.city
FROM (VALUES
    -- Andhra Pradesh
    ('AP', 'Visakhapatnam'),
    ('AP', 'Vijayawada'),
    ('AP', 'Guntur'),
    ('AP', 'Nellore'),
    ('AP', 'Kurnool'),
    ('AP', 'Tirupati'),
    ('AP', 'Rajahmundry'),
    ('AP', 'Kakinada'),
    ('AP', 'Kadapa'),
    ('AP', 'Anantapur'),
    ('AP', 'Vizianagaram'),
    ('AP', 'Eluru'),
    -- Arunachal Pradesh
    ('AR', 'Itanagar'),
    ('AR', 'Naharlagun'),
    ('AR', 'Pasighat'),
    ('AR', 'Tawang'),
    ('AR', 'Ziro'),
    ('AR', 'Bomdila'),
    -- Assam
    ('AS', 'Guwahati'),
    ('AS', 'Silchar'),
    ('AS', 'Dibrugarh'),
    ('AS', 'Jorhat'),
    ('AS', 'Nagaon'),
    ('AS', 'Tinsukia'),
    ('AS', 'Tezpur'),
    ('AS', 'Bongaigaon'),
    ('AS', 'Dhubri'),
    ('AS', 'Karimganj'),
    -- Bihar
    ('BR', 'Patna'),
    ('BR', 'Gaya'),
    ('BR', 'Bhagalpur'),
    ('BR', 'Muzaffarpur'),
    ('BR', 'Darbhanga'),
    ('BR', 'Purnia'),
    ('BR', 'Arrah'),
    ('BR', 'Begusarai'),
    ('BR', 'Katihar'),
    ('BR', 'Munger'),
    ('BR', 'Chhapra'),
    ('BR', 'Hajipur'),
    -- Chhattisgarh
    ('CG', 'Raipur'),
    ('CG', 'Bhilai'),
    ('CG', 'Bilaspur'),
    ('CG', 'Korba'),
    ('CG', 'Durg'),
    ('CG', 'Rajnandgaon'),
    ('CG', 'Jagdalpur'),
    ('CG', 'Ambikapur'),
    ('CG', 'Raigarh'),
    -- Goa
    ('GA', 'Panaji'),
    ('GA', 'Margao'),
    ('GA', 'Vasco da Gama'),
    ('GA', 'Mapusa'),
    ('GA', 'Ponda'),
    ('GA', 'Calangute'),
    -- Gujarat
    ('GJ', 'Ahmedabad'),
    ('GJ', 'Surat'),
    ('GJ', 'Vadodara'),
    ('GJ', 'Rajkot'),
    ('GJ', 'Bhavnagar'),
    ('GJ', 'Jamnagar'),
    ('GJ', 'Junagadh'),
    ('GJ', 'Gandhinagar'),
    ('GJ', 'Anand'),
    ('GJ', 'Morbi'),
    ('GJ', 'Navsari'),
    ('GJ', 'Mehsana'),
    ('GJ', 'Bharuch'),
    ('GJ', 'Gandhidham'),
    -- Haryana
    ('HR', 'Faridabad'),
    ('HR', 'Gurugram'),
    ('HR', 'Panipat'),
    ('HR', 'Ambala'),
    ('HR', 'Rohtak'),
    ('HR', 'Hisar'),
    ('HR', 'Karnal'),
    ('HR', 'Sonipat'),
    ('HR', 'Yamunanagar'),
    ('HR', 'Panchkula'),
    ('HR', 'Bhiwani'),
    ('HR', 'Sirsa'),
    -- Himachal Pradesh
    ('HP', 'Shimla'),
    ('HP', 'Dharamshala'),
    ('HP', 'Solan'),
    ('HP', 'Mandi'),
    ('HP', 'Kullu'),
    ('HP', 'Manali'),
    ('HP', 'Hamirpur'),
    ('HP', 'Una'),
    ('HP', 'Bilaspur'),
    -- Jharkhand
    ('JH', 'Ranchi'),
    ('JH', 'Jamshedpur'),
    ('JH', 'Dhanbad'),
    ('JH', 'Bokaro'),
    ('JH', 'Deoghar'),
    ('JH', 'Hazaribagh'),
    ('JH', 'Giridih'),
    ('JH', 'Ramgarh'),
    ('JH', 'Dumka'),
    -- Karnataka
    ('KA', 'Bengaluru'),
    ('KA', 'Mysuru'),
    ('KA', 'Hubballi'),
    ('KA', 'Mangaluru'),
    ('KA', 'Belagavi'),
    ('KA', 'Kalaburagi'),
    ('KA', 'Davangere'),
    ('KA', 'Shivamogga'),
    ('KA', 'Tumakuru'),
    ('KA', 'Ballari'),
    ('KA', 'Vijayapura'),
    ('KA', 'Hassan'),
    ('KA', 'Udupi'),
    -- Kerala
    ('KL', 'Thiruvananthapuram'),
    ('KL', 'Kochi'),
    ('KL', 'Kozhikode'),
    ('KL', 'Thrissur'),
    ('KL', 'Kollam'),
    ('KL', 'Palakkad'),
    ('KL', 'Alappuzha'),
    ('KL', 'Kannur'),
    ('KL', 'Malappuram'),
    ('KL', 'Kottayam'),
    ('KL', 'Kasaragod'),
    ('KL', 'Pathanamthitta'),
    ('KL', 'Idukki'),
    -- Madhya Pradesh
    ('MP', 'Bhopal'),
    ('MP', 'Indore'),
    ('MP', 'Jabalpur'),
    ('MP', 'Gwalior'),
    ('MP', 'Ujjain'),
    ('MP', 'Sagar'),
    ('MP', 'Dewas'),
    ('MP', 'Satna'),
    ('MP', 'Ratlam'),
    ('MP', 'Rewa'),
    ('MP', 'Katni'),
    ('MP', 'Burhanpur'),
    ('MP', 'Chhindwara'),
    -- Maharashtra
    ('MH', 'Mumbai'),
    ('MH', 'Pune'),
    ('MH', 'Nagpur'),
    ('MH', 'Nashik'),
    ('MH', 'Aurangabad'),
    ('MH', 'Solapur'),
    ('MH', 'Thane'),
    ('MH', 'Amravati'),
    ('MH', 'Kolhapur'),
    ('MH', 'Navi Mumbai'),
    ('MH', 'Sangli'),
    ('MH', 'Malegaon'),
    ('MH', 'Jalgaon'),
    ('MH', 'Akola'),
    ('MH', 'Latur'),
    -- Manipur
    ('MN', 'Imphal'),
    ('MN', 'Thoubal'),
    ('MN', 'Churachandpur'),
    ('MN', 'Kakching'),
    ('MN', 'Senapati'),
    ('MN', 'Bishnupur'),
    -- Meghalaya
    ('ML', 'Shillong'),
    ('ML', 'Tura'),
    ('ML', 'Jowai'),
    ('ML', 'Nongstoin'),
    ('ML', 'Resubelpara'),
    ('ML', 'Williamnagar'),
    -- Mizoram
    ('MZ', 'Aizawl'),
    ('MZ', 'Lunglei'),
    ('MZ', 'Champhai'),
    ('MZ', 'Serchhip'),
    ('MZ', 'Kolasib'),
    ('MZ', 'Saiha'),
    -- Nagaland
    ('NL', 'Kohima'),
    ('NL', 'Dimapur'),
    ('NL', 'Mokokchung'),
    ('NL', 'Tuensang'),
    ('NL', 'Wokha'),
    ('NL', 'Zunheboto'),
    -- Odisha
    ('OD', 'Bhubaneswar'),
    ('OD', 'Cuttack'),
    ('OD', 'Rourkela'),
    ('OD', 'Brahmapur'),
    ('OD', 'Sambalpur'),
    ('OD', 'Puri'),
    ('OD', 'Balasore'),
    ('OD', 'Bhadrak'),
    ('OD', 'Baripada'),
    ('OD', 'Jharsuguda'),
    ('OD', 'Jeypore'),
    ('OD', 'Angul'),
    -- Punjab
    ('PB', 'Ludhiana'),
    ('PB', 'Amritsar'),
    ('PB', 'Jalandhar'),
    ('PB', 'Patiala'),
    ('PB', 'Bathinda'),
    ('PB', 'Mohali'),
    ('PB', 'Pathankot'),
    ('PB', 'Hoshiarpur'),
    ('PB', 'Batala'),
    ('PB', 'Moga'),
    ('PB', 'Firozpur'),
    ('PB', 'Ropar'),
    -- Rajasthan
    ('RJ', 'Jaipur'),
    ('RJ', 'Jodhpur'),
    ('RJ', 'Kota'),
    ('RJ', 'Bikaner'),
    ('RJ', 'Ajmer'),
    ('RJ', 'Udaipur'),
    ('RJ', 'Bhilwara'),
    ('RJ', 'Alwar'),
    ('RJ', 'Bharatpur'),
    ('RJ', 'Sikar'),
    ('RJ', 'Sri Ganganagar'),
    ('RJ', 'Pali'),
    -- Sikkim
    ('SK', 'Gangtok'),
    ('SK', 'Namchi'),
    ('SK', 'Gyalshing'),
    ('SK', 'Mangan'),
    ('SK', 'Rangpo'),
    -- Tamil Nadu
    ('TN', 'Chennai'),
    ('TN', 'Coimbatore'),
    ('TN', 'Madurai'),
    ('TN', 'Tiruchirappalli'),
    ('TN', 'Salem'),
    ('TN', 'Tirunelveli'),
    ('TN', 'Vellore'),
    ('TN', 'Erode'),
    ('TN', 'Thoothukudi'),
    ('TN', 'Tiruppur'),
    ('TN', 'Dindigul'),
    ('TN', 'Thanjavur'),
    ('TN', 'Ranipet'),
    ('TN', 'Kancheepuram'),
    ('TN', 'Hosur'),
    ('TN', 'Nagercoil'),
    ('TN', 'Kumbakonam'),
    -- Telangana
    ('TS', 'Hyderabad'),
    ('TS', 'Warangal'),
    ('TS', 'Nizamabad'),
    ('TS', 'Khammam'),
    ('TS', 'Karimnagar'),
    ('TS', 'Ramagundam'),
    ('TS', 'Mahabubnagar'),
    ('TS', 'Nalgonda'),
    ('TS', 'Adilabad'),
    ('TS', 'Suryapet'),
    -- Tripura
    ('TR', 'Agartala'),
    ('TR', 'Dharmanagar'),
    ('TR', 'Udaipur'),
    ('TR', 'Kailashahar'),
    ('TR', 'Belonia'),
    ('TR', 'Ambassa'),
    -- Uttar Pradesh
    ('UP', 'Lucknow'),
    ('UP', 'Kanpur'),
    ('UP', 'Ghaziabad'),
    ('UP', 'Agra'),
    ('UP', 'Meerut'),
    ('UP', 'Varanasi'),
    ('UP', 'Prayagraj'),
    ('UP', 'Bareilly'),
    ('UP', 'Aligarh'),
    ('UP', 'Moradabad'),
    ('UP', 'Saharanpur'),
    ('UP', 'Gorakhpur'),
    ('UP', 'Noida'),
    ('UP', 'Firozabad'),
    ('UP', 'Jhansi'),
    ('UP', 'Mathura'),
    -- Uttarakhand
    ('UK', 'Dehradun'),
    ('UK', 'Haridwar'),
    ('UK', 'Roorkee'),
    ('UK', 'Haldwani'),
    ('UK', 'Rishikesh'),
    ('UK', 'Kashipur'),
    ('UK', 'Rudrapur'),
    ('UK', 'Nainital'),
    ('UK', 'Mussoorie'),
    -- West Bengal
    ('WB', 'Kolkata'),
    ('WB', 'Asansol'),
    ('WB', 'Siliguri'),
    ('WB', 'Durgapur'),
    ('WB', 'Bardhaman'),
    ('WB', 'Malda'),
    ('WB', 'Baharampur'),
    ('WB', 'Kharagpur'),
    ('WB', 'Medinipur'),
    ('WB', 'Jalpaiguri'),
    ('WB', 'Cooch Behar'),
    ('WB', 'Haldia'),
    -- Andaman and Nicobar Islands
    ('AN', 'Port Blair'),
    ('AN', 'Car Nicobar'),
    ('AN', 'Havelock Island'),
    ('AN', 'Diglipur'),
    -- Chandigarh
    ('CH', 'Chandigarh'),
    -- Dadra and Nagar Haveli and Daman and Diu
    ('DN', 'Daman'),
    ('DN', 'Diu'),
    ('DN', 'Silvassa'),
    -- Delhi
    ('DL', 'New Delhi'),
    ('DL', 'Dwarka'),
    ('DL', 'Rohini'),
    ('DL', 'Karol Bagh'),
    ('DL', 'Lajpat Nagar'),
    ('DL', 'Connaught Place'),
    ('DL', 'Saket'),
    ('DL', 'Janakpuri'),
    ('DL', 'Pitampura'),
    ('DL', 'Shahdara'),
    -- Jammu and Kashmir
    ('JK', 'Srinagar'),
    ('JK', 'Jammu'),
    ('JK', 'Anantnag'),
    ('JK', 'Baramulla'),
    ('JK', 'Sopore'),
    ('JK', 'Udhampur'),
    ('JK', 'Kathua'),
    -- Ladakh
    ('LA', 'Leh'),
    ('LA', 'Kargil'),
    ('LA', 'Diskit'),
    ('LA', 'Nubra'),
    -- Lakshadweep
    ('LD', 'Kavaratti'),
    ('LD', 'Agatti'),
    ('LD', 'Minicoy'),
    ('LD', 'Andrott'),
    -- Puducherry
    ('PY', 'Puducherry'),
    ('PY', 'Karaikal'),
    ('PY', 'Mahe'),
    ('PY', 'Yanam'),
    ('PY', 'Ozhukarai')
) AS v(state_code, city)
JOIN states s ON s.code = v.state_code
ON CONFLICT (name, state_id) DO NOTHING;
