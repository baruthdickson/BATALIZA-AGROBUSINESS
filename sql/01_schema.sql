-- ============================================================================
-- MFUMO WA MASHAMBA MAKUBWA - SUPABASE SCHEMA
-- PostgreSQL 14+ (Supabase)
-- ============================================================================
-- ENDESHA: Copy hii yote, paste kwenye Supabase SQL Editor, run.
-- ============================================================================

-- Tumia "extensions" schema kwa UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. ROLES
-- ============================================================================
CREATE TABLE roles (
  id              BIGSERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  slug            VARCHAR(100) NOT NULL UNIQUE,
  description     TEXT,
  is_system_role  BOOLEAN NOT NULL DEFAULT FALSE,
  is_hidden       BOOLEAN NOT NULL DEFAULT FALSE,
  is_template     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. PERMISSIONS
-- ============================================================================
CREATE TABLE permissions (
  id          BIGSERIAL PRIMARY KEY,
  module      VARCHAR(50) NOT NULL,
  action      VARCHAR(50) NOT NULL,
  name        VARCHAR(150) NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(module, action)
);

-- ============================================================================
-- 3. USERS (Profile - linked to auth.users via id)
-- ============================================================================
CREATE TABLE users (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username            VARCHAR(50) NOT NULL UNIQUE,
  email               VARCHAR(100) NOT NULL UNIQUE,
  phone               VARCHAR(20),
  full_name           VARCHAR(150) NOT NULL,
  role_id             BIGINT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  is_system_admin     BOOLEAN NOT NULL DEFAULT FALSE,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at       TIMESTAMPTZ,
  profile_photo       TEXT,
  preferred_language  VARCHAR(10) NOT NULL DEFAULT 'sw',
  created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);
CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_users_deleted ON users(deleted_at);

-- ============================================================================
-- 4. ROLE_PERMISSIONS
-- ============================================================================
CREATE TABLE role_permissions (
  id            BIGSERIAL PRIMARY KEY,
  role_id       BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

-- ============================================================================
-- 5. AUDIT_LOGS
-- ============================================================================
CREATE TABLE audit_logs (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  action        VARCHAR(100) NOT NULL,
  module        VARCHAR(50) NOT NULL,
  entity_type   VARCHAR(100),
  entity_id     BIGINT,
  old_values    JSONB,
  new_values    JSONB,
  description   TEXT,
  ip_address    VARCHAR(45),
  visible_to_pm BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_module ON audit_logs(module);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);

-- ============================================================================
-- 6. BUDGET_PERIODS
-- ============================================================================
CREATE TABLE budget_periods (
  id                    BIGSERIAL PRIMARY KEY,
  name                  VARCHAR(200) NOT NULL,
  fiscal_year           VARCHAR(20) NOT NULL,
  start_date            DATE NOT NULL,
  end_date              DATE NOT NULL,
  total_planned_budget  NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_actual_spent    NUMERIC(18,2) NOT NULL DEFAULT 0,
  status                VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','active','closed')),
  currency              VARCHAR(10) NOT NULL DEFAULT 'TZS',
  approved_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at           TIMESTAMPTZ,
  notes                 TEXT,
  created_by            UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date > start_date)
);

-- ============================================================================
-- 7. BUDGET_CATEGORIES
-- ============================================================================
CREATE TABLE budget_categories (
  id                BIGSERIAL PRIMARY KEY,
  budget_period_id  BIGINT NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE,
  code_prefix       VARCHAR(10) NOT NULL,
  name              VARCHAR(200) NOT NULL,
  main_section      VARCHAR(20) NOT NULL CHECK (main_section IN ('preparation','nursery','field')),
  section_letter    CHAR(1) NOT NULL,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  subtotal_planned  NUMERIC(18,2) NOT NULL DEFAULT 0,
  subtotal_actual   NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(budget_period_id, code_prefix)
);

-- ============================================================================
-- 8. BUDGET_ITEMS
-- ============================================================================
CREATE TABLE budget_items (
  id                    BIGSERIAL PRIMARY KEY,
  budget_category_id    BIGINT NOT NULL REFERENCES budget_categories(id) ON DELETE CASCADE,
  code                  VARCHAR(20) NOT NULL UNIQUE,
  shughuli              VARCHAR(300),
  item                  VARCHAR(300) NOT NULL,
  measurement_unit      VARCHAR(50) NOT NULL,
  unit_price            NUMERIC(18,2) NOT NULL,
  quantity              NUMERIC(15,2) NOT NULL,
  months                INTEGER NOT NULL DEFAULT 1,
  total_planned         NUMERIC(18,2) GENERATED ALWAYS AS (unit_price * quantity * months) STORED,
  total_actual          NUMERIC(18,2) NOT NULL DEFAULT 0,
  status                VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','completed','overrun')),
  alert_threshold       NUMERIC(5,2) NOT NULL DEFAULT 90.00,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 9. SUPPLIERS
-- ============================================================================
CREATE TABLE suppliers (
  id              BIGSERIAL PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,
  contact_person  VARCHAR(200),
  phone           VARCHAR(20),
  email           VARCHAR(100),
  address         TEXT,
  tin_number      VARCHAR(20),
  vrn_number      VARCHAR(20),
  bank_name       VARCHAR(100),
  bank_account    VARCHAR(50),
  category        VARCHAR(100),
  status          VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','blacklisted')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 10. EXPENSES
-- ============================================================================
CREATE TABLE expenses (
  id                BIGSERIAL PRIMARY KEY,
  budget_item_id    BIGINT NOT NULL REFERENCES budget_items(id) ON DELETE RESTRICT,
  expense_date      DATE NOT NULL,
  description       TEXT NOT NULL,
  quantity          NUMERIC(15,2),
  unit_price        NUMERIC(18,2),
  amount            NUMERIC(18,2) NOT NULL,
  supplier_name     VARCHAR(200),
  supplier_id       BIGINT REFERENCES suppliers(id) ON DELETE SET NULL,
  payment_method    VARCHAR(20) NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','bank','mobile_money','cheque')),
  reference_number  VARCHAR(100),
  recorded_by       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at       TIMESTAMPTZ,
  rejection_reason  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX idx_exp_budget_item ON expenses(budget_item_id);
CREATE INDEX idx_exp_date ON expenses(expense_date);
CREATE INDEX idx_exp_status ON expenses(status);
CREATE INDEX idx_exp_deleted ON expenses(deleted_at);

-- ============================================================================
-- 11. EXPENSE_ATTACHMENTS
-- ============================================================================
CREATE TABLE expense_attachments (
  id              BIGSERIAL PRIMARY KEY,
  expense_id      BIGINT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  file_path       TEXT NOT NULL,
  file_name       VARCHAR(255) NOT NULL,
  file_type       VARCHAR(50) NOT NULL,
  file_size       INTEGER NOT NULL,
  uploaded_by     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 12. PLOTS
-- ============================================================================
CREATE TABLE plots (
  id              BIGSERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  code            VARCHAR(50) UNIQUE,
  size_hectares   NUMERIC(10,2) NOT NULL,
  gps_coordinates TEXT,
  soil_type       VARCHAR(100),
  crop_type       VARCHAR(100),
  status          VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','fallow','reserved')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 13. EMPLOYEE_CATEGORIES
-- ============================================================================
CREATE TABLE employee_categories (
  id              BIGSERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL UNIQUE,
  description     TEXT,
  default_salary  NUMERIC(18,2) NOT NULL DEFAULT 0,
  payment_type    VARCHAR(20) NOT NULL DEFAULT 'monthly' CHECK (payment_type IN ('monthly','daily','task_based')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 14. EMPLOYEES
-- ============================================================================
CREATE TABLE employees (
  id                       BIGSERIAL PRIMARY KEY,
  employee_number          VARCHAR(50) NOT NULL UNIQUE,
  first_name               VARCHAR(100) NOT NULL,
  middle_name              VARCHAR(100),
  last_name                VARCHAR(100) NOT NULL,
  nida_number              VARCHAR(30) UNIQUE,
  phone                    VARCHAR(20),
  email                    VARCHAR(100),
  address                  TEXT,
  date_of_birth            DATE,
  gender                   VARCHAR(10) CHECK (gender IN ('male','female')),
  employee_category_id     BIGINT NOT NULL REFERENCES employee_categories(id) ON DELETE RESTRICT,
  hire_date                DATE NOT NULL,
  salary                   NUMERIC(18,2) NOT NULL,
  bank_name                VARCHAR(100),
  bank_account             VARCHAR(50),
  mobile_money_number      VARCHAR(20),
  emergency_contact_name   VARCHAR(200),
  emergency_contact_phone  VARCHAR(20),
  photo                    TEXT,
  status                   VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','terminated','on_leave')),
  termination_date         DATE,
  termination_reason       TEXT,
  created_by               UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at               TIMESTAMPTZ
);
CREATE INDEX idx_emp_category ON employees(employee_category_id);
CREATE INDEX idx_emp_status ON employees(status);
CREATE INDEX idx_emp_name ON employees(first_name, last_name);

-- ============================================================================
-- 15. FIELD_ACTIVITIES
-- ============================================================================
CREATE TABLE field_activities (
  id                    BIGSERIAL PRIMARY KEY,
  budget_item_id        BIGINT NOT NULL REFERENCES budget_items(id) ON DELETE RESTRICT,
  name                  VARCHAR(200) NOT NULL,
  description           TEXT,
  planned_start_date    DATE NOT NULL,
  planned_end_date      DATE NOT NULL,
  actual_start_date     DATE,
  actual_end_date       DATE,
  status                VARCHAR(20) NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed','on_hold','cancelled')),
  planned_hectares      NUMERIC(10,2) NOT NULL,
  completed_hectares    NUMERIC(10,2) NOT NULL DEFAULT 0,
  progress_percentage   NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN planned_hectares > 0
         THEN LEAST((completed_hectares / planned_hectares) * 100, 100)
         ELSE 0 END
  ) STORED,
  supervisor_id         BIGINT REFERENCES employees(id) ON DELETE SET NULL,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (planned_end_date >= planned_start_date)
);

-- ============================================================================
-- 16. ACTIVITY_PROGRESS
-- ============================================================================
CREATE TABLE activity_progress (
  id                  BIGSERIAL PRIMARY KEY,
  field_activity_id   BIGINT NOT NULL REFERENCES field_activities(id) ON DELETE CASCADE,
  plot_id             BIGINT REFERENCES plots(id) ON DELETE SET NULL,
  progress_date       DATE NOT NULL,
  hectares_done       NUMERIC(10,2) NOT NULL,
  workers_count       INTEGER NOT NULL DEFAULT 0,
  weather_condition   VARCHAR(100),
  challenges          TEXT,
  notes               TEXT,
  recorded_by         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 17. ACTIVITY_PHOTOS
-- ============================================================================
CREATE TABLE activity_photos (
  id                    BIGSERIAL PRIMARY KEY,
  field_activity_id     BIGINT NOT NULL REFERENCES field_activities(id) ON DELETE CASCADE,
  activity_progress_id  BIGINT REFERENCES activity_progress(id) ON DELETE SET NULL,
  file_path             TEXT NOT NULL,
  caption               VARCHAR(500),
  gps_lat               NUMERIC(10,7),
  gps_lng               NUMERIC(10,7),
  taken_at              TIMESTAMPTZ,
  uploaded_by           UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 18. ATTENDANCE
-- ============================================================================
CREATE TABLE attendance (
  id                  BIGSERIAL PRIMARY KEY,
  employee_id         BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  attendance_date     DATE NOT NULL,
  status              VARCHAR(20) NOT NULL CHECK (status IN ('present','absent','half_day','leave','sick','holiday')),
  check_in_time       TIME,
  check_out_time      TIME,
  hours_worked        NUMERIC(5,2),
  field_activity_id   BIGINT REFERENCES field_activities(id) ON DELETE SET NULL,
  plot_id             BIGINT REFERENCES plots(id) ON DELETE SET NULL,
  notes               TEXT,
  recorded_by         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, attendance_date)
);

-- ============================================================================
-- 19. PAYROLL_PERIODS
-- ============================================================================
CREATE TABLE payroll_periods (
  id              BIGSERIAL PRIMARY KEY,
  month           INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year            INTEGER NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','paid','closed')),
  total_employees INTEGER NOT NULL DEFAULT 0,
  total_amount    NUMERIC(18,2) NOT NULL DEFAULT 0,
  approved_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(month, year)
);

-- ============================================================================
-- 20. PAYROLL_ITEMS
-- ============================================================================
CREATE TABLE payroll_items (
  id                  BIGSERIAL PRIMARY KEY,
  payroll_period_id   BIGINT NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  employee_id         BIGINT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  basic_salary        NUMERIC(18,2) NOT NULL,
  allowances          NUMERIC(18,2) NOT NULL DEFAULT 0,
  overtime            NUMERIC(18,2) NOT NULL DEFAULT 0,
  deductions          NUMERIC(18,2) NOT NULL DEFAULT 0,
  days_worked         INTEGER NOT NULL DEFAULT 0,
  days_absent         INTEGER NOT NULL DEFAULT 0,
  gross_pay           NUMERIC(18,2) GENERATED ALWAYS AS (basic_salary + allowances + overtime) STORED,
  net_pay             NUMERIC(18,2) GENERATED ALWAYS AS (basic_salary + allowances + overtime - deductions) STORED,
  payment_status      VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed')),
  payment_method      VARCHAR(20) CHECK (payment_method IN ('cash','bank','mobile_money')),
  payment_date        DATE,
  payment_reference   VARCHAR(100),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(payroll_period_id, employee_id)
);

-- ============================================================================
-- 21. INVENTORY_CATEGORIES
-- ============================================================================
CREATE TABLE inventory_categories (
  id          BIGSERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 22. INVENTORY_ITEMS
-- ============================================================================
CREATE TABLE inventory_items (
  id                      BIGSERIAL PRIMARY KEY,
  inventory_category_id   BIGINT NOT NULL REFERENCES inventory_categories(id) ON DELETE RESTRICT,
  name                    VARCHAR(200) NOT NULL,
  code                    VARCHAR(50) UNIQUE,
  description             TEXT,
  unit                    VARCHAR(50) NOT NULL,
  current_stock           NUMERIC(10,2) NOT NULL DEFAULT 0,
  minimum_stock           NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit_price              NUMERIC(18,2) NOT NULL DEFAULT 0,
  storage_location        VARCHAR(200),
  status                  VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at              TIMESTAMPTZ
);

-- ============================================================================
-- 23. STOCK_MOVEMENTS
-- ============================================================================
CREATE TABLE stock_movements (
  id                      BIGSERIAL PRIMARY KEY,
  inventory_item_id       BIGINT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  movement_type           VARCHAR(20) NOT NULL CHECK (movement_type IN ('in','out','adjustment','transfer')),
  quantity                NUMERIC(10,2) NOT NULL,
  unit_price              NUMERIC(18,2),
  total_value             NUMERIC(18,2) GENERATED ALWAYS AS (quantity * COALESCE(unit_price, 0)) STORED,
  reference_type          VARCHAR(50),
  expense_id              BIGINT REFERENCES expenses(id) ON DELETE SET NULL,
  supplier_id             BIGINT REFERENCES suppliers(id) ON DELETE SET NULL,
  issued_to_employee_id   BIGINT REFERENCES employees(id) ON DELETE SET NULL,
  field_activity_id       BIGINT REFERENCES field_activities(id) ON DELETE SET NULL,
  movement_date           DATE NOT NULL,
  notes                   TEXT,
  recorded_by             UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 24. VEHICLES
-- ============================================================================
CREATE TABLE vehicles (
  id                        BIGSERIAL PRIMARY KEY,
  vehicle_number            VARCHAR(50) NOT NULL UNIQUE,
  type                      VARCHAR(20) NOT NULL CHECK (type IN ('car','motorcycle','truck','tractor','other')),
  make                      VARCHAR(100),
  model                     VARCHAR(100),
  year                      INTEGER,
  fuel_type                 VARCHAR(20) NOT NULL CHECK (fuel_type IN ('petrol','diesel','electric')),
  tank_capacity             NUMERIC(8,2),
  assigned_to_employee_id   BIGINT REFERENCES employees(id) ON DELETE SET NULL,
  current_odometer          INTEGER NOT NULL DEFAULT 0,
  status                    VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','in_service','inactive','sold')),
  insurance_expiry          DATE,
  registration_expiry       DATE,
  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 25. FUEL_LOGS
-- ============================================================================
CREATE TABLE fuel_logs (
  id                BIGSERIAL PRIMARY KEY,
  vehicle_id        BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  log_date          DATE NOT NULL,
  fuel_type         VARCHAR(20) NOT NULL CHECK (fuel_type IN ('petrol','diesel')),
  liters            NUMERIC(10,2) NOT NULL,
  price_per_liter   NUMERIC(10,2) NOT NULL,
  total_cost        NUMERIC(18,2) GENERATED ALWAYS AS (liters * price_per_liter) STORED,
  odometer_before   INTEGER,
  odometer_after    INTEGER,
  station_name      VARCHAR(200),
  driver_id         BIGINT REFERENCES employees(id) ON DELETE SET NULL,
  expense_id        BIGINT REFERENCES expenses(id) ON DELETE SET NULL,
  recorded_by       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 26. SERVICE_RECORDS
-- ============================================================================
CREATE TABLE service_records (
  id                  BIGSERIAL PRIMARY KEY,
  vehicle_id          BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  service_date        DATE NOT NULL,
  service_type        VARCHAR(200) NOT NULL,
  description         TEXT NOT NULL,
  cost                NUMERIC(18,2) NOT NULL,
  service_provider    VARCHAR(200),
  odometer_at_service INTEGER,
  next_service_date   DATE,
  expense_id          BIGINT REFERENCES expenses(id) ON DELETE SET NULL,
  recorded_by         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 27. COMPANY_PROFILE (singleton)
-- ============================================================================
CREATE TABLE company_profile (
  id                  BIGSERIAL PRIMARY KEY,
  company_name        VARCHAR(200) NOT NULL,
  logo_path           TEXT,
  address             TEXT,
  region              VARCHAR(100),
  district            VARCHAR(100),
  phone               VARCHAR(20),
  email               VARCHAR(100),
  website             VARCHAR(200),
  tin_number          VARCHAR(20),
  vrn_number          VARCHAR(20),
  currency            VARCHAR(10) NOT NULL DEFAULT 'TZS',
  language            VARCHAR(10) NOT NULL DEFAULT 'sw',
  timezone            VARCHAR(50) NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
  updated_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 28. SYSTEM_SETTINGS
-- ============================================================================
CREATE TABLE system_settings (
  id              BIGSERIAL PRIMARY KEY,
  setting_key     VARCHAR(100) NOT NULL UNIQUE,
  setting_value   TEXT,
  setting_type    VARCHAR(20) NOT NULL DEFAULT 'string' CHECK (setting_type IN ('string','integer','boolean','json')),
  category        VARCHAR(50),
  description     TEXT,
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 29. NOTIFICATIONS
-- ============================================================================
CREATE TABLE notifications (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(50) NOT NULL,
  title       VARCHAR(200) NOT NULL,
  message     TEXT NOT NULL,
  link        TEXT,
  priority    VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notif_user ON notifications(user_id);
CREATE INDEX idx_notif_read ON notifications(is_read);

-- ============================================================================
-- AUTO-UPDATE updated_at TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'updated_at' AND table_schema = 'public'
  LOOP
    EXECUTE format('
      CREATE TRIGGER update_%I_updated_at
      BEFORE UPDATE ON %I
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    ', t, t);
  END LOOP;
END $$;

-- ============================================================================
-- AUTO-UPDATE BUDGET TOTALS TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION update_budget_actual()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.status = 'approved' AND OLD.status != 'approved')
     OR (TG_OP = 'UPDATE' AND OLD.status = 'approved' AND NEW.status != 'approved')
     OR (TG_OP = 'INSERT' AND NEW.status = 'approved') THEN
    UPDATE budget_items
    SET total_actual = (
      SELECT COALESCE(SUM(amount), 0) FROM expenses
      WHERE budget_item_id = NEW.budget_item_id
        AND status = 'approved'
        AND deleted_at IS NULL
    )
    WHERE id = NEW.budget_item_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_expense_update_budget
AFTER INSERT OR UPDATE ON expenses
FOR EACH ROW EXECUTE FUNCTION update_budget_actual();

-- ============================================================================
-- AUTO-UPDATE STOCK TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION update_inventory_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.movement_type = 'in' THEN
    UPDATE inventory_items SET current_stock = current_stock + NEW.quantity WHERE id = NEW.inventory_item_id;
  ELSIF NEW.movement_type = 'out' THEN
    UPDATE inventory_items SET current_stock = current_stock - NEW.quantity WHERE id = NEW.inventory_item_id;
  ELSIF NEW.movement_type = 'adjustment' THEN
    UPDATE inventory_items SET current_stock = NEW.quantity WHERE id = NEW.inventory_item_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_movement
AFTER INSERT ON stock_movements
FOR EACH ROW EXECUTE FUNCTION update_inventory_stock();

-- ============================================================================
-- USER CREATION TRIGGER (auto-create profile when auth user is created)
-- ============================================================================
-- Note: Hii trigger inategemea kuwa kuna meta_data inayopelekwa wakati wa signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Hii inahitaji kuwekwa wakati admin anatengeneza user
  -- Tutaitumia kupitia frontend baada ya signup
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION handle_new_user IS 'Helper function for user creation - actual profile creation done from frontend';
