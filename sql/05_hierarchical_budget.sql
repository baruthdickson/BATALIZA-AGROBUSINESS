-- ============================================================================
-- 05_HIERARCHICAL_BUDGET.SQL
-- Bajeti Hierarchical (QuickBooks-style)
--
-- Master Budget → Activities (LSF, CCP) → Sub-categories (Bustani) → Line Items
-- ============================================================================

-- Ongeza parent_id kwenye budget_items kuwa hierarchical
ALTER TABLE budget_items 
  ADD COLUMN IF NOT EXISTS parent_id BIGINT REFERENCES budget_items(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'leaf' CHECK (item_type IN ('header','leaf'));

CREATE INDEX IF NOT EXISTS idx_budget_items_parent ON budget_items(parent_id);

-- View ya kuhesabu jumla auto (recursive)
CREATE OR REPLACE FUNCTION get_budget_item_total_planned(p_id BIGINT) RETURNS NUMERIC AS $$
DECLARE v_total NUMERIC;
BEGIN
  -- Kama ni leaf, rudisha total_planned kawaida
  IF EXISTS (SELECT 1 FROM budget_items WHERE id = p_id AND item_type = 'leaf') THEN
    SELECT total_planned INTO v_total FROM budget_items WHERE id = p_id;
    RETURN COALESCE(v_total, 0);
  END IF;
  -- Kama ni header, jumlisha watoto
  SELECT COALESCE(SUM(get_budget_item_total_planned(id)), 0) INTO v_total
    FROM budget_items WHERE parent_id = p_id;
  RETURN v_total;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION get_budget_item_total_actual(p_id BIGINT) RETURNS NUMERIC AS $$
DECLARE v_total NUMERIC;
BEGIN
  IF EXISTS (SELECT 1 FROM budget_items WHERE id = p_id AND item_type = 'leaf') THEN
    SELECT total_actual INTO v_total FROM budget_items WHERE id = p_id;
    RETURN COALESCE(v_total, 0);
  END IF;
  SELECT COALESCE(SUM(get_budget_item_total_actual(id)), 0) INTO v_total
    FROM budget_items WHERE parent_id = p_id;
  RETURN v_total;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- CHART OF ACCOUNTS (QuickBooks-style)
-- ============================================================================
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('asset','liability','equity','income','expense')),
  parent_id BIGINT REFERENCES chart_of_accounts(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- JOURNAL ENTRIES (Double-entry bookkeeping)
-- ============================================================================
CREATE TABLE IF NOT EXISTS journal_entries (
  id BIGSERIAL PRIMARY KEY,
  entry_date DATE NOT NULL,
  reference_number TEXT,
  description TEXT NOT NULL,
  total_amount NUMERIC(15,2) NOT NULL,
  status TEXT DEFAULT 'posted' CHECK (status IN ('draft','posted','voided')),
  source_module TEXT,
  source_id BIGINT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id BIGSERIAL PRIMARY KEY,
  entry_id BIGINT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id BIGINT NOT NULL REFERENCES chart_of_accounts(id),
  debit NUMERIC(15,2) DEFAULT 0,
  credit NUMERIC(15,2) DEFAULT 0,
  description TEXT,
  CONSTRAINT debit_or_credit CHECK ((debit = 0 OR credit = 0) AND (debit + credit > 0))
);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(account_id);

-- ============================================================================
-- INVOICES (Bills to receive)
-- ============================================================================
CREATE TABLE IF NOT EXISTS invoices (
  id BIGSERIAL PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  invoice_date DATE NOT NULL,
  due_date DATE,
  subtotal NUMERIC(15,2) DEFAULT 0,
  tax_amount NUMERIC(15,2) DEFAULT 0,
  total NUMERIC(15,2) DEFAULT 0,
  amount_paid NUMERIC(15,2) DEFAULT 0,
  balance NUMERIC(15,2) GENERATED ALWAYS AS (COALESCE(total,0) - COALESCE(amount_paid,0)) STORED,
  status TEXT DEFAULT 'pending' CHECK (status IN ('draft','pending','partial','paid','overdue','cancelled')),
  notes TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) DEFAULT 1,
  unit_price NUMERIC(15,2) DEFAULT 0,
  amount NUMERIC(15,2) GENERATED ALWAYS AS (COALESCE(quantity,1) * COALESCE(unit_price,0)) STORED
);

-- ============================================================================
-- SEED: Chart of Accounts ya msingi
-- ============================================================================
INSERT INTO chart_of_accounts (code, name, account_type, description) VALUES
  ('1000', 'Mali (Assets)', 'asset', 'Mali zote za kampuni'),
  ('1100', 'Pesa Taslimu (Cash)', 'asset', 'Cash and bank'),
  ('1200', 'Wadeni (Accounts Receivable)', 'asset', 'Pesa zinatulipwa'),
  ('1300', 'Stoo (Inventory)', 'asset', 'Vifaa stoo'),
  ('1400', 'Magari (Fixed Assets)', 'asset', 'Magari na mali zingine'),
  ('2000', 'Madeni (Liabilities)', 'liability', 'Madeni yote'),
  ('2100', 'Wakopaji (Accounts Payable)', 'liability', 'Pesa tunazodaiwa'),
  ('3000', 'Mtaji (Equity)', 'equity', 'Mtaji wa mmiliki'),
  ('4000', 'Mauzo (Income)', 'income', 'Mapato yote'),
  ('4100', 'Mauzo ya Mazao', 'income', 'Crop sales'),
  ('5000', 'Matumizi (Expenses)', 'expense', 'Matumizi yote'),
  ('5100', 'Mishahara', 'expense', 'Salaries and wages'),
  ('5200', 'Mbolea & Mbegu', 'expense', 'Fertilizers and seeds'),
  ('5300', 'Mafuta & Magari', 'expense', 'Fuel and vehicles'),
  ('5400', 'Bustani & Shamba', 'expense', 'Field operations'),
  ('5500', 'Office & Admin', 'expense', 'Administrative expenses')
ON CONFLICT (code) DO NOTHING;
