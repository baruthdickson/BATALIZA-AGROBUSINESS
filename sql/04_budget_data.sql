-- ============================================================================
-- BUDGET DATA IMPORT
-- ENDESHA hii BAADA ya kutengeneza user wa kwanza (Project Manager)
-- Pia ondoa "REPLACE_WITH_PM_UUID" na UUID halisi ya PM
-- ============================================================================

-- HATUA YA 1: Pata UUID ya Project Manager wako
-- SELECT id, email, full_name FROM users WHERE role_id = (SELECT id FROM roles WHERE slug='project_manager');

-- HATUA YA 2: Weka UUID hapa, kisha endesha SQL hii yote:
DO $$
DECLARE
  pm_uuid UUID;
  period_id BIGINT;
  cat_a01 BIGINT; cat_a02 BIGINT; cat_a03 BIGINT; cat_a04 BIGINT; cat_a05 BIGINT;
  cat_b01 BIGINT; cat_d01 BIGINT;
BEGIN
  -- Pata Project Manager wa kwanza
  SELECT id INTO pm_uuid FROM users
  WHERE role_id = (SELECT id FROM roles WHERE slug='project_manager')
  LIMIT 1;
  
  IF pm_uuid IS NULL THEN
    RAISE EXCEPTION 'Hakuna Project Manager! Tengeneza user mwenye PM role kwanza.';
  END IF;
  
  -- ============================================
  -- BUDGET PERIOD
  -- ============================================
  INSERT INTO budget_periods (
    name, fiscal_year, start_date, end_date, status, currency, created_by
  ) VALUES (
    'Mashamba Makubwa 2025-2026', '2025-2026',
    '2025-07-01', '2026-06-30', 'draft', 'TZS', pm_uuid
  ) RETURNING id INTO period_id;
  
  -- ============================================
  -- BUDGET CATEGORIES
  -- ============================================
  INSERT INTO budget_categories (budget_period_id, code_prefix, name, main_section, section_letter, sort_order)
  VALUES (period_id, 'A01', 'Land Acquisition', 'preparation', 'A', 1) RETURNING id INTO cat_a01;
  
  INSERT INTO budget_categories (budget_period_id, code_prefix, name, main_section, section_letter, sort_order)
  VALUES (period_id, 'A02', 'Site Clearing and Leveling', 'preparation', 'A', 2) RETURNING id INTO cat_a02;
  
  INSERT INTO budget_categories (budget_period_id, code_prefix, name, main_section, section_letter, sort_order)
  VALUES (period_id, 'A03', 'Fencing', 'preparation', 'A', 3) RETURNING id INTO cat_a03;
  
  INSERT INTO budget_categories (budget_period_id, code_prefix, name, main_section, section_letter, sort_order)
  VALUES (period_id, 'A04', 'Pot Filling and Alignment', 'preparation', 'A', 4) RETURNING id INTO cat_a04;
  
  INSERT INTO budget_categories (budget_period_id, code_prefix, name, main_section, section_letter, sort_order)
  VALUES (period_id, 'A05', 'Procurement of Working Tools', 'preparation', 'A', 5) RETURNING id INTO cat_a05;
  
  INSERT INTO budget_categories (budget_period_id, code_prefix, name, main_section, section_letter, sort_order)
  VALUES (period_id, 'B01', 'Nursery Management', 'nursery', 'B', 6) RETURNING id INTO cat_b01;
  
  INSERT INTO budget_categories (budget_period_id, code_prefix, name, main_section, section_letter, sort_order)
  VALUES (period_id, 'D01', 'Field Operations', 'field', 'D', 7) RETURNING id INTO cat_d01;
  
  -- ============================================
  -- A01: Land Acquisition (6,500,000)
  -- ============================================
  INSERT INTO budget_items (budget_category_id, code, shughuli, item, measurement_unit, unit_price, quantity, months) VALUES
    (cat_a01, 'A0101', 'Land Acquisition', 'land', 'site', 200000, 16, 1),
    (cat_a01, 'A0102', 'Land Acquisition', 'diesel', 'lt', 3600, 200, 1),
    (cat_a01, 'A0103', 'Land Acquisition', 'petrol', 'lt', 3600, 300, 1),
    (cat_a01, 'A0104', 'Land Acquisition', 'LA staff', 'person', 50000, 30, 1);
  
  -- A02: Site Clearing (2,140,000)
  INSERT INTO budget_items (budget_category_id, code, shughuli, item, measurement_unit, unit_price, quantity, months) VALUES
    (cat_a02, 'A0201', 'Site Clearing and Leveling', 'LA labourers', 'person', 100000, 16, 1),
    (cat_a02, 'A0202', 'Site Clearing and Leveling', 'diesel', 'lt', 3600, 150, 1);
  
  -- A03: Fencing (4,320,000)
  INSERT INTO budget_items (budget_category_id, code, shughuli, item, measurement_unit, unit_price, quantity, months) VALUES
    (cat_a03, 'A0301', 'Fencing', 'site', 'person', 120000, 16, 1),
    (cat_a03, 'A0302', 'Fencing', 'nyasi', 'site', 100000, 16, 1),
    (cat_a03, 'A0303', 'Fencing', 'miti', 'pieces', 50000, 16, 1);
  
  -- A04: Pot Filling (14,610,000)
  INSERT INTO budget_items (budget_category_id, code, shughuli, item, measurement_unit, unit_price, quantity, months) VALUES
    (cat_a04, 'A0401', 'Pot filling and alignment', 'LA labourers', 'number', 15, 462500, 1),
    (cat_a04, 'A0402', 'Pot filling and alignment', 'LA staff', 'person', 50000, 16, 1),
    (cat_a04, 'A0403', 'Pot filling and alignment', 'sowing', 'person', 5, 462500, 1),
    (cat_a04, 'A0404', 'Pot filling and alignment', 'mbolea', 'trip', 120000, 32, 1),
    (cat_a04, 'A0405', 'Pot filling and alignment', 'petrol', 'lt', 3600, 200, 1);
  
  -- A05: Working Tools (1,632,000)
  INSERT INTO budget_items (budget_category_id, code, shughuli, item, measurement_unit, unit_price, quantity, months) VALUES
    (cat_a05, 'A0501', 'Procurement of working tools', 'Buckets', 'number', 5000, 32, 1),
    (cat_a05, 'A0502', 'Procurement of working tools', 'water can', 'number', 15000, 32, 1),
    (cat_a05, 'A0503', 'Procurement of working tools', 'hoes', 'number', 5000, 32, 1),
    (cat_a05, 'A0504', 'Procurement of working tools', 'slashers', 'number', 10000, 32, 1),
    (cat_a05, 'A0505', 'Procurement of working tools', 'spades', 'number', 10000, 32, 1),
    (cat_a05, 'A0506', 'Procurement of working tools', 'knives', 'number', 6000, 32, 1);
  
  -- B01: Nursery Management
  INSERT INTO budget_items (budget_category_id, code, shughuli, item, measurement_unit, unit_price, quantity, months) VALUES
    (cat_b01, 'B0101', 'Nursery Management', 'labourers Wages', 'month', 120000, 8, 5),
    (cat_b01, 'B0102', 'Nursery Management', 'supervisor salary', 'month', 240000, 2, 5),
    (cat_b01, 'B0103', 'Nursery Management', 'meneja salaries', 'month', 250000, 2, 5),
    (cat_b01, 'B0104', 'Nursery Management', 'L/Allowances manager', 'month', 200000, 2, 5),
    (cat_b01, 'B0105', 'Nursery Management', 'diesel', 'lt', 3600, 400, 5),
    (cat_b01, 'B0106', 'Nursery Management', 'petrol', 'lt', 3600, 300, 5),
    (cat_b01, 'B0107', 'Nursery Management', 'Food', 'person', 90000, 32, 5),
    (cat_b01, 'B0108', 'Nursery Management', 'service and repair vehicle', 'month', 600000, 1, 5),
    (cat_b01, 'B0109', 'Nursery Management', 'service and repair motorcycle', 'month', 400000, 6, 5);
  
  -- D01: Field Operations
  INSERT INTO budget_items (budget_category_id, code, shughuli, item, measurement_unit, unit_price, quantity, months) VALUES
    (cat_d01, 'D0101', 'Ground Clearing', 'Tractor hire', 'hectare', 160000.00, 185, 1),
    (cat_d01, 'D0102', 'Machinery mobilization', 'car hire', 'hectare', 1011660.00, 80, 1),
    (cat_d01, 'D0103', 'Ripping/Ploughing', 'person', 'hectare', 200000.00, 185, 1),
    (cat_d01, 'D0104', 'Marking Holes', 'person', 'hectare', 40000.00, 185, 1),
    (cat_d01, 'D0105', 'Pitting', 'person', 'hectare', 80000.00, 185, 1),
    (cat_d01, 'D0106', 'Planting', 'person', 'hectare', 80000.00, 185, 1),
    (cat_d01, 'D0107', 'First Fertilizer Application', 'person', 'hectare', 18000.00, 185, 1),
    (cat_d01, 'D0108', 'Second Fertilizer Application', 'person', 'hectare', 18000.00, 185, 1),
    (cat_d01, 'D0109', 'Pesticide Application', 'person', 'hectare', 50000.00, 185, 1),
    (cat_d01, 'D0110', 'Gap Filling', 'person', 'hectare', 60000.00, 185, 1),
    (cat_d01, 'D0111', '1st Weeding', 'person', 'hectare', 150000.00, 185, 1),
    (cat_d01, 'D0112', '2nd Weeding', 'person', 'hectare', 100000.00, 185, 1),
    (cat_d01, 'D0113', 'Fire Break Cleaning', 'person', 'hectare', 60000.00, 185, 1),
    (cat_d01, 'D0114', 'Guards', 'person', 'hectare', 90790.00, 185, 1),
    (cat_d01, 'D0115', 'Seedling Transportation', 'person', 'hectare', 85000.00, 185, 1),
    (cat_d01, 'D0116', 'Management and Administrative', 'person', 'hectare', 38910.00, 185, 1);
  
  -- Update subtotals
  UPDATE budget_categories bc SET
    subtotal_planned = (SELECT COALESCE(SUM(total_planned), 0) FROM budget_items WHERE budget_category_id = bc.id);
  
  UPDATE budget_periods bp SET
    total_planned_budget = (SELECT COALESCE(SUM(subtotal_planned), 0) FROM budget_categories WHERE budget_period_id = bp.id);
  
  RAISE NOTICE 'Budget imeingizwa kwa ufanisi!';
  RAISE NOTICE 'Period ID: %', period_id;
END $$;

-- Verify
SELECT 
  bc.code_prefix AS code,
  bc.name AS category,
  'TZS ' || TO_CHAR(bc.subtotal_planned, 'FM999,999,999') AS subtotal
FROM budget_categories bc
ORDER BY bc.sort_order;

SELECT 
  'TOTAL: TZS ' || TO_CHAR(total_planned_budget, 'FM999,999,999') AS grand_total
FROM budget_periods;
