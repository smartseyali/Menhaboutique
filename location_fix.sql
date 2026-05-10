-- ============================================================
-- location_fix.sql
-- Paste and run in the Supabase SQL Editor.
-- Fixes all state delivery zones + seeds cities for all 36
-- Indian states & union territories.
-- Safe to run multiple times (idempotent).
-- ============================================================

-- ── 1. Fix delivery zones for all states ─────────────────────
UPDATE states SET zone = 'SOUTH'   WHERE code IN ('AP','KA','KL','TN','TG','PY');
UPDATE states SET zone = 'NORTH'   WHERE code IN ('HR','HP','PB','RJ','UP','UK','DL','CH','JK','LA');
UPDATE states SET zone = 'EAST'    WHERE code IN ('AR','AS','BR','JH','MN','ML','MZ','NL','OR','SK','TR','WB');
UPDATE states SET zone = 'WEST'    WHERE code IN ('GA','GJ','MH','DN');
UPDATE states SET zone = 'CENTRAL' WHERE code IN ('CG','MP');
UPDATE states SET zone = 'REST'    WHERE code IN ('AN','LD');

-- ── 2. Add unique constraint on cities (safe if already exists) ──
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'cities_name_state_key'
    ) THEN
        ALTER TABLE cities ADD CONSTRAINT cities_name_state_key UNIQUE (name, state_id);
    END IF;
END $$;

-- ── 3. Permissions ────────────────────────────────────────────
GRANT SELECT ON countries, states, cities TO anon, authenticated;
GRANT ALL    ON countries, states, cities TO service_role;

-- ── 4. Seed cities for all states ────────────────────────────
-- Joins on state code so IDs don't need to be hardcoded.
-- ON CONFLICT DO NOTHING skips cities that already exist.

