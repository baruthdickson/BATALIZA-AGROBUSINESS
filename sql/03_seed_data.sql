-- ============================================================================
-- SEED DATA - Roles, Permissions, na Bajeti ya Awali
-- ============================================================================
-- ENDESHA hii BAADA ya 01_schema.sql na 02_rls_policies.sql
-- ============================================================================

-- ============================================================================
-- ROLES
-- ============================================================================
INSERT INTO roles (name, slug, description, is_system_role, is_hidden, is_template) VALUES
  ('System Admin', 'system_admin', 'Msimamizi wa kiufundi (mfichwa)', TRUE, TRUE, FALSE),
  ('Project Manager', 'project_manager', 'Mmiliki wa mfumo', TRUE, FALSE, FALSE),
  ('Mhasibu', 'accountant', 'Anashughulika na fedha', FALSE, FALSE, TRUE),
  ('Msimamizi wa Shamba', 'field_supervisor', 'Anasimamia shughuli za shamba', FALSE, FALSE, TRUE),
  ('Karani wa Data', 'data_clerk', 'Anaingiza data', FALSE, FALSE, TRUE);

-- ============================================================================
-- PERMISSIONS
-- ============================================================================
INSERT INTO permissions (module, action, name) VALUES
  -- Budget
  ('budget', 'view', 'Kuona Bajeti'),
  ('budget', 'create', 'Kuongeza Bajeti'),
  ('budget', 'edit', 'Kuhariri Bajeti'),
  ('budget', 'delete', 'Kufuta Bajeti'),
  ('budget', 'approve', 'Kuidhinisha Bajeti'),
  ('budget', 'export', 'Ku-export Bajeti'),
  -- Expenses
  ('expenses', 'view', 'Kuona Matumizi'),
  ('expenses', 'create', 'Kuongeza Matumizi'),
  ('expenses', 'edit', 'Kuhariri Matumizi'),
  ('expenses', 'delete', 'Kufuta Matumizi'),
  ('expenses', 'approve', 'Kuidhinisha Matumizi'),
  ('expenses', 'export', 'Ku-export Matumizi'),
  -- Field
  ('field_activities', 'view', 'Kuona Shughuli'),
  ('field_activities', 'create', 'Kuongeza Shughuli'),
  ('field_activities', 'edit', 'Kuhariri Shughuli'),
  ('field_activities', 'delete', 'Kufuta Shughuli'),
  ('field_activities', 'upload_photos', 'Ku-upload Picha'),
  -- HR
  ('hr', 'view', 'Kuona Wafanyakazi'),
  ('hr', 'create', 'Kuongeza Wafanyakazi'),
  ('hr', 'edit', 'Kuhariri Wafanyakazi'),
  ('hr', 'delete', 'Kufuta Wafanyakazi'),
  ('hr', 'attendance', 'Mahudhurio'),
  ('hr', 'view_salary', 'Kuona Mishahara'),
  -- Payroll
  ('payroll', 'view', 'Kuona Payroll'),
  ('payroll', 'create', 'Kutengeneza Payroll'),
  ('payroll', 'approve', 'Kuidhinisha Payroll'),
  ('payroll', 'process_payment', 'Kulipa'),
  -- Inventory
  ('inventory', 'view', 'Kuona Stock'),
  ('inventory', 'stock_in', 'Stock IN'),
  ('inventory', 'stock_out', 'Stock OUT'),
  ('inventory', 'edit', 'Kuhariri Vifaa'),
  ('inventory', 'delete', 'Kufuta Vifaa'),
  -- Fleet
  ('fleet', 'view', 'Kuona Magari'),
  ('fleet', 'create', 'Kuongeza Magari'),
  ('fleet', 'edit', 'Kuhariri Magari'),
  ('fleet', 'fuel_log', 'Fuel Logs'),
  ('fleet', 'service', 'Service Records'),
  -- Reports
  ('reports', 'view_dashboard', 'Dashboard'),
  ('reports', 'view_financial', 'Ripoti za Fedha'),
  ('reports', 'view_operational', 'Ripoti za Kazi'),
  ('reports', 'export', 'Export Ripoti'),
  -- Users
  ('users', 'view', 'Kuona Watumiaji'),
  ('users', 'create', 'Kuongeza Watumiaji'),
  ('users', 'edit', 'Kuhariri Watumiaji'),
  ('users', 'delete', 'Kufuta Watumiaji'),
  ('users', 'reset_password', 'Reset Password'),
  ('users', 'manage_roles', 'Manage Roles'),
  -- System
  ('system', 'view_audit', 'Audit Logs'),
  ('system', 'edit_company', 'Kuhariri Kampuni'),
  ('system', 'edit_settings', 'Settings');

-- ============================================================================
-- PROJECT MANAGER: ALL PERMISSIONS
-- ============================================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE slug = 'project_manager'), id FROM permissions;

-- ============================================================================
-- SYSTEM ADMIN: ALL PERMISSIONS
-- ============================================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE slug = 'system_admin'), id FROM permissions;

-- ============================================================================
-- MHASIBU PERMISSIONS
-- ============================================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE slug = 'accountant'), id
FROM permissions
WHERE (module, action) IN (
  ('budget', 'view'), ('budget', 'export'),
  ('expenses', 'view'), ('expenses', 'create'), ('expenses', 'edit'), ('expenses', 'export'),
  ('inventory', 'view'),
  ('hr', 'view'), ('hr', 'view_salary'),
  ('payroll', 'view'), ('payroll', 'create'),
  ('reports', 'view_dashboard'), ('reports', 'view_financial'), ('reports', 'export')
);

