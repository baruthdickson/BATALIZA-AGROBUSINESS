-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Inalinda data hata kama anon key inaonekana hadharani
-- ============================================================================
-- Sera kuu: Lazima user awe ame-login na awe na permission inayofaa
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTION: Check if current user has a permission
-- ============================================================================
CREATE OR REPLACE FUNCTION auth_has_permission(perm_module TEXT, perm_action TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  has_perm BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM users u
    JOIN role_permissions rp ON rp.role_id = u.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE u.id = auth.uid()
      AND p.module = perm_module
      AND p.action = perm_action
      AND rp.granted = TRUE
      AND u.is_active = TRUE
      AND u.deleted_at IS NULL
  ) INTO has_perm;
  RETURN has_perm;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- HELPER: Check if user is Project Manager
-- ============================================================================
CREATE OR REPLACE FUNCTION auth_is_pm()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.id = auth.uid()
      AND r.slug IN ('project_manager', 'system_admin')
      AND u.is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- HELPER: Get current user's role_id
-- ============================================================================
CREATE OR REPLACE FUNCTION auth_user_role_id()
RETURNS BIGINT AS $$
DECLARE
  rid BIGINT;
BEGIN
  SELECT role_id INTO rid FROM users WHERE id = auth.uid();
  RETURN rid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================
ALTER TABLE roles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_periods       ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_attachments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE plots                ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees            ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_activities     ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_progress    ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_photos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance           ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_periods      ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_records      ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_profile      ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications        ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- USERS TABLE POLICIES
-- ============================================================================
-- Kila mtu anaona profile yake mwenyewe
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- PM anaweza kuona watumiaji wote (isipokuwa system admin)
CREATE POLICY "PM can view all users" ON users
  FOR SELECT USING (auth_is_pm() AND NOT is_system_admin);

-- PM anaweza kuongeza users
CREATE POLICY "PM can create users" ON users
  FOR INSERT WITH CHECK (auth_has_permission('users', 'create'));

-- PM anaweza kuhariri users
CREATE POLICY "PM can update users" ON users
  FOR UPDATE USING (auth_has_permission('users', 'edit') AND NOT is_system_admin);

-- Mtumiaji anaweza kuhariri profile yake
CREATE POLICY "Users update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- ============================================================================
-- ROLES & PERMISSIONS POLICIES
-- ============================================================================
CREATE POLICY "Authenticated read roles" ON roles
  FOR SELECT USING (auth.uid() IS NOT NULL AND NOT is_hidden);

CREATE POLICY "PM manage roles" ON roles
  FOR ALL USING (auth_has_permission('users', 'manage_roles'));

CREATE POLICY "Authenticated read permissions" ON permissions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated read role_permissions" ON role_permissions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "PM manage role_permissions" ON role_permissions
  FOR ALL USING (auth_has_permission('users', 'manage_roles'));

-- ============================================================================
-- BUDGET POLICIES
-- ============================================================================
CREATE POLICY "View budget periods" ON budget_periods
  FOR SELECT USING (auth_has_permission('budget', 'view'));

CREATE POLICY "Create budget periods" ON budget_periods
  FOR INSERT WITH CHECK (auth_has_permission('budget', 'create'));

CREATE POLICY "Edit budget periods" ON budget_periods
  FOR UPDATE USING (auth_has_permission('budget', 'edit'));

CREATE POLICY "Delete budget periods" ON budget_periods
  FOR DELETE USING (auth_has_permission('budget', 'delete'));

CREATE POLICY "View budget categories" ON budget_categories
  FOR SELECT USING (auth_has_permission('budget', 'view'));

CREATE POLICY "Create budget categories" ON budget_categories
  FOR INSERT WITH CHECK (auth_has_permission('budget', 'create'));

CREATE POLICY "Edit budget categories" ON budget_categories
  FOR UPDATE USING (auth_has_permission('budget', 'edit'));

