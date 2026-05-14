-- ============================================================================
-- 00_MASTER_SETUP.SQL — Master Setup ya Admin & PM permissions
-- ============================================================================
-- HII INAFANYA MAMBO MAWILI:
-- 1. Inafanya akaunti yako kuwa System Admin halisi
-- 2. Inahakikisha ROLES zote zina PERMISSIONS sahihi
--
-- ENDESHA hii BAADA YA: 01_schema.sql, 02_rls_policies.sql, 03_seed_data.sql
-- na BAADA ya kutengeneza auth user kwenye Supabase Authentication.
-- ============================================================================

-- ============================================================================
-- SEHEMU 1: HAKIKISHA ROLES NA PERMISSIONS ZIPO
-- ============================================================================

-- Hakikisha system_admin role ipo
INSERT INTO roles (name, slug, description, is_system_role, is_hidden, is_template)
VALUES ('System Admin', 'system_admin', 'Msimamizi wa kiufundi (mfichwa)', TRUE, TRUE, FALSE)
ON CONFLICT (slug) DO NOTHING;

-- Hakikisha project_manager role ipo
INSERT INTO roles (name, slug, description, is_system_role, is_hidden, is_template)
VALUES ('Project Manager', 'project_manager', 'Mmiliki wa mfumo', TRUE, FALSE, FALSE)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- SEHEMU 2: HAKIKISHA SYSTEM_ADMIN INA PERMISSIONS ZOTE
-- ============================================================================
DO $$
DECLARE
    v_admin_role_id BIGINT;
    v_pm_role_id BIGINT;
    v_count INT;
BEGIN
    SELECT id INTO v_admin_role_id FROM roles WHERE slug = 'system_admin';
    SELECT id INTO v_pm_role_id FROM roles WHERE slug = 'project_manager';
    
    -- Ondoa permissions za zamani za system_admin
    DELETE FROM role_permissions WHERE role_id = v_admin_role_id;
    
    -- Ingiza upya: ZOTE
    INSERT INTO role_permissions (role_id, permission_id, granted)
    SELECT v_admin_role_id, id, TRUE FROM permissions;
    
    SELECT COUNT(*) INTO v_count FROM role_permissions WHERE role_id = v_admin_role_id;
    RAISE NOTICE '✓ System Admin role ina permissions: %', v_count;
    
    -- Ondoa permissions za zamani za project_manager
    DELETE FROM role_permissions WHERE role_id = v_pm_role_id;
    
    -- Ingiza upya: ZOTE
    INSERT INTO role_permissions (role_id, permission_id, granted)
    SELECT v_pm_role_id, id, TRUE FROM permissions;
    
    SELECT COUNT(*) INTO v_count FROM role_permissions WHERE role_id = v_pm_role_id;
    RAISE NOTICE '✓ Project Manager role ina permissions: %', v_count;
END $$;

-- ============================================================================
-- SEHEMU 3: TENGENEZA/REKEBISHA SYSTEM ADMIN
-- ============================================================================
DO $$
DECLARE
    -- ✏️ BADILISHA HAPA TU kama unahitaji admin tofauti:
    v_admin_email   TEXT := 'baruthdickson005@gmail.com';
    v_admin_name    TEXT := 'Baruth Dickson';
    
    v_user_id       UUID;
    v_admin_role_id BIGINT;
BEGIN
    -- Tafuta user kwa email (HAUHITAJI UUID!)
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_admin_email LIMIT 1;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '❌ Email "%" haipo kwenye auth.users. Nenda Supabase Dashboard → Authentication → Users → Add user kwanza.', v_admin_email;
    END IF;
    
    SELECT id INTO v_admin_role_id FROM roles WHERE slug = 'system_admin';
    
    -- Tengeneza au badilisha
    IF EXISTS (SELECT 1 FROM public.users WHERE id = v_user_id) THEN
        UPDATE public.users SET
            full_name       = v_admin_name,
            email           = v_admin_email,
            role_id         = v_admin_role_id,
            is_system_admin = TRUE,
            is_active       = TRUE,
            deleted_at      = NULL
        WHERE id = v_user_id;
        RAISE NOTICE '✓ System Admin imebadilishwa kuwa sahihi';
    ELSE
        INSERT INTO public.users (
            id, username, full_name, email, phone, role_id, is_active, is_system_admin
        ) VALUES (
            v_user_id, 
            SPLIT_PART(v_admin_email, '@', 1),
            v_admin_name, 
            v_admin_email, 
            NULL, 
            v_admin_role_id, 
            TRUE, 
            TRUE
        );
        RAISE NOTICE '✓ System Admin imeundwa';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '════════════════════════════════════════';
    RAISE NOTICE '✅ KILA KITU KIKO SAWA SASA!';
    RAISE NOTICE '════════════════════════════════════════';
    RAISE NOTICE 'Admin Email:  %', v_admin_email;
    RAISE NOTICE 'Admin Role:   System Admin';
    RAISE NOTICE 'Permissions:  Zote';
    RAISE NOTICE '';
    RAISE NOTICE 'Sasa fanya hivi:';
    RAISE NOTICE '1. Toka kwenye mfumo (logout)';
    RAISE NOTICE '2. Ingia upya kwa: %', v_admin_email;
    RAISE NOTICE '3. Utapelekwa kwenye Admin Dashboard';
    RAISE NOTICE '4. Bofya "Tengeneza Project Manager"';
    RAISE NOTICE '════════════════════════════════════════';
END $$;

-- ============================================================================
-- SEHEMU 4: DIAGNOSTIC FINAL — Onyesha hali ya sasa
-- ============================================================================
SELECT 
  '👤 Watumiaji' AS kipengele,
  COUNT(*)::TEXT AS jumla
FROM public.users WHERE deleted_at IS NULL
UNION ALL
SELECT '🔧 System Admins', COUNT(*)::TEXT FROM public.users 
  WHERE is_system_admin = TRUE AND deleted_at IS NULL
UNION ALL
SELECT '👑 Project Managers', COUNT(*)::TEXT FROM public.users u
  JOIN roles r ON u.role_id = r.id
  WHERE r.slug = 'project_manager' AND u.deleted_at IS NULL
UNION ALL
SELECT '🎭 Roles', COUNT(*)::TEXT FROM roles
UNION ALL
SELECT '🔑 Permissions', COUNT(*)::TEXT FROM permissions
UNION ALL
SELECT '🔗 Role-Permissions', COUNT(*)::TEXT FROM role_permissions;