-- ============================================================================
-- FIELD SUPERVISOR PERMISSIONS
-- ============================================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE slug = 'field_supervisor'), id
FROM permissions
WHERE (module, action) IN (
  ('field_activities', 'view'), ('field_activities', 'create'),
  ('field_activities', 'edit'), ('field_activities', 'upload_photos'),
  ('hr', 'view'), ('hr', 'attendance'),
  ('inventory', 'view'), ('inventory', 'stock_out'),
  ('fleet', 'view'), ('fleet', 'fuel_log'),
  ('reports', 'view_dashboard'), ('reports', 'view_operational')
);

-- ============================================================================
-- DATA CLERK PERMISSIONS
-- ============================================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT (SELECT id FROM roles WHERE slug = 'data_clerk'), id
FROM permissions
WHERE (module, action) IN (
  ('expenses', 'view'), ('expenses', 'create'),
  ('field_activities', 'view'), ('field_activities', 'create'),
  ('hr', 'attendance'),
  ('inventory', 'stock_in'), ('inventory', 'stock_out'),
  ('reports', 'view_dashboard')
);

-- ============================================================================
-- EMPLOYEE CATEGORIES
-- ============================================================================
INSERT INTO employee_categories (name, description, default_salary, payment_type) VALUES
  ('Labourer', 'Wafanyakazi wa shamba', 120000.00, 'monthly'),
  ('Field Supervisor', 'Wasimamizi wa shamba', 240000.00, 'monthly'),
  ('Project Manager', 'Meneja wa mradi', 250000.00, 'monthly'),
  ('Guard', 'Walinzi', 90790.00, 'monthly'),
  ('Driver', 'Madereva', 200000.00, 'monthly'),
  ('Tractor Operator', 'Madereva wa trekta', 250000.00, 'monthly'),
  ('Cook', 'Wapishi', 120000.00, 'monthly'),
  ('Casual Worker', 'Wafanyakazi wa muda', 5000.00, 'daily');

-- ============================================================================
-- INVENTORY CATEGORIES
-- ============================================================================
INSERT INTO inventory_categories (name, description) VALUES
  ('Tools', 'Vifaa vya kazi (buckets, hoes, slashers)'),
  ('Fertilizers', 'Mbolea'),
  ('Pesticides', 'Dawa za wadudu'),
  ('Seeds', 'Mbegu na vipando'),
  ('Fuel', 'Mafuta yaliyohifadhiwa'),
  ('Office Supplies', 'Vifaa vya ofisi'),
  ('Safety Equipment', 'Vifaa vya usalama'),
  ('Construction Materials', 'Vifaa vya ujenzi');

-- ============================================================================
-- DEFAULT PLOTS (Block A, B, C, D = 185 hectares total)
-- ============================================================================
INSERT INTO plots (name, code, size_hectares, status, notes) VALUES
  ('Block A', 'BLK-A', 50.00, 'active', 'Block ya kwanza'),
  ('Block B', 'BLK-B', 50.00, 'active', 'Block ya pili'),
  ('Block C', 'BLK-C', 45.00, 'active', 'Block ya tatu'),
  ('Block D', 'BLK-D', 40.00, 'active', 'Block ya nne');

-- ============================================================================
-- COMPANY PROFILE (Bataliza Agrobusiness)
-- ============================================================================
INSERT INTO company_profile (
  company_name, region, district, currency, language, timezone
) VALUES (
  'Bataliza Agrobusiness', 'Tabora', 'Urambo', 'TZS', 'sw', 'Africa/Dar_es_Salaam'
);

-- ============================================================================
-- SYSTEM SETTINGS
-- ============================================================================
INSERT INTO system_settings (setting_key, setting_value, setting_type, category, is_system) VALUES
  ('app_name', 'Mashamba Makubwa System', 'string', 'general', FALSE),
  ('app_version', '1.0.0', 'string', 'general', TRUE),
  ('default_currency', 'TZS', 'string', 'general', FALSE),
  ('session_timeout_minutes', '120', 'integer', 'security', FALSE),
  ('budget_alert_threshold', '90', 'integer', 'alerts', FALSE),
  ('low_stock_alert_enabled', 'true', 'boolean', 'alerts', FALSE);

-- ============================================================================
-- BUDGET PERIOD: Mashamba Makubwa 2025-2026
-- ============================================================================
-- Note: Budget itaingizwa baada ya mtumiaji wa kwanza kutengenezwa
-- Tutaiingiza kupitia frontend script ili kuwa na created_by sahihi

-- ============================================================================
-- BUDGET CATEGORIES (mahali pa kuingiza baada ya kuwa na user)
-- ============================================================================
-- Skip kwa sasa - tutaingiza kupitia setup script frontend

-- ============================================================================
-- BUDGET ITEMS (mahali pa kuingiza baada ya kuwa na user)
-- ============================================================================
-- Skip kwa sasa - tutaingiza kupitia setup script frontend

COMMENT ON TABLE roles IS 'Setup complete - tengeneza user wa kwanza kupitia Supabase Auth';