INSERT INTO cities (state_id, name)
SELECT s.id, v.city
FROM (VALUES
    -- Andhra Pradesh (AP)
    ('AP','Visakhapatnam'),('AP','Vijayawada'),('AP','Guntur'),('AP','Nellore'),
    ('AP','Kurnool'),('AP','Tirupati'),('AP','Rajahmundry'),('AP','Kakinada'),
    ('AP','Kadapa'),('AP','Anantapur'),('AP','Vizianagaram'),('AP','Eluru'),
    ('AP','Ongole'),('AP','Chittoor'),('AP','Srikakulam'),

    -- Arunachal Pradesh (AR)
    ('AR','Itanagar'),('AR','Naharlagun'),('AR','Pasighat'),('AR','Tawang'),
    ('AR','Ziro'),('AR','Bomdila'),('AR','Roing'),('AR','Tezu'),

    -- Assam (AS)
    ('AS','Guwahati'),('AS','Silchar'),('AS','Dibrugarh'),('AS','Jorhat'),
    ('AS','Nagaon'),('AS','Tinsukia'),('AS','Tezpur'),('AS','Bongaigaon'),
    ('AS','Dhubri'),('AS','Karimganj'),('AS','Goalpara'),('AS','Diphu'),

    -- Bihar (BR)
    ('BR','Patna'),('BR','Gaya'),('BR','Bhagalpur'),('BR','Muzaffarpur'),
    ('BR','Darbhanga'),('BR','Purnia'),('BR','Arrah'),('BR','Begusarai'),
    ('BR','Katihar'),('BR','Munger'),('BR','Chhapra'),('BR','Hajipur'),
    ('BR','Bihar Sharif'),('BR','Sasaram'),('BR','Motihari'),

    -- Chhattisgarh (CG)
    ('CG','Raipur'),('CG','Bhilai'),('CG','Bilaspur'),('CG','Korba'),
    ('CG','Durg'),('CG','Rajnandgaon'),('CG','Jagdalpur'),('CG','Ambikapur'),
    ('CG','Raigarh'),('CG','Mahasamund'),

    -- Goa (GA)
    ('GA','Panaji'),('GA','Margao'),('GA','Vasco da Gama'),('GA','Mapusa'),
    ('GA','Ponda'),('GA','Calangute'),('GA','Bicholim'),('GA','Canacona'),

    -- Gujarat (GJ)
    ('GJ','Ahmedabad'),('GJ','Surat'),('GJ','Vadodara'),('GJ','Rajkot'),
    ('GJ','Bhavnagar'),('GJ','Jamnagar'),('GJ','Junagadh'),('GJ','Gandhinagar'),
    ('GJ','Anand'),('GJ','Morbi'),('GJ','Navsari'),('GJ','Mehsana'),
    ('GJ','Bharuch'),('GJ','Gandhidham'),('GJ','Nadiad'),('GJ','Surendranagar'),
    ('GJ','Patan'),('GJ','Porbandar'),

    -- Haryana (HR)
    ('HR','Faridabad'),('HR','Gurugram'),('HR','Panipat'),('HR','Ambala'),
    ('HR','Rohtak'),('HR','Hisar'),('HR','Karnal'),('HR','Sonipat'),
    ('HR','Yamunanagar'),('HR','Panchkula'),('HR','Bhiwani'),('HR','Sirsa'),
    ('HR','Rewari'),('HR','Jhajjar'),('HR','Fatehabad'),

    -- Himachal Pradesh (HP)
    ('HP','Shimla'),('HP','Dharamshala'),('HP','Solan'),('HP','Mandi'),
    ('HP','Kullu'),('HP','Manali'),('HP','Hamirpur'),('HP','Una'),
    ('HP','Bilaspur'),('HP','Chamba'),('HP','Nahan'),('HP','Palampur'),

    -- Jharkhand (JH)
    ('JH','Ranchi'),('JH','Jamshedpur'),('JH','Dhanbad'),('JH','Bokaro'),
    ('JH','Deoghar'),('JH','Hazaribagh'),('JH','Giridih'),('JH','Ramgarh'),
    ('JH','Dumka'),('JH','Phusro'),('JH','Medininagar'),

    -- Karnataka (KA)
    ('KA','Bengaluru'),('KA','Mysuru'),('KA','Hubballi'),('KA','Mangaluru'),
    ('KA','Belagavi'),('KA','Kalaburagi'),('KA','Davangere'),('KA','Shivamogga'),
    ('KA','Tumakuru'),('KA','Ballari'),('KA','Vijayapura'),('KA','Hassan'),
    ('KA','Udupi'),('KA','Raichur'),('KA','Bidar'),('KA','Dharwad'),
    ('KA','Chitradurga'),('KA','Chikkamagaluru'),('KA','Bagalkot'),('KA','Gadag'),

    -- Kerala (KL)
    ('KL','Thiruvananthapuram'),('KL','Kochi'),('KL','Kozhikode'),('KL','Thrissur'),
    ('KL','Kollam'),('KL','Palakkad'),('KL','Alappuzha'),('KL','Kannur'),
    ('KL','Malappuram'),('KL','Kottayam'),('KL','Kasaragod'),('KL','Pathanamthitta'),
    ('KL','Idukki'),('KL','Wayanad'),('KL','Thalassery'),('KL','Ponnani'),

    -- Madhya Pradesh (MP)
    ('MP','Bhopal'),('MP','Indore'),('MP','Jabalpur'),('MP','Gwalior'),
    ('MP','Ujjain'),('MP','Sagar'),('MP','Dewas'),('MP','Satna'),
    ('MP','Ratlam'),('MP','Rewa'),('MP','Katni'),('MP','Burhanpur'),
    ('MP','Chhindwara'),('MP','Shivpuri'),('MP','Vidisha'),('MP','Damoh'),
    ('MP','Mandsaur'),('MP','Khandwa'),

    -- Maharashtra (MH)
    ('MH','Mumbai'),('MH','Pune'),('MH','Nagpur'),('MH','Nashik'),
    ('MH','Aurangabad'),('MH','Solapur'),('MH','Thane'),('MH','Amravati'),
    ('MH','Kolhapur'),('MH','Navi Mumbai'),('MH','Sangli'),('MH','Malegaon'),
    ('MH','Jalgaon'),('MH','Akola'),('MH','Latur'),('MH','Dhule'),
    ('MH','Ahmednagar'),('MH','Chandrapur'),('MH','Parbhani'),('MH','Osmanabad'),
    ('MH','Nanded'),('MH','Bhiwandi'),('MH','Panvel'),('MH','Vasai-Virar'),

    -- Manipur (MN)
    ('MN','Imphal'),('MN','Thoubal'),('MN','Churachandpur'),('MN','Kakching'),
    ('MN','Senapati'),('MN','Bishnupur'),('MN','Ukhrul'),('MN','Tamenglong'),

    -- Meghalaya (ML)
    ('ML','Shillong'),('ML','Tura'),('ML','Jowai'),('ML','Nongstoin'),
    ('ML','Resubelpara'),('ML','Williamnagar'),('ML','Baghmara'),('ML','Nongpoh'),

    -- Mizoram (MZ)
    ('MZ','Aizawl'),('MZ','Lunglei'),('MZ','Champhai'),('MZ','Serchhip'),
    ('MZ','Kolasib'),('MZ','Saiha'),('MZ','Lawngtlai'),('MZ','Mamit'),

    -- Nagaland (NL)
    ('NL','Kohima'),('NL','Dimapur'),('NL','Mokokchung'),('NL','Tuensang'),
    ('NL','Wokha'),('NL','Zunheboto'),('NL','Mon'),('NL','Phek'),

    -- Odisha (OR)
    ('OR','Bhubaneswar'),('OR','Cuttack'),('OR','Rourkela'),('OR','Brahmapur'),
    ('OR','Sambalpur'),('OR','Puri'),('OR','Balasore'),('OR','Bhadrak'),
    ('OR','Baripada'),('OR','Jharsuguda'),('OR','Jeypore'),('OR','Angul'),
    ('OR','Bargarh'),('OR','Dhenkanal'),('OR','Kendujhar'),('OR','Rayagada'),

    -- Punjab (PB)
    ('PB','Ludhiana'),('PB','Amritsar'),('PB','Jalandhar'),('PB','Patiala'),
    ('PB','Bathinda'),('PB','Mohali'),('PB','Pathankot'),('PB','Hoshiarpur'),
    ('PB','Batala'),('PB','Moga'),('PB','Firozpur'),('PB','Ropar'),
    ('PB','Sangrur'),('PB','Faridkot'),('PB','Muktsar'),

    -- Rajasthan (RJ)
    ('RJ','Jaipur'),('RJ','Jodhpur'),('RJ','Kota'),('RJ','Bikaner'),
    ('RJ','Ajmer'),('RJ','Udaipur'),('RJ','Bhilwara'),('RJ','Alwar'),
    ('RJ','Bharatpur'),('RJ','Sikar'),('RJ','Sri Ganganagar'),('RJ','Pali'),
    ('RJ','Tonk'),('RJ','Chittorgarh'),('RJ','Barmer'),('RJ','Jaisalmer'),
    ('RJ','Dungarpur'),('RJ','Jhunjhunu'),

    -- Sikkim (SK)
    ('SK','Gangtok'),('SK','Namchi'),('SK','Gyalshing'),('SK','Mangan'),
    ('SK','Rangpo'),('SK','Singtam'),('SK','Jorethang'),

    -- Tamil Nadu (TN)
    ('TN','Chennai'),('TN','Coimbatore'),('TN','Madurai'),('TN','Tiruchirappalli'),
    ('TN','Salem'),('TN','Tirunelveli'),('TN','Vellore'),('TN','Erode'),
    ('TN','Thoothukudi'),('TN','Tiruppur'),('TN','Dindigul'),('TN','Thanjavur'),
    ('TN','Ranipet'),('TN','Kancheepuram'),('TN','Hosur'),('TN','Nagercoil'),
    ('TN','Kumbakonam'),('TN','Cuddalore'),('TN','Karur'),('TN','Namakkal'),
    ('TN','Pudukkottai'),('TN','Ramanathapuram'),('TN','Sivaganga'),
    ('TN','Virudhunagar'),('TN','Theni'),('TN','Tiruvarur'),

    -- Telangana (TG)
    ('TG','Hyderabad'),('TG','Warangal'),('TG','Nizamabad'),('TG','Khammam'),
    ('TG','Karimnagar'),('TG','Ramagundam'),('TG','Mahabubnagar'),('TG','Nalgonda'),
    ('TG','Adilabad'),('TG','Suryapet'),('TG','Siddipet'),('TG','Miryalaguda'),
    ('TG','Jagtial'),('TG','Mancherial'),('TG','Kothagudem'),

    -- Tripura (TR)
    ('TR','Agartala'),('TR','Dharmanagar'),('TR','Udaipur'),('TR','Kailashahar'),
    ('TR','Belonia'),('TR','Ambassa'),('TR','Khowai'),('TR','Sabroom'),

    -- Uttar Pradesh (UP)
    ('UP','Lucknow'),('UP','Kanpur'),('UP','Ghaziabad'),('UP','Agra'),
    ('UP','Meerut'),('UP','Varanasi'),('UP','Prayagraj'),('UP','Bareilly'),
    ('UP','Aligarh'),('UP','Moradabad'),('UP','Saharanpur'),('UP','Gorakhpur'),
    ('UP','Noida'),('UP','Firozabad'),('UP','Jhansi'),('UP','Mathura'),
    ('UP','Rampur'),('UP','Shahjahanpur'),('UP','Muzaffarnagar'),('UP','Mau'),
    ('UP','Hapur'),('UP','Etawah'),('UP','Mirzapur'),('UP','Bulandshahr'),
    ('UP','Lakhimpur'),('UP','Bahraich'),('UP','Faizabad'),('UP','Sultanpur'),

    -- Uttarakhand (UK)
    ('UK','Dehradun'),('UK','Haridwar'),('UK','Roorkee'),('UK','Haldwani'),
    ('UK','Rishikesh'),('UK','Kashipur'),('UK','Rudrapur'),('UK','Nainital'),
    ('UK','Mussoorie'),('UK','Pithoragarh'),('UK','Uttarkashi'),('UK','Almora'),

    -- West Bengal (WB)
    ('WB','Kolkata'),('WB','Asansol'),('WB','Siliguri'),('WB','Durgapur'),
    ('WB','Bardhaman'),('WB','Malda'),('WB','Baharampur'),('WB','Kharagpur'),
    ('WB','Medinipur'),('WB','Jalpaiguri'),('WB','Cooch Behar'),('WB','Haldia'),
    ('WB','Raiganj'),('WB','Krishnanagar'),('WB','Bankura'),('WB','Purulia'),

    -- Andaman and Nicobar Islands (AN)
    ('AN','Port Blair'),('AN','Car Nicobar'),('AN','Havelock Island'),('AN','Diglipur'),

    -- Chandigarh (CH)
    ('CH','Chandigarh'),

    -- Dadra and Nagar Haveli and Daman and Diu (DN)
    ('DN','Daman'),('DN','Diu'),('DN','Silvassa'),

    -- Delhi (DL)
    ('DL','New Delhi'),('DL','Dwarka'),('DL','Rohini'),('DL','Karol Bagh'),
    ('DL','Lajpat Nagar'),('DL','Connaught Place'),('DL','Saket'),
    ('DL','Janakpuri'),('DL','Pitampura'),('DL','Shahdara'),
    ('DL','Preet Vihar'),('DL','Vasant Kunj'),

    -- Jammu and Kashmir (JK)
    ('JK','Srinagar'),('JK','Jammu'),('JK','Anantnag'),('JK','Baramulla'),
    ('JK','Sopore'),('JK','Udhampur'),('JK','Kathua'),('JK','Punch'),
    ('JK','Rajouri'),('JK','Kupwara'),

    -- Ladakh (LA)
    ('LA','Leh'),('LA','Kargil'),('LA','Diskit'),('LA','Nubra'),

    -- Lakshadweep (LD)
    ('LD','Kavaratti'),('LD','Agatti'),('LD','Minicoy'),('LD','Andrott'),

    -- Puducherry (PY)
    ('PY','Puducherry'),('PY','Karaikal'),('PY','Mahe'),('PY','Yanam'),
    ('PY','Ozhukarai')

) AS v(state_code, city)
JOIN states s ON s.code = v.state_code
ON CONFLICT (name, state_id) DO NOTHING;
