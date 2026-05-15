-- ============================================================================
-- 06_UPGRADE.SQL — Maboresho ya Mfumo
-- 1. Ongeza plot_id (Shamba A,B,C,D) kwenye bajeti na matumizi
-- 2. Hakikisha hierarchical budget inafanya kazi
-- 3. Ingiza data halisi ya Mashamba Makubwa 2025-2026
-- ============================================================================

-- ============== STEP 1: ONGEZA COLUMNS MUHIMU ==============
ALTER TABLE budget_periods ADD COLUMN IF NOT EXISTS plot_id BIGINT REFERENCES plots(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS plot_id BIGINT REFERENCES plots(id);
ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS parent_id BIGINT REFERENCES budget_items(id) ON DELETE CASCADE;
ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'leaf' CHECK (item_type IN ('header','leaf'));

CREATE INDEX IF NOT EXISTS idx_budget_items_parent ON budget_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_expenses_plot ON expenses(plot_id);
CREATE INDEX IF NOT EXISTS idx_budget_periods_plot ON budget_periods(plot_id);

-- ============== STEP 2: AUTO-UPDATE BUDGET ACTUAL WHEN EXPENSE APPROVED ==============
CREATE OR REPLACE FUNCTION update_budget_actual_on_expense() RETURNS TRIGGER AS $$
DECLARE
  v_old_amount NUMERIC := 0;
  v_new_amount NUMERIC := 0;
BEGIN
  -- Calculate old contribution
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.status = 'approved' AND OLD.budget_item_id IS NOT NULL THEN
    v_old_amount := COALESCE(OLD.amount, 0);
  END IF;
  
  -- Calculate new contribution
  IF TG_OP IN ('INSERT','UPDATE') AND NEW.status = 'approved' AND NEW.budget_item_id IS NOT NULL THEN
    v_new_amount := COALESCE(NEW.amount, 0);
  END IF;
  
  -- Update old budget item if changed
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.budget_item_id IS NOT NULL THEN
    UPDATE budget_items 
    SET total_actual = GREATEST(0, COALESCE(total_actual, 0) - v_old_amount)
    WHERE id = OLD.budget_item_id;
  END IF;
  
  -- Update new budget item
  IF TG_OP IN ('INSERT','UPDATE') AND NEW.budget_item_id IS NOT NULL AND NEW.status = 'approved' THEN
    UPDATE budget_items 
    SET total_actual = COALESCE(total_actual, 0) + v_new_amount
    WHERE id = NEW.budget_item_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_expense_budget ON expenses;
CREATE TRIGGER trg_expense_budget 
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_budget_actual_on_expense();

-- ============== STEP 3: HAKIKISHA PLOTS ZIPO ==============
INSERT INTO plots (code, name, hectares, location) VALUES
  ('BLOCK-A', 'Shamba A (Block A)', 50, 'Tabora - Urambo'),
  ('BLOCK-B', 'Shamba B (Block B)', 50, 'Tabora - Urambo'),
  ('BLOCK-C', 'Shamba C (Block C)', 50, 'Tabora - Urambo'),
  ('BLOCK-D', 'Shamba D (Block D)', 35, 'Tabora - Urambo')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

-- ============== STEP 4: INGIZA BAJETI HALISI YA MASHAMBA MAKUBWA 2025-2026 ==============
-- Bajeti hii inatoka kwenye picha za mteja
DO $$
DECLARE
  v_period_id BIGINT;
  v_cat_a_id BIGINT;
  v_cat_b_id BIGINT;
  v_cat_d_id BIGINT;
  v_a01_id BIGINT;
  v_a02_id BIGINT;
  v_a03_id BIGINT;
  v_a04_id BIGINT;
  v_a05_id BIGINT;
  v_b01_id BIGINT;
  v_d01_id BIGINT;
BEGIN
  -- Hakikisha hakuna bajeti hii tayari
  SELECT id INTO v_period_id FROM budget_periods WHERE name = 'Mashamba Makubwa 2025-2026';
  IF v_period_id IS NOT NULL THEN
    RAISE NOTICE 'Bajeti tayari ipo. Inafutwa kwanza...';
    DELETE FROM budget_periods WHERE id = v_period_id;
  END IF;
  
  -- Tengeneza bajeti
  INSERT INTO budget_periods (name, fiscal_year, start_date, end_date, status, notes)
  VALUES ('Mashamba Makubwa 2025-2026', '2025-2026', '2025-07-01', '2026-06-30', 'active',
          'Bajeti rasmi ya msimu wa 2025-2026 - Tabora Urambo (185 hectares)')
  RETURNING id INTO v_period_id;
  
  -- ===== SECTION A: LAND PREPARATION =====
  INSERT INTO budget_categories (period_id, code, name, description, display_order)
  VALUES (v_period_id, 'A', 'KIFUNGU A - Land Preparation', 'Maandalizi ya ardhi', 1)
  RETURNING id INTO v_cat_a_id;
  
  -- A01: Land Acquisition (Total: 6,500,000)
  INSERT INTO budget_items (category_id, parent_id, code, item, item_type, display_order)
  VALUES (v_cat_a_id, NULL, 'A01', 'Land acquisition', 'header', 1)
  RETURNING id INTO v_a01_id;
  INSERT INTO budget_items (category_id, parent_id, code, item, unit, unit_price, quantity, months, item_type) VALUES
    (v_cat_a_id, v_a01_id, 'A0101', 'land', 'site', 200000, 16, 1, 'leaf'),
    (v_cat_a_id, v_a01_id, 'A0102', 'diezeli', 'lt', 3600, 200, 1, 'leaf'),
    (v_cat_a_id, v_a01_id, 'A0103', 'petrol', 'Lt', 3600, 300, 1, 'leaf'),
    (v_cat_a_id, v_a01_id, 'A0104', 'LA staff', 'Person', 50000, 30, 1, 'leaf');
  
  -- A02: Site clearing and leveling (Total: 2,140,000)
  INSERT INTO budget_items (category_id, parent_id, code, item, item_type, display_order)
  VALUES (v_cat_a_id, NULL, 'A02', 'Site clearing and leveling', 'header', 2)
  RETURNING id INTO v_a02_id;
  INSERT INTO budget_items (category_id, parent_id, code, item, unit, unit_price, quantity, months, item_type) VALUES
    (v_cat_a_id, v_a02_id, 'A0201', 'LA labourers', 'Person', 100000, 16, 1, 'leaf'),
    (v_cat_a_id, v_a02_id, 'A0202', 'diezeli', 'Lt', 3600, 150, 1, 'leaf');
  
  -- A03: Fencing (Total: 4,320,000)
  INSERT INTO budget_items (category_id, parent_id, code, item, item_type, display_order)
  VALUES (v_cat_a_id, NULL, 'A03', 'Fencing', 'header', 3)
  RETURNING id INTO v_a03_id;
  INSERT INTO budget_items (category_id, parent_id, code, item, unit, unit_price, quantity, months, item_type) VALUES
    (v_cat_a_id, v_a03_id, 'A0301', 'Miti', 'Pieces', 50000, 16, 1, 'leaf'),
    (v_cat_a_id, v_a03_id, 'A0302', 'Nyasi', 'site', 100000, 16, 1, 'leaf'),
    (v_cat_a_id, v_a03_id, 'A0303', 'site', 'Person', 120000, 16, 1, 'leaf');
  
  -- A04: pot filling and alignment (Total: 14,610,000)
  INSERT INTO budget_items (category_id, parent_id, code, item, item_type, display_order)
  VALUES (v_cat_a_id, NULL, 'A04', 'Pot filling and alignment', 'header', 4)
  RETURNING id INTO v_a04_id;
  INSERT INTO budget_items (category_id, parent_id, code, item, unit, unit_price, quantity, months, item_type) VALUES
    (v_cat_a_id, v_a04_id, 'A0401', 'LA labourers', 'number', 15, 462500, 1, 'leaf'),
    (v_cat_a_id, v_a04_id, 'A0402', 'LA staff', 'Person', 50000, 16, 2, 'leaf'),
    (v_cat_a_id, v_a04_id, 'A0403', 'sowing', 'Person', 5, 462500, 1, 'leaf'),
    (v_cat_a_id, v_a04_id, 'A0404', 'mbolea', 'trip', 120000, 32, 1, 'leaf'),
    (v_cat_a_id, v_a04_id, 'A0405', 'petrol', 'lt', 3600, 200, 1, 'leaf');
  
  -- A05: Procurement of working tools (Total: 1,632,000)
  INSERT INTO budget_items (category_id, parent_id, code, item, item_type, display_order)
  VALUES (v_cat_a_id, NULL, 'A05', 'Procurement of working tools', 'header', 5)
  RETURNING id INTO v_a05_id;
  INSERT INTO budget_items (category_id, parent_id, code, item, unit, unit_price, quantity, months, item_type) VALUES
    (v_cat_a_id, v_a05_id, 'A0501', 'Buckets', 'number', 5000, 32, 1, 'leaf'),
    (v_cat_a_id, v_a05_id, 'A0502', 'water can', 'number', 15000, 32, 1, 'leaf'),
    (v_cat_a_id, v_a05_id, 'A0503', 'hoes', 'number', 5000, 32, 1, 'leaf'),
    (v_cat_a_id, v_a05_id, 'A0504', 'slashers', 'number', 10000, 32, 1, 'leaf'),
    (v_cat_a_id, v_a05_id, 'A0505', 'spides', 'number', 10000, 32, 1, 'leaf'),
    (v_cat_a_id, v_a05_id, 'A0506', 'knives', 'number', 6000, 32, 1, 'leaf');
  
  -- ===== SECTION B: NURSERY MANAGEMENT =====
  INSERT INTO budget_categories (period_id, code, name, description, display_order)
  VALUES (v_period_id, 'B', 'KIFUNGU B - Nursery Management', 'Usimamizi wa kitalu', 2)
  RETURNING id INTO v_cat_b_id;
  
  -- B01: Nursery Management
  INSERT INTO budget_items (category_id, parent_id, code, item, item_type, display_order)
  VALUES (v_cat_b_id, NULL, 'B01', 'Nursery Management', 'header', 1)
  RETURNING id INTO v_b01_id;
  INSERT INTO budget_items (category_id, parent_id, code, item, unit, unit_price, quantity, months, item_type) VALUES
    (v_cat_b_id, v_b01_id, 'B0101', 'labourers wages', 'Month', 120000, 8, 5, 'leaf'),
    (v_cat_b_id, v_b01_id, 'B0102', 'supervisor salary', 'Month', 240000, 2, 5, 'leaf'),
    (v_cat_b_id, v_b01_id, 'B0103', 'meneja salaries', 'Month', 250000, 2, 5, 'leaf'),
    (v_cat_b_id, v_b01_id, 'B0104', 'L/Allowances manager', 'Month', 200000, 2, 5, 'leaf'),
    (v_cat_b_id, v_b01_id, 'B0105', 'diezeli', 'Lt', 3600, 400, 5, 'leaf'),
    (v_cat_b_id, v_b01_id, 'B0106', 'petrol', 'Lt', 3600, 300, 5, 'leaf'),
    (v_cat_b_id, v_b01_id, 'B0107', 'Food', 'Person', 90000, 32, 5, 'leaf'),
    (v_cat_b_id, v_b01_id, 'B0108', 'service and repair vehicle', 'Month', 600000, 1, 5, 'leaf'),
    (v_cat_b_id, v_b01_id, 'B0109', 'service and repair motorcycle', 'Month', 400000, 6, 5, 'leaf');
  
  -- ===== SECTION D: FIELD OPERATIONS =====
  INSERT INTO budget_categories (period_id, code, name, description, display_order)
  VALUES (v_period_id, 'D', 'KIFUNGU D - Field Operations', 'Shughuli za shamba', 4)
  RETURNING id INTO v_cat_d_id;
  
  -- D01: Field Operations (Total: 211,542,800)
  INSERT INTO budget_items (category_id, parent_id, code, item, item_type, display_order)
  VALUES (v_cat_d_id, NULL, 'D01', 'FIELD Operations', 'header', 1)
  RETURNING id INTO v_d01_id;
  INSERT INTO budget_items (category_id, parent_id, code, item, unit, unit_price, quantity, months, item_type) VALUES
    (v_cat_d_id, v_d01_id, 'D0101', 'Ground Clearing - Tractor hire', 'hactor', 160000, 185, 1, 'leaf'),
    (v_cat_d_id, v_d01_id, 'D0102', 'Machinery mobilization - car hire', 'hector', 1011660, 80, 1, 'leaf'),
    (v_cat_d_id, v_d01_id, 'D0103', 'Ripping/Ploughing', 'hector', 200000, 185, 1, 'leaf'),
    (v_cat_d_id, v_d01_id, 'D0104', 'Marking Holes', 'hactor', 40000, 185, 1, 'leaf'),
    (v_cat_d_id, v_d01_id, 'D0105', 'pitting', 'hactor', 80000, 185, 1, 'leaf'),
    (v_cat_d_id, v_d01_id, 'D0106', 'Planting', 'hactor', 80000, 185, 1, 'leaf'),
    (v_cat_d_id, v_d01_id, 'D0107', 'first fertilizer Application', 'hactor', 18000, 185, 1, 'leaf'),
    (v_cat_d_id, v_d01_id, 'D0108', 'second fertilizer application', 'hactor', 18000, 185, 1, 'leaf'),
    (v_cat_d_id, v_d01_id, 'D0109', 'Pesticide Application', 'hactor', 50000, 185, 1, 'leaf'),
    (v_cat_d_id, v_d01_id, 'D0110', 'Gap Filling', 'hactor', 60000, 185, 1, 'leaf'),
    (v_cat_d_id, v_d01_id, 'D0111', '1st Weeding', 'hactor', 150000, 185, 1, 'leaf'),
    (v_cat_d_id, v_d01_id, 'D0112', '2nd weeding', 'hactor', 100000, 185, 1, 'leaf'),
    (v_cat_d_id, v_d01_id, 'D0113', 'Fire break cleaning', 'hactor', 60000, 185, 1, 'leaf'),
    (v_cat_d_id, v_d01_id, 'D0114', 'Guards', 'hactor', 90790, 185, 1, 'leaf'),
    (v_cat_d_id, v_d01_id, 'D0115', 'Seedling Transportation', 'hactor', 85000, 185, 1, 'leaf'),
    (v_cat_d_id, v_d01_id, 'D0116', 'Management and Administrative', 'hactor', 38910, 185, 1, 'leaf');
  
  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE '✅ BAJETI IMEINGIZWA KIKAMILIFU!';
  RAISE NOTICE 'Bajeti: Mashamba Makubwa 2025-2026';
  RAISE NOTICE 'Sections: A, B, D';
  RAISE NOTICE 'Total: ~TZS 279,444,800';
  RAISE NOTICE '════════════════════════════════════════';
END $$;

-- Onyesha summary
SELECT 
  bc.code AS section,
  bc.name AS section_name,
  COUNT(DISTINCT CASE WHEN bi.item_type = 'header' THEN bi.id END) AS activities,
  COUNT(DISTINCT CASE WHEN bi.item_type = 'leaf' THEN bi.id END) AS line_items,
  SUM(CASE WHEN bi.item_type = 'leaf' THEN bi.total_planned ELSE 0 END)::NUMERIC AS total_budget
FROM budget_categories bc
LEFT JOIN budget_items bi ON bi.category_id = bc.id
JOIN budget_periods bp ON bp.id = bc.period_id
WHERE bp.name = 'Mashamba Makubwa 2025-2026'
GROUP BY bc.code, bc.name, bc.display_order
ORDER BY bc.display_order;
