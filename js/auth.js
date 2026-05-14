// ============================================================================
// AUTH - Login, logout, session management
// ============================================================================

import { supabase } from './supabase.js';

let currentUser = null;
let currentProfile = null;
let userPermissions = [];

// ============================================================================
// LOGIN
// ============================================================================
export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await loadProfile();
  // Update last_login_at
  try {
    await supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', data.user.id);
    const isAdmin = currentProfile?.is_system_admin;
    await supabase.from('audit_logs').insert({
      action: 'login',
      module: 'auth',
      description: `${currentProfile?.full_name || email} ameingia kwenye mfumo`,
      visible_to_pm: !isAdmin
    });
  } catch (e) { /* non-fatal */ }
  return data;
}

// Helper: Where to redirect after login (admin → admin.html, others → dashboard.html)
export function getHomePage() {
  return currentProfile?.is_system_admin ? '/admin.html' : '/dashboard.html';
}

// ============================================================================
// LOGOUT
// ============================================================================
export async function logout() {
  try {
    const isAdmin = currentProfile?.is_system_admin;
    await supabase.from('audit_logs').insert({
      action: 'logout',
      module: 'auth',
      description: `${currentProfile?.full_name || 'User'} ametoka kwenye mfumo`,
      visible_to_pm: !isAdmin
    });
  } catch (e) { /* non-fatal */ }
  await supabase.auth.signOut();
  currentUser = null;
  currentProfile = null;
  userPermissions = [];
  window.location.href = '/index.html';
}

// ============================================================================
// CHECK SESSION (call kwenye kila page)
// ============================================================================
export async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = '/index.html';
    return null;
  }
  if (!currentProfile) await loadProfile();
  return session;
}

// Hutumiwa na business pages — admin akiingia hupelekwa admin.html
export async function requireBusinessUser() {
  await requireAuth();
  if (currentProfile?.is_system_admin) {
    window.location.href = '/admin.html';
    return false;
  }
  return true;
}

// Hutumiwa na admin pages — non-admin akiingia hupelekwa dashboard
export async function requireSystemAdmin() {
  await requireAuth();
  if (!currentProfile?.is_system_admin) {
    window.location.href = '/dashboard.html';
    return false;
  }
  return true;
}

// ============================================================================
// LOAD USER PROFILE & PERMISSIONS
// ============================================================================
export async function loadProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  currentUser = user;
  
  // Pata profile
  const { data: profile, error } = await supabase
    .from('users')
    .select(`
      *,
      role:roles(id, name, slug, is_hidden)
    `)
    .eq('id', user.id)
    .single();
  
  if (error) {
    console.error('Profile load error:', error);
    return null;
  }
  currentProfile = profile;
  
  // Pata permissions
  const { data: perms } = await supabase
    .from('role_permissions')
    .select(`
      granted,
      permission:permissions(module, action)
    `)
    .eq('role_id', profile.role_id)
    .eq('granted', true);
  
  userPermissions = (perms || []).map(p => `${p.permission.module}.${p.permission.action}`);
  return profile;
}

// ============================================================================
// CHECK PERMISSION
// ============================================================================
export function hasPermission(module, action) {
  return userPermissions.includes(`${module}.${action}`);
}

// ============================================================================
// REQUIRE PERMISSION (redirect kama hana)
// ============================================================================
export function requirePermission(module, action) {
  if (!hasPermission(module, action)) {
    alert('Huna ruhusa ya kufanya kazi hii');
    window.location.href = '/dashboard.html';
    return false;
  }
  return true;
}

// ============================================================================
// GETTERS
// ============================================================================
export function getCurrentUser() { return currentUser; }
export function getCurrentProfile() { return currentProfile; }
export function getPermissions() { return userPermissions; }
export function isPM() {
  return currentProfile?.role?.slug === 'project_manager' || currentProfile?.role?.slug === 'system_admin';
}

// ============================================================================
// CREATE NEW USER (PM/Admin only)
// Tunatumia separate Supabase client kuepuka kulogout admin
// ============================================================================
export async function createUser(email, password, fullName, roleId, phone = null) {
  // Hifadhi session ya admin kabla ya kufanya signUp
  const { data: { session: adminSession } } = await supabase.auth.getSession();
  if (!adminSession) throw new Error('Hujaingia kwenye mfumo');
  
  // Tengeneza Supabase client mpya (bila storage) kwa ajili ya signUp tu
  // Hii inazuia signUp kubadilisha session ya admin kwenye localStorage
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import('./config.js');
  
  const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
  
  // 1. Tengeneza auth user kupitia signUp (kwenye temp client)
  const { data: signupData, error: signupError } = await tempClient.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { full_name: fullName } }
  });
  
  if (signupError) throw signupError;
  if (!signupData.user) throw new Error('User haikutengenezwa');
  
  // 2. Tengeneza profile kwenye public.users (kwa kutumia admin session)
  const { error: profileError } = await supabase.from('users').insert({
    id: signupData.user.id,
    username: email.split('@')[0],
    email: email.trim().toLowerCase(),
    full_name: fullName,
    role_id: roleId,
    phone: phone || null,
    is_active: true,
    is_system_admin: false,
    created_by: currentUser?.id
  });
  
  if (profileError) {
    // Profile imeshindikana — toa warning lakini auth user tayari yupo
    console.error('Profile creation error:', profileError);
    throw new Error('Auth user imeundwa lakini profile haijaundwa: ' + profileError.message);
  }
  
  // 3. Hakikisha session ya admin bado ipo
  const { data: { session: currentSession } } = await supabase.auth.getSession();
  if (!currentSession || currentSession.user.id !== adminSession.user.id) {
    // Restore admin session kama imebadilika
    await supabase.auth.setSession({
      access_token: adminSession.access_token,
      refresh_token: adminSession.refresh_token
    });
  }
  
  return signupData.user;
}

// ============================================================================
// RESET PASSWORD
// ============================================================================
export async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password.html`
  });
  if (error) throw error;
}

// ============================================================================
// UPDATE PASSWORD
// ============================================================================
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