CREATE POLICY "Delete budget categories" ON budget_categories
  FOR DELETE USING (auth_has_permission('budget', 'delete'));

CREATE POLICY "View budget items" ON budget_items
  FOR SELECT USING (auth_has_permission('budget', 'view'));

CREATE POLICY "Create budget items" ON budget_items
  FOR INSERT WITH CHECK (auth_has_permission('budget', 'create'));

CREATE POLICY "Edit budget items" ON budget_items
  FOR UPDATE USING (auth_has_permission('budget', 'edit'));

CREATE POLICY "Delete budget items" ON budget_items
  FOR DELETE USING (auth_has_permission('budget', 'delete'));

-- ============================================================================
-- EXPENSE POLICIES
-- ============================================================================
CREATE POLICY "View expenses" ON expenses
  FOR SELECT USING (auth_has_permission('expenses', 'view'));

CREATE POLICY "Create expenses" ON expenses
  FOR INSERT WITH CHECK (auth_has_permission('expenses', 'create'));

CREATE POLICY "Edit expenses" ON expenses
  FOR UPDATE USING (auth_has_permission('expenses', 'edit'));

CREATE POLICY "Delete expenses" ON expenses
  FOR DELETE USING (auth_has_permission('expenses', 'delete'));

CREATE POLICY "View expense_attachments" ON expense_attachments
  FOR SELECT USING (auth_has_permission('expenses', 'view'));

CREATE POLICY "Manage expense_attachments" ON expense_attachments
  FOR ALL USING (auth_has_permission('expenses', 'create'));

CREATE POLICY "View suppliers" ON suppliers
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Manage suppliers" ON suppliers
  FOR ALL USING (auth_has_permission('expenses', 'create'));

-- ============================================================================
-- FIELD ACTIVITIES POLICIES
-- ============================================================================
CREATE POLICY "View plots" ON plots
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Manage plots" ON plots
  FOR ALL USING (auth_has_permission('field_activities', 'edit'));

CREATE POLICY "View field_activities" ON field_activities
  FOR SELECT USING (auth_has_permission('field_activities', 'view'));

CREATE POLICY "Create field_activities" ON field_activities
  FOR INSERT WITH CHECK (auth_has_permission('field_activities', 'create'));

CREATE POLICY "Edit field_activities" ON field_activities
  FOR UPDATE USING (auth_has_permission('field_activities', 'edit'));

CREATE POLICY "Delete field_activities" ON field_activities
  FOR DELETE USING (auth_has_permission('field_activities', 'delete'));

CREATE POLICY "View activity_progress" ON activity_progress
  FOR SELECT USING (auth_has_permission('field_activities', 'view'));

CREATE POLICY "Manage activity_progress" ON activity_progress
  FOR ALL USING (auth_has_permission('field_activities', 'edit'));

CREATE POLICY "View activity_photos" ON activity_photos
  FOR SELECT USING (auth_has_permission('field_activities', 'view'));

CREATE POLICY "Upload activity_photos" ON activity_photos
  FOR ALL USING (auth_has_permission('field_activities', 'upload_photos'));

-- ============================================================================
-- HR POLICIES
-- ============================================================================
CREATE POLICY "View employee_categories" ON employee_categories
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Manage employee_categories" ON employee_categories
  FOR ALL USING (auth_has_permission('hr', 'create'));

CREATE POLICY "View employees" ON employees
  FOR SELECT USING (auth_has_permission('hr', 'view'));

CREATE POLICY "Create employees" ON employees
  FOR INSERT WITH CHECK (auth_has_permission('hr', 'create'));

CREATE POLICY "Edit employees" ON employees
  FOR UPDATE USING (auth_has_permission('hr', 'edit'));

CREATE POLICY "Delete employees" ON employees
  FOR DELETE USING (auth_has_permission('hr', 'delete'));

CREATE POLICY "View attendance" ON attendance
  FOR SELECT USING (auth_has_permission('hr', 'view'));

CREATE POLICY "Manage attendance" ON attendance
  FOR ALL USING (auth_has_permission('hr', 'attendance'));

-- ============================================================================
-- PAYROLL POLICIES
-- ============================================================================
CREATE POLICY "View payroll_periods" ON payroll_periods
  FOR SELECT USING (auth_has_permission('payroll', 'view'));

CREATE POLICY "Create payroll_periods" ON payroll_periods
  FOR INSERT WITH CHECK (auth_has_permission('payroll', 'create'));

CREATE POLICY "Edit payroll_periods" ON payroll_periods
  FOR UPDATE USING (auth_has_permission('payroll', 'approve'));

CREATE POLICY "View payroll_items" ON payroll_items
  FOR SELECT USING (auth_has_permission('payroll', 'view'));

CREATE POLICY "Manage payroll_items" ON payroll_items
  FOR ALL USING (auth_has_permission('payroll', 'create'));

-- ============================================================================
-- INVENTORY POLICIES
-- ============================================================================
CREATE POLICY "View inventory_categories" ON inventory_categories
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Manage inventory_categories" ON inventory_categories
  FOR ALL USING (auth_has_permission('inventory', 'edit'));

CREATE POLICY "View inventory_items" ON inventory_items
  FOR SELECT USING (auth_has_permission('inventory', 'view'));

CREATE POLICY "Edit inventory_items" ON inventory_items
  FOR ALL USING (auth_has_permission('inventory', 'edit'));

CREATE POLICY "View stock_movements" ON stock_movements
  FOR SELECT USING (auth_has_permission('inventory', 'view'));

CREATE POLICY "Create stock_in" ON stock_movements
  FOR INSERT WITH CHECK (
    (movement_type = 'in' AND auth_has_permission('inventory', 'stock_in'))
    OR (movement_type = 'out' AND auth_has_permission('inventory', 'stock_out'))
    OR auth_has_permission('inventory', 'edit')
  );

-- ============================================================================
-- FLEET POLICIES
-- ============================================================================
CREATE POLICY "View vehicles" ON vehicles
  FOR SELECT USING (auth_has_permission('fleet', 'view'));

CREATE POLICY "Manage vehicles" ON vehicles
  FOR ALL USING (auth_has_permission('fleet', 'edit'));

CREATE POLICY "View fuel_logs" ON fuel_logs
  FOR SELECT USING (auth_has_permission('fleet', 'view'));

CREATE POLICY "Manage fuel_logs" ON fuel_logs
  FOR ALL USING (auth_has_permission('fleet', 'fuel_log'));

CREATE POLICY "View service_records" ON service_records
  FOR SELECT USING (auth_has_permission('fleet', 'view'));

CREATE POLICY "Manage service_records" ON service_records
  FOR ALL USING (auth_has_permission('fleet', 'service'));

-- ============================================================================
-- SYSTEM POLICIES
-- ============================================================================
CREATE POLICY "Authenticated view company_profile" ON company_profile
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "PM edit company_profile" ON company_profile
  FOR ALL USING (auth_has_permission('system', 'edit_company'));

CREATE POLICY "View system_settings" ON system_settings
  FOR SELECT USING (auth.uid() IS NOT NULL AND NOT is_system);

CREATE POLICY "PM edit system_settings" ON system_settings
  FOR UPDATE USING (auth_has_permission('system', 'edit_settings') AND NOT is_system);

-- ============================================================================
-- NOTIFICATIONS POLICIES
-- ============================================================================
CREATE POLICY "Users view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Authenticated create notifications" ON notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- AUDIT LOGS POLICIES
-- ============================================================================
CREATE POLICY "PM view audit_logs" ON audit_logs
  FOR SELECT USING (auth_has_permission('system', 'view_audit') AND visible_to_pm);

CREATE POLICY "Authenticated insert audit_logs" ON audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- MWISHO - RLS imewekwa kwenye tables zote
-- ============================================================================
